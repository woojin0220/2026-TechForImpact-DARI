#!/usr/bin/env python3
"""Expanded local comparison. Frozen public checkpoints; synthetic inputs only."""
import argparse
import hashlib
import importlib.metadata
import importlib.util
import json
import os
from pathlib import Path
import platform
import sys
import time
import traceback

from expanded import cases, windows
from run import metrics

MODELS = {
    "gliner": ("urchade/gliner_multi_pii-v1", "1fcf13e85f4eef5394e1fcd406cf2ca9ea82351d"),
    "liquid": ("LiquidAI/LFM2.5-Encoder-350M-PII-Detector", "b8c9cf3d2d6ae52501b35a27ba46f271449c9ce2"),
    "nym": ("Wismut/nym-pii-multilingual", "0ed0242d67a30ca6a83e5f118506ff1e1daf83ca"),
}
GLINER_IDS = ["person", "email", "phone number", "address", "date of birth", "passport number"]
GLINER_SENSITIVE = ["religion", "political party", "medical condition"]
LIQUID_IDS = {"identity.person_name", "contact.email", "contact.phone", "contact.address",
              "identity.date_of_birth", "identity.passport"}
LIQUID_SENSITIVE = {"special.religion", "special.political", "special.health_status", "healthcare.condition"}
NYM_IDS = {"GIVEN_NAME", "SURNAME", "EMAIL", "PHONE", "STREET_ADDRESS", "STREET_NAME",
           "BUILDING_NUMBER", "SECONDARY_ADDRESS", "CITY", "STATE", "COUNTRY", "ZIP_CODE", "DATE_OF_BIRTH", "PASSPORT"}


def group_tokens(label_ids, offsets, id2label, text):
    """BIO/BIOES grouping, following Liquid's published argmax helper semantics."""
    output, current = [], None
    for index, (start, end) in zip(label_ids, offsets):
        label = id2label[int(index)]
        if start == end or label == "O":
            if current:
                output.append(current)
            current = None
            continue
        tag, entity = label.split("-", 1)
        if tag in ["B", "S"] or current is None or current["label"] != entity:
            if current:
                output.append(current)
            current = {"start": start, "end": end, "label": entity}
        else:
            current["end"] = end
    if current:
        output.append(current)
    for span in output:
        while span["start"] < span["end"] and text[span["start"]].isspace():
            span["start"] += 1
        while span["end"] > span["start"] and text[span["end"] - 1].isspace():
            span["end"] -= 1
    return [span for span in output if span["end"] > span["start"]]


