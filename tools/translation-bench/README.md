# Local application translation comparison

The test data are 97 fictional Russian answers previously entered in the
application UI. No real applicant data or external LLM API is used.
`compare.py` tests the same 24 sentence/narrative cases, including the failures
seen in the Word export. The draft Korean references are evaluation aids written
for this experiment, not certified translations. Raw output remains uncorrected.

## Measured result 2026-11-22

| Model | Total for 24 answers | Unchanged Russian answers | Observed issue |
|---|---:|---:|---|
| Qwen3 4B Q4_K_M | 28.54 s | 12 | Copied sentences, invented place name, broken minor-child answer |
| Hy-MT2 1.8B Q4_K_M | 12.08 s | 0 | Best of these runs; passport/consulate terminology and modality still need context |
| M2M100 418M FP32 | 18.16 s | 0 | Consulate direction reversed, pushing changed to shaking |
| NLLB 600M FP32 | 20.15 s | 0 | Not applicable changed to invalid; UNHCR changed to UN Security Council |

Selected for the **Mac browser preview**: Hy-MT2 with question context and
terminology references. All 97 fixture items took 36.98 s through the production
local endpoint, including 69 model calls, 14 choice mappings and 14 values kept
verbatim. No requests failed and no sentence stayed untranslated. This does not
mean the answers are factually correct: question 15 still misreads software
testing as appendix review; question 14.13 adds an age threshold from the question.
The current fixture was updated in the UI and its Word download was checked:
all 83 non-choice answers are present, with Cyrillic only in the four preserved
personal-name fields. See `results/2026-11-22/summary.json` for limitations and
inspection notes. Do not equate these results with a phone benchmark.

## Reproduce

Use a separate Python environment with `torch`, `transformers<5`,
`sentencepiece` and `sacrebleu`. On this Mac the tested versions were Torch
2.15.0, Transformers 4.57.6, SentencePiece 0.2.3 and SacreBLEU 2.6.0.
Set `HF_HOME` to a writable model cache. Download the official
[Hy-MT2 GGUF](https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF) Q4_K_M file,
then register an Ollama Modelfile:

```text
FROM /absolute/path/Hy-MT2-1.8B-Q4_K_M.gguf
PARAMETER temperature 0
PARAMETER num_ctx 4096
```

```sh
ollama create dari-hymt2:1.8b -f /absolute/path/Modelfile
python tools/translation-bench/compare.py --model qwen3:4b
python tools/translation-bench/compare.py --model dari-hymt2:1.8b
python tools/translation-bench/compare.py --model facebook/m2m100_418M
python tools/translation-bench/compare.py --model facebook/nllb-200-distilled-600M
```

Run sequentially so the models do not compete for GPU resources. The measured
machine is an Apple M1 Pro with 16 GiB unified memory. Ollama uses Q4_K_M Metal;
M2M100 and NLLB use Transformers MPS FP32 with sentence splitting and beam width
4. These are practical runtime comparisons, not matched-precision architectural
benchmarks. The `m2m100-initial-unsplit.json` result is a failed setup retained
for diagnosis; do not use it as the final M2M100 result. It omitted later sentences.

Per-model elapsed times exclude one warmup request and model downloads/loading.
`cold_load_seconds` is Transformers initialization when recorded, not a guaranteed
cache-free measurement. All results are single runs, not a latency distribution.
chrF uses one approximate reference per case and must not be interpreted as a
factual accuracy percentage. `no_hangul`/`copied_source` counts obvious failures,
not omissions, mistranslations or hallucinations.

## Complete production pipeline

After starting the loopback server with the specialist registered:

```sh
DARI_TRANSLATION_MODEL=dari-hymt2:1.8b python local_verification_server.py
python tools/translation-bench/pipeline.py
```

This uses all 97 items, preserves 14 names/dates/email/code values verbatim,
maps 14 predefined choices, and makes 69 local model calls. The production
prompt additionally supplies the question context and relevant travel-document
or UNHCR terminology. Its timing is separate from the raw 24-case comparison.
It excludes DOCX packaging and UI clicks. Zero untranslated sentences does not
mean zero semantic errors. The original raw results and the production results
are kept separately under `results/2026-11-22/`.

