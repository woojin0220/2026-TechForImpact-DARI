# Local PII model screening

This tool compares the four models discussed for DARI without calling an external LLM. All inputs are invented and live in `fixtures.py`; no applicant documents, API keys, or application state are read. Model weights and public tokenizer assets are downloaded from Hugging Face. Inference happens locally.

The application runtime and its network behavior are unchanged. This is a small exploratory screen, not a production privacy guarantee, a native-speaker-reviewed dataset, or a phone benchmark.

## Reproduce

Use Python 3.11 in a separate environment. The tested environment is recorded in `requirements-tested.txt`. Model revisions are pinned in `run.py`; the older GLiNER checkpoints also fetch a public base-model tokenizer/config on their first load. Those cached dependency versions can be inspected with the snapshot manifest below.

```sh
python3.11 -m venv /private/tmp/dari-pii-bench-venv
/private/tmp/dari-pii-bench-venv/bin/python -m pip install -r tools/pii-bench/requirements-tested.txt
export HF_HOME=/private/tmp/dari-pii-bench-cache
export HF_HUB_DISABLE_IMPLICIT_TOKEN=1
/private/tmp/dari-pii-bench-venv/bin/python -m unittest discover -s tools/pii-bench -p 'test_*.py' -v
```

Run one model per process, sequentially, to avoid memory retention and CPU contention. Replace `gliner_multi` with `gliner_edge`, `gliner2`, and `privacy_filter` to run all four.

```sh
/private/tmp/dari-pii-bench-venv/bin/python tools/pii-bench/run.py \
  --model gliner_multi \
  --output tools/pii-bench/results/2026-11-17/gliner_multi.json
/private/tmp/dari-pii-bench-venv/bin/python tools/pii-bench/summarize.py tools/pii-bench/results/2026-11-17
```

Allow several GB of disk space for weights, tokenizers, and packages. No Hugging Face token was used in the recorded run. Temporary caches can be removed separately from the recorded JSON results when no longer needed.

## Interpretation

- 42 short examples across ko/en/fr/ru/ar/fa. Each language has five positive identifier examples, one negative event-date example, and one sensitive-attribute probe.
- The identifier track contains 78 annotated occurrences across six concepts. A repeated name counts each time. Coverage ignores whitespace but requires every other character in the annotated span; label correctness is not part of this masking metric.
- Full-span coverage is deliberately conservative. For example, the Russian DOB gold includes the grammatical word `года`; leaving that word counts as a boundary miss even when the actual birth date was detected. Inspect raw predictions rather than equating every boundary miss with an equally severe privacy leak.
- Character precision measures excess redaction. Positive samples with no remaining gold characters are counted separately from negative samples, so empty inputs cannot inflate leak-free positive counts.
- GLiNER thresholds 0.3 and 0.5 are fixed exploratory settings, not separately calibrated thresholds or independent test-set selection. The GLiNER variants use their model-specific label names for the same identifier concepts.
- Sensitive probes add `religion`, `political party`, and `medical condition` labels to the GLiNER models. For models without those trained labels, these are zero-shot probes. Privacy Filter has no corresponding released label policy and is recorded as unsupported, not assigned a fabricated score.
- Privacy Filter uses the Hugging Face FP32 model and fast tokenizer with an adapter implementing BIOES-constrained Viterbi and the released zero transition biases. It does not use naive per-token argmax or the generic pipeline's BIO aggregation. Its native OPF runtime is not measured. The adapter was also compared with the official default decoder at commit `f7f00ca7fb869683eb732c010299d901457f19c3` on 100 seeded random sequences of lengths 1–100; paths matched.
- Each input is run twice after warmup. CPU inference timings include tokenization and decoding but exclude download and model initialization. Download activity in the background may add system noise. These are short-input timings on one Mac, not throughput or phone estimates.
- No long-context, chunk-boundary, misspelling, transliteration, adversarial, or real refugee narrative validation has been performed. No downstream draft quality or placeholder restoration is measured here.

