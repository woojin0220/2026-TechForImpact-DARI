#!/usr/bin/env python3
"""Local-only synthetic screening. No cloud generation, API key, or applicant data.

Use one model per process so that memory is released between models.
"""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import statistics
import time
import traceback

from fixtures import cases

MODELS = {
    "gliner_multi": ("urchade/gliner_multi_pii-v1", "1fcf13e85f4eef5394e1fcd406cf2ca9ea82351d", "gliner"),
    "privacy_filter": ("openai/privacy-filter", "7ffa9a043d54d1be65afb281eddf0ffbe629385b", "privacy"),
    "gliner2": ("fastino/gliner2-privacy-filter-PII-multi", "1cb4166094dc58fa8d836429f060d6c95f62b495", "gliner2"),
    "gliner_edge": ("knowledgator/gliner-pii-edge-v1.0", "9b7f39b0a2da971a5beea78d35f1539d4009c891", "gliner"),
}
LABELS = {
    "gliner_multi": ["person", "email", "phone number", "address", "date of birth", "passport number"],
    "gliner_edge": ["name", "email address", "phone number", "location address", "dob", "passport number"],
    "gliner2": ["person", "email", "phone_number", "address", "date_of_birth", "passport_number"],
}
EXTRA = ["religion", "political party", "medical condition"]