Hy-MT2 uses Apache 2.0 and M2M100 uses MIT. NLLB's official model card specifies
CC-BY-NC 4.0, research use, and excludes production, legal-domain and document
translation from its intended use; it is an experimental comparator only.
The mobile LiteRT model has not been replaced or benchmarked on a phone here.

## Fixed question profile experiment

`production-hymt2-full.json` is the previous question-text prompt baseline.
`production-hymt2-profile-v1.json` uses the fixed ID-to-subject registry and scoped
terminology. `profile-v1-holdouts.json` preserves before/after output on 17 new
counterexamples (actual versus fictional statements, software versus attachments,
known versus unknown police, direct versus reported events, accompanying children
versus children elsewhere, facts versus reported deadlines). These are inspected
examples, not a certified quality score or a training dataset.

```sh
python tools/translation-bench/pipeline.py
python tools/translation-bench/profile_holdouts.py
```

The initial verbose-profile attempt is retained in `profile-initial-full.json`
and `profile-initial-holdouts.json`. It regressed ethnicity translation and
leaked a question subject into an appendix answer; it is not the deployed prompt.
The final prompt deliberately limits fixed context to short subjects and scoped
phrase translations. No weights were fine-tuned and no additional LLM review
call was added. Check the raw output for remaining semantic errors.

Official model sources:

- https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF
- https://huggingface.co/facebook/m2m100_418M
- https://huggingface.co/facebook/nllb-200-distilled-600M

## Repeated mock scenarios

`scenarios/russian-v4.json` contains 10 fictional scenarios with 80 answer items:
solo travel and family elsewhere; accompanying children; hearsay and uncertainty;
prior asylum applications; document loss/issuance; ethnicity, religion and health;
chronology and corrections; attachments, software and quoted instructions; and
additional counterexamples. Each scene has 2 original-preservation values and 6
model-translated answers. No real applicant records are read.

```sh
python tools/translation-bench/repeat_scenarios.py \
  --dataset tools/translation-bench/scenarios/russian-v4.json \
  --rounds 3 --output /absolute/path/new-scenario-run
node --experimental-strip-types tools/translation-bench/check_scenario_exports.mjs \
  /absolute/path/new-scenario-run
```

Every round shuffles input order with a recorded seed. The runner records every
response, request error, rule flag, latency and variation across repetitions.
`--resume` continues an interrupted directory only when dataset, prompt, model
digest, runner, preservation rules, seed and round count match. Failed requests
are recorded, not silently retried. Warmup time is separate. Keep output folders
distinct when changing prompts or criteria. Word checks retain all answer text
and 22 original pages in memory; they do not validate visual layout or semantics.

The initial v1 experiment produced false flags for Korean inflection variants;
its raw output was also inspected directly. This exposed errors not caught by
the original rules: inferred sibling age/speaker gender, source statements turned
into questions, and software/attachment ambiguity within one answer. V2 added
those review checks and new examples; after inspection these are regression
cases in V3, not an untouched independent test set. V2 and V3 comparisons must
use their recorded criteria; flag totals are not comparable accuracy scores.

Rule flags are a review queue. No flags does **not** mean a verified correct
translation. Expectations and qualitative review are authored by the coding
assistant and need independent bilingual validation before quality claims.
All measurements here are Russian-to-Korean on the Mac browser path, not phone
performance or multilingual coverage.

V4 adds one new scenario after the v2 prompt was frozen. Its six model-translated
answers are an untouched holdout for this run; no prompt changes are made from
that result. Earlier V1–V3 cases are regression data and retain their separate
raw result folders. The final evaluation is `scenarios-v4-evaluation/`.

### Recorded outcome

Four development/evaluation iterations produced 864 item observations in total.
The final V4 run contains 80 items × 3 rounds = 240 observations (180 model calls,
60 original-preservation checks). Request failures and rule-flagged outputs were
both zero. Round totals were 27.779 s, 27.300 s and 25.630 s; warmup is separate.
Two items varied in wording across rounds; inspection found no corresponding
change to the checked uncertainty/negation facts. A separate in-memory export
check retained all 80 answers across 10 scenarios and all 22 source page assets.

For the 64 original cases, rescoring the initial outputs with the final rules
flags five cases (15 observations): invented kinship distinctions and a statement
turned into a question. This is a review comparison, not an accuracy estimate.
See `scenarios-v4-evaluation/assessment.json` for the inspection notes, provenance
and remaining limits. No independent bilingual validation is claimed.
