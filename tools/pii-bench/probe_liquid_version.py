"""Check a suspicious result against the Transformers version declared by LiquidAI.

Run in separate processes, then compare token IDs, argmax tags, and numeric logits.
This does not tune the model or the evaluation labels.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import torch
import transformers
from transformers import AutoTokenizer, AutoModelForTokenClassification

from expanded import cases
from compare import group_tokens


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--model-dir", required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--arrays", type=Path, required=True)
    args = p.parse_args()
    torch.set_num_threads(4)
    torch.set_num_interop_threads(1)
    tok = AutoTokenizer.from_pretrained(args.model_dir, trust_remote_code=True)
    model = AutoModelForTokenClassification.from_pretrained(args.model_dir, trust_remote_code=True, dtype=torch.float32).eval()
    chosen = [r for r in cases() if r["group"] == "original" and r["id"].endswith(("-1", "-7"))]
    report = {"transformers": transformers.__version__, "torch": torch.__version__, "cases": []}
    arrays = {}
    with torch.inference_mode():
        for row in chosen:
            enc = tok(row["text"], return_offsets_mapping=True, return_tensors="pt", truncation=False)
            offsets = enc.pop("offset_mapping")[0].tolist()
            output = model(**enc).logits[0]
            tags = output.argmax(-1).tolist()
            report["cases"].append({"id": row["id"], "input_ids": enc["input_ids"][0].tolist(),
                                    "tags": tags, "predictions": group_tokens(tags, offsets, model.config.id2label, row["text"])})
            arrays[row["id"]] = output.numpy()
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n")
    np.savez_compressed(args.arrays, **arrays)
    print(args.output, flush=True)


if __name__ == "__main__":
    main()
