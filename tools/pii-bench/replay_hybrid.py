"""Apply the pinned LiquidAI postprocessor to recorded raw predictions.

The model is not rerun. For chunked rows, regex sees the whole text after span
union. Timings are explicitly raw inference + separately measured postprocessing.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import sys
import time

from compare import score_case, LIQUID_IDS, LIQUID_SENSITIVE


def main():
    p = argparse.ArgumentParser()
    p.add_argument("source", type=Path)
    p.add_argument("--model-dir", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    result = json.loads(args.source.read_text())
    if result["alias"] != "liquid" or result["decode"] != "raw" or result["status"] not in ["complete", "complete_with_case_errors"]:
        raise ValueError("Expected completed LiquidAI raw results")
    sys.path.insert(0, str(args.model_dir))
    spec = importlib.util.spec_from_file_location("liquid_published_decode", args.model_dir / "pii_hybrid_decode.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    result["decode"] = "hybrid"
    result["source_predictions"] = str(args.source)
    result["decoding"] += " + pinned LiquidAI hybrid_spans on full text after model spans/chunk union"
    result["latency_kind"] = "recorded raw inference plus separately measured postprocessing; not a second end-to-end run"
    result["postprocessing_source"] = {"revision": result["revision"], "files": ["pii_hybrid_decode.py", "context_cued.py"]}
    for row in result["rows"]:
        if row["status"] != "ok":
            continue
        original = row["raw_predictions"]
        outputs, times = [], []
        for _ in range(result["repeat"]):
            start = time.perf_counter()
            native = module.hybrid_spans(row["text"], [{"start": s["start"], "end": s["end"], "type": s["label"]} for s in original])
            spans = [{"start": s["start"], "end": s["end"], "label": s["type"]} for s in native]
            times.append((time.perf_counter() - start) * 1000)
            outputs.append(spans)
        row["raw_inference_latency_ms"] = row["latency_ms"]
        row["postprocessing_latency_ms"] = times
        row["latency_ms"] = [a+b for a,b in zip(row["raw_inference_latency_ms"], times)]
        row["raw_predictions"] = outputs[0]
        allowed = LIQUID_SENSITIVE if row["track"] == "sensitive" else LIQUID_IDS
        row["predictions"] = [s for s in outputs[0] if s["label"] in allowed]
        row["metrics"] = score_case(row, row["predictions"])
        row["repeat_consistent"] = row["repeat_consistent"] and outputs.count(outputs[0]) == len(outputs)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(args.output)


if __name__ == "__main__":
    main()