def score_case(case, spans):
    score = metrics(case["text"], case["gold"], spans)
    actual = {i for s in spans for i in range(s["start"], s["end"])}
    core = [{i for i in range(s["start"], s["end"]) if case["text"][i].isalnum()} for s in case["gold"]]
    score["core_fully_covered"] = [bool(chars) and chars <= actual for chars in core]
    score["core_covered_entities"] = sum(score["core_fully_covered"])
    score["protected_hit"] = [any(i in actual for i in range(s["start"], s["end"]) if not case["text"][i].isspace()) for s in case["protected"]]
    score["protected_hits"] = sum(score["protected_hit"])
    score["protected_count"] = len(case["protected"])
    return score


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", choices=MODELS, required=True)
    parser.add_argument("--decode", choices=["raw", "hybrid"], default="raw")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--repeat", type=int, default=2)
    parser.add_argument("--threshold", type=float, default=.3)
    args = parser.parse_args()
    if args.decode == "hybrid" and args.model != "liquid":
        parser.error("The hybrid mode is LiquidAI's published postprocessor only")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    data = cases()
    serialized = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    fixture_path = args.output.parent / "expanded-fixtures.json"
    if fixture_path.exists() and fixture_path.read_text() != serialized:
        raise ValueError("Frozen fixture file differs; use a new result directory")
    fixture_path.write_text(serialized)
    name, revision = MODELS[args.model]
    result = {"model": name, "alias": args.model, "decode": args.decode, "revision": revision,
              "threshold": args.threshold if args.model == "gliner" else None,
              "device": "cpu", "dtype": "float32", "threads": 4, "repeat": args.repeat,
              "platform": platform.platform(), "python": platform.python_version(),
              "fixture_sha256": hashlib.sha256(serialized.encode()).hexdigest(),
              "window_policy": {"size_chars": 220, "overlap_chars": 80, "applied_to": "long track, additional chunked row"},
              "policy": "Score only shared six identifier concepts; sensitive types scored separately; all raw labels retained.",
              "rows": []}
    def save():
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    save()
    try:
        import torch
        import psutil
        from huggingface_hub import snapshot_download
        from transformers import AutoModelForTokenClassification, AutoTokenizer
        torch.set_num_threads(4)
        torch.set_num_interop_threads(1)
        result["packages"] = {key: importlib.metadata.version(key) for key in ["torch", "transformers", "gliner", "huggingface-hub"]}
        result["ram_gb"] = round(psutil.virtual_memory().total / 2**30, 2)
        local = snapshot_download(name, revision=revision,
                                  allow_patterns=["*.json", "*.safetensors", "*.bin", "*.model", "*.py"],
                                  ignore_patterns=["*/**"], max_workers=2)
        started = time.perf_counter()
        if args.model == "gliner":
            from gliner import GLiNER
            model = GLiNER.from_pretrained(local, load_tokenizer=True).eval()
            def predict(text, sensitive):
                spans = model.predict_entities(text, GLINER_IDS + (GLINER_SENSITIVE if sensitive else []), threshold=args.threshold)
                return [{"start": int(s["start"]), "end": int(s["end"]), "label": s["label"]} for s in spans]
            result["decoding"] = "GLiNER native span decoder"
        else:
            tokenizer = AutoTokenizer.from_pretrained(local, trust_remote_code=args.model == "liquid")
            model = AutoModelForTokenClassification.from_pretrained(
                local, trust_remote_code=args.model == "liquid", dtype=torch.float32).eval()
            hybrid = None
            if args.model == "liquid":
                # Code at the pinned checkpoint was inspected before enabling it.
                # Only hybrid_spans is used; the helper's silent max_length=2048 truncation is avoided.
                sys.path.insert(0, local)
                spec = importlib.util.spec_from_file_location("liquid_published_decode", Path(local) / "pii_hybrid_decode.py")
                helper = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(helper)
                hybrid = helper.hybrid_spans
            def predict(text, sensitive):
                # Explicit shared chunking is measured separately. Never silently truncate here.
                enc = tokenizer(text, return_offsets_mapping=True, return_tensors="pt", truncation=False)
                offsets = enc.pop("offset_mapping")[0].tolist()
                result.setdefault("observed_token_lengths", {})[str(len(text))] = int(enc["input_ids"].shape[1])
                logits = model(**enc).logits[0]
                spans = group_tokens(logits.argmax(-1).tolist(), offsets, model.config.id2label, text)
                if args.decode == "hybrid":
                    native = hybrid(text, [{"start": s["start"], "end": s["end"], "type": s["label"]} for s in spans])
                    spans = [{"start": s["start"], "end": s["end"], "label": s["type"]} for s in native]
                return spans
            result["decoding"] = "Token argmax + published-style BIO/BIOES grouping" + (" + LiquidAI hybrid_spans" if args.decode == "hybrid" else "")
        result["load_seconds"] = time.perf_counter() - started
        result["parameters"] = sum(p.numel() for p in model.parameters())
        print(json.dumps({"event": "loaded", "model": args.model, "decode": args.decode, "parameters": result["parameters"]}), flush=True)
        def selected(spans, sensitive):
            allowed = (set(GLINER_SENSITIVE) if sensitive else set(GLINER_IDS)) if args.model == "gliner" else (
                LIQUID_SENSITIVE if sensitive else LIQUID_IDS) if args.model == "liquid" else (set() if sensitive else NYM_IDS)
            return [s for s in spans if s["label"] in allowed]
        def infer(case, mode):
            chunks = list(windows(case["text"])) if mode == "chunked" else [(0, case["text"])]
            raw = []
            for offset, text in chunks:
                for span in predict(text, case["track"] == "sensitive"):
                    if not (0 <= span["start"] < span["end"] <= len(text)):
                        raise ValueError("Invalid character offsets")
                    raw.append({**span, "start": span["start"] + offset, "end": span["end"] + offset})
            # Deduplicate exact spans; overlapping window spans are unioned by scoring, not string replacement.
            return list({(s["start"], s["end"], s["label"]): s for s in raw}.values()), len(chunks)
        with torch.inference_mode():
            start = time.perf_counter()
            predict(data[0]["text"], False)
            result["warmup_ms"] = (time.perf_counter() - start) * 1000
            for case in data:
                modes = ["whole", "chunked"] if case["track"] == "long" else ["whole"]
                for mode in modes:
                    row = {**case, "mode": mode}
                    if case["track"] == "sensitive" and args.model == "nym":
                        row["status"] = "unsupported_taxonomy"
                    else:
                        try:
                            times, outputs = [], []
                            for _ in range(args.repeat):
                                start = time.perf_counter()
                                spans, count = infer(case, mode)
                                times.append((time.perf_counter() - start) * 1000)
                                outputs.append(spans)
                            row.update(status="ok", predictions=selected(outputs[0], case["track"] == "sensitive"),
                                       raw_predictions=outputs[0], latency_ms=times, chunks=count,
                                       repeat_consistent=outputs.count(outputs[0]) == len(outputs))
                            row["metrics"] = score_case(case, row["predictions"])
                        except Exception as error:
                            row.update(status="error", error=f"{type(error).__name__}: {error}",
                                       predictions=[], metrics=score_case(case, []))
                            traceback.print_exc()
                    result["rows"].append(row)
                    save()
                    print(json.dumps({"event": "case", "model": args.model, "decode": args.decode,
                                      "id": case["id"], "mode": mode, "status": row["status"],
                                      "coverage": row.get("metrics", {}).get("covered_entities"),
                                      "ms": round(sum(row.get("latency_ms", [])) / args.repeat, 1)}), flush=True)
        result["status"] = "complete_with_case_errors" if any(r["status"] == "error" for r in result["rows"]) else "complete"
        result["rss_end_mb"] = round(psutil.Process().memory_info().rss / 2**20, 1)
    except Exception as error:
        result.update(status="load_error", error=f"{type(error).__name__}: {error}", traceback=traceback.format_exc())
        traceback.print_exc()
    finally:
        save()
    if result["status"] != "complete":
        raise SystemExit(1)


if __name__ == "__main__":
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    main()