def metrics(text, gold, predicted):
    # Ignore whitespace only; punctuation and all non-Latin characters still count.
    def chars(spans):
        return {i for span in spans for i in range(span["start"], span["end"]) if not text[i].isspace()}
    expected, actual = chars(gold), chars(predicted)
    covered = sum(chars([span]) <= actual for span in gold)
    return {"tp": len(expected & actual), "fp": len(actual - expected), "fn": len(expected - actual),
            "covered_entities": covered, "entities": len(gold),
            "leak_free": expected <= actual, "exact_mask": expected == actual,
            "fully_covered": [chars([span]) <= actual for span in gold]}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--model", choices=MODELS, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--device", default="cpu")
    p.add_argument("--threads", type=int, default=4)
    p.add_argument("--repeat", type=int, default=2)
    args = p.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    data = cases()
    name, revision, kind = MODELS[args.model]
    result = {"model": name, "revision": revision, "device": args.device, "threads": args.threads,
              "platform": platform.platform(), "python": platform.python_version(), "repeat": args.repeat,
              "fixture_sha256": hashlib.sha256(json.dumps(data, ensure_ascii=False).encode()).hexdigest(),
              "limitations": ["42 short invented examples; not representative or native-reviewed",
                              "CPU screen on one Mac; not a mobile benchmark",
                              "Identifier comparison uses model-specific label names for the same six concepts",
                              "Sensitive track is an extra zero-shot probe, not part of identifier scores",
                              "Whitespace ignored in coverage metrics; each occurrence counted separately"],
              "rows": []}
    def save():
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    save()
    try:
        import torch
        import psutil
        from huggingface_hub import snapshot_download
        torch.set_num_threads(args.threads)
        torch.set_num_interop_threads(1)
        result["ram_gb"] = round(psutil.virtual_memory().total / 2**30, 2)
        result["packages"] = {n: importlib.metadata.version(n) for n in ["torch", "transformers", "gliner", "gliner2", "huggingface-hub"]}
        started = time.perf_counter()
        local = snapshot_download(name, revision=revision,
                                  allow_patterns=["*.json", "*.bin", "*.safetensors", "*.model", "*.txt"],
                                  ignore_patterns=["original/*", "onnx/*", ".*"], max_workers=3)
        result["download_seconds"] = round(time.perf_counter() - started, 3)
        started = time.perf_counter()
        if kind == "gliner":
            from gliner import GLiNER
            model = GLiNER.from_pretrained(local, load_tokenizer=True).to(args.device).eval()
            def predict(text, threshold, sensitive=False):
                labels = LABELS[args.model] + (EXTRA if sensitive else [])
                return model.predict_entities(text, labels, threshold=threshold, flat_ner=True)
        elif kind == "gliner2":
            from gliner2 import GLiNER2
            model = GLiNER2.from_pretrained(local).to(args.device).eval()
            def predict(text, threshold, sensitive=False):
                labels = LABELS[args.model] + (EXTRA if sensitive else [])
                output = model.extract_entities(text, labels, threshold=threshold,
                                                include_confidence=True, include_spans=True)
                return [dict(entity, label=label) for label, values in output["entities"].items() for entity in values]
        else:
            from transformers import AutoTokenizer, AutoModelForTokenClassification
            from bioes import decode, spans_from_path
            tokenizer = AutoTokenizer.from_pretrained(local)
            model = AutoModelForTokenClassification.from_pretrained(local, dtype=torch.float32).to(args.device).eval()
            calibration = json.loads((Path(local) / "viterbi_calibration.json").read_text())
            biases = calibration["operating_points"]["default"]["biases"]
            if any(value != 0 for value in biases.values()):
                raise ValueError("This adapter implements the released zero-bias operating point only")
            result["decoding"] = "HF float32 model + BIOES Viterbi; released default zero transition biases"
            result["calibration"] = calibration
            def predict(text, threshold, sensitive=False):
                if sensitive:
                    return []  # No religion/political/medical categories in the released taxonomy.
                inputs = tokenizer(text, return_offsets_mapping=True, return_tensors="pt", add_special_tokens=False)
                offsets = inputs.pop("offset_mapping")[0].tolist()
                inputs = {key: value.to(args.device) for key, value in inputs.items()}
                logits = model(**inputs).logits[0]
                path = decode(logits, model.config.id2label)
                return spans_from_path(path, offsets, model.config.id2label, text)
        result["load_seconds"] = round(time.perf_counter() - started, 3)
        result["parameters"] = sum(v.numel() for v in model.parameters())
        result["rss_after_load_mb"] = round(psutil.Process().memory_info().rss / 2**20, 1)
        print(json.dumps({"event": "loaded", "model": args.model, "load_seconds": result["load_seconds"], "parameters": result["parameters"]}), flush=True)
        # Shared fixed thresholds for the tunable GLiNER models. Privacy Filter uses native policy.
        thresholds = [None] if kind == "privacy" else [0.3, 0.5]
        with torch.inference_mode():
            for threshold in thresholds:
                warm_start = time.perf_counter()
                predict(data[0]["text"], threshold)
                result.setdefault("warmup_ms", {})[str(threshold)] = (time.perf_counter() - warm_start) * 1000
                for case in data:
                    sensitive = case["track"] == "sensitive"
                    if sensitive and kind == "privacy":
                        result["rows"].append({**case, "threshold": threshold, "status": "unsupported_taxonomy"})
                        continue
                    times, outputs = [], []
                    for _ in range(args.repeat):
                        start = time.perf_counter()
                        spans = predict(case["text"], threshold, sensitive)
                        if args.device == "mps":
                            torch.mps.synchronize()
                        times.append((time.perf_counter() - start) * 1000)
                        clean = []
                        for span in spans:
                            a, b = int(span["start"]), int(span["end"])
                            if not (0 <= a < b <= len(case["text"])):
                                raise ValueError(f"Invalid offset {a}:{b} for {case['id']}")
                            confidence = span.get("score", span.get("confidence"))
                            clean.append({"start": a, "end": b, "label": str(span["label"]),
                                          "text": case["text"][a:b], "score": float(confidence) if confidence is not None else None})
                        outputs.append(clean)
                    if sensitive:
                        # Identifier predictions do not count as sensitive-attribute predictions.
                        scored = [s for s in outputs[0] if s["label"] in EXTRA]
                    else:
                        scored = outputs[0]
                    row = {**case, "status": "ok", "threshold": threshold, "predictions": outputs[0],
                           "latency_ms": times, "repeat_consistent": outputs.count(outputs[0]) == len(outputs),
                           "metrics": metrics(case["text"], case["gold"], scored)}
                    result["rows"].append(row)
                    save()
                    print(json.dumps({"event": "case", "model": args.model, "id": case["id"], "threshold": threshold,
                                      "ms": round(statistics.median(times), 1), "covered": row["metrics"]["covered_entities"],
                                      "entities": row["metrics"]["entities"]}), flush=True)
        result["status"] = "complete"
        result["rss_after_inference_mb"] = round(psutil.Process().memory_info().rss / 2**20, 1)
    except Exception as error:
        result["status"] = "error"
        result["error"] = f"{type(error).__name__}: {error}"
        result["traceback"] = traceback.format_exc()
        traceback.print_exc()
    finally:
        save()
    if result["status"] != "complete":
        raise SystemExit(1)


if __name__ == "__main__":
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    main()