Recorded model outputs contain only these synthetic fixtures, spans, latency, memory, package versions, revision IDs, and any errors. A provider API key is needed only for a later end-to-end test that actually calls that provider's external LLM.

## Expanded comparison: LiquidAI and nym

`expanded.py` retains the original 42 inputs and adds 48 cases. The dataset has 66 short identifier cases, 12 sensitive-attribute cases, and 12 length/boundary cases across the same six languages. Long inputs use repeated neutral filler with identifiers at the beginning, middle, and end; they test truncation/segmentation and do not represent diverse natural testimony. Forty-two explicitly protected spans test incident-date and negation preservation.

The new checkpoints are pinned in `compare.py`. LiquidAI's custom `modeling_phase2_tc.py`, `pii_hybrid_decode.py`, and `context_cued.py` were read before use. Models and helpers are stored in the temporary Hugging Face cache; no weights are added to this repository. After downloading the public root `.json`, `.safetensors`, and `.py` assets at the pinned revisions, inference runs offline:

```sh
export HF_HOME=/private/tmp/dari-pii-bench-cache
export HF_MODULES_CACHE=/private/tmp/dari-pii-bench-modules
export HF_HUB_OFFLINE=1
/private/tmp/dari-pii-bench-venv/bin/python tools/pii-bench/compare.py \
  --model liquid --output tools/pii-bench/results/2026-11-18/liquid_raw.json
/private/tmp/dari-pii-bench-venv/bin/python tools/pii-bench/compare.py \
  --model nym --output tools/pii-bench/results/2026-11-18/nym.json
/private/tmp/dari-pii-bench-venv/bin/python tools/pii-bench/compare.py \
  --model gliner --output tools/pii-bench/results/2026-11-18/gliner.json
```

Use `replay_hybrid.py` to apply the pinned LiquidAI postprocessor to the saved raw predictions, passing its downloaded snapshot directory as `--model-dir`. This avoids redundant inference. For long chunked inputs the helper sees the whole text after the raw model windows are combined. The reported hybrid latency is the recorded model latency plus separately measured postprocessing time, not a second independent end-to-end run.

```sh
/private/tmp/dari-pii-bench-venv/bin/python tools/pii-bench/replay_hybrid.py \
  tools/pii-bench/results/2026-11-18/liquid_raw.json \
  --model-dir /private/tmp/dari-pii-bench-cache/hub/models--LiquidAI--LFM2.5-Encoder-350M-PII-Detector/snapshots/b8c9cf3d2d6ae52501b35a27ba46f271449c9ce2 \
  --output tools/pii-bench/results/2026-11-18/liquid_hybrid.json
/private/tmp/dari-pii-bench-venv/bin/python tools/pii-bench/report_expanded.py tools/pii-bench/results/2026-11-18
```

Whole-text and overlapping-window results are separate. Windows are shared across models (220 Unicode characters with 80-character overlap); the policy is intentionally conservative and has not been optimized. No silent tokenizer truncation is allowed in the new HF adapters. GLiNER's native full-input behavior is recorded as is.

Only the common identifier taxonomy is scored in the identifier track; all model-native predictions are retained for review. Religious/political/medical spans are a separate track, where nym is explicitly unsupported. Full-span coverage, letter/digit-only coverage, character precision/recall, positive-case leakage, and protected-span damage are all reported.

One annotation-only correction added two repeated Korean surname/given-name spans. The inference strings were unchanged. The initial fixture file and correction log are retained, and the first Liquid raw results were rescored rather than rerun. The original 42 cases were not altered.

LiquidAI's low scores triggered a compatibility check. `probe_liquid_version.py` ran 12 original inputs (ordinary and sensitive for all six languages) under the existing Transformers 5.22.2 and the checkpoint-declared 5.11.0 in a separate temporary package target. Input tokens, argmax tags, spans, and numeric logits matched exactly on those inputs (max absolute difference 0). This was a targeted check, not a rerun of the full corpus under 5.11.0. The JSON probe outputs and comparison are retained in the expanded result directory; intermediate numeric arrays stayed in `/private/tmp`.
