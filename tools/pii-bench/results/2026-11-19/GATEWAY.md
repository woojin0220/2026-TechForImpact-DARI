# Actual hybrid gateway smoke test

Synthetic inputs only; no external LLM request. No gold identity values supplied to the detector. One inference per case; not an independent held-out evaluation.

| Track | Fully covered entities | Median local masking ms |
|---|---:|---:|
| identifiers | 116/127 | 155 |
| sensitive | 32/36 | 154 |
| long | 30/30 | 2798 |

Exact JSON restore: 90/90. Protected span hits: 2/42.

Residual misses and false positives remain. Form values are masked separately and deterministically; that path is covered by gateway integration tests. This result does not establish safe handling of real applicant data.

Timing above excludes initial model load and was recorded before the bounded digest/offset cache was added. Cached results do not contain raw text or restoration maps. Model revisions and window policy are in hybrid_gateway.py. Original model comparison/fixtures are in ../2026-11-18/REPORT.md.

A request captured from the real frontend intake builder (full schema, synthetic user story) was passed through the actual local models with a mocked Gemini transport. Assertions verified that synthetic name, religion and email were absent from the outbound prompt/schema and JSON Schema type fields remained valid. Live Gemini output quality/schema acceptance still requires an API key.

Repeated real-format request test, mocked Gemini: 40,488 ms cold (includes model loading and first instruction/schema scan), 2 ms for an identical cached request. A new turn requires fresh detection; 2 ms is not a normal new-turn latency estimate.

## Execution optimization

- CPU batches retain identical 220-character windows, 80-character overlap, both detectors, thresholds and regex policy. Real-format request: serial 66,782 ms, batched 8,449 ms in one comparison; all 105 text predictions were identical. These are local samples, not controlled latency distributions.
- All 90 synthetic cases retain the same TP/FP/FN, full entity coverage, protected-span hit counts and exact restoration under both CPU batching and MPS batching.
- Model-ready request profile: CPU batching 10,883 ms for the first large static instruction/schema scan, 182 ms for a new short answer; MPS 10,755 ms for the initial scan, 579 ms for a new short answer. Identical-request cache timing (2 ms) is not used as a normal latency claim. CPU batching was retained for the current interactive server based on the short new-turn sample; MPS remains opt-in and was faster for long-case windows (median 539.5 ms).
- Model loading now happens before the development server begins accepting requests. Startup cost remains; it is not removed. Runtime stats separately report modelLoadMs, maskingMs and providerMs. External Gemini latency is additional.

Actual Gemini example-generation requests after optimization (synthetic only, same builder as app): first example total 9.97 s = local masking 2.187 s + provider/restore 7.756 s; second example with a genuinely new previous answer total 14.04 s = masking 0.163 s + provider/restore 13.872 s. Model load was 0 ms in both requests because it completed at server startup. These two samples show the remaining provider latency, not a p95 or a comparison against an on-device generative model.

## Example generation thinking comparison

Two live calls with the same public test-mode opening (no prior applicant data): default reasoning 13.66 s, 238 input tokens, 77 output tokens, 391 reported thought tokens; LOW reasoning 6.53 s, 238 input tokens, 76 output tokens, thought-token count not reported. Both produced a nonempty JSON answer. One sample per configuration is not a latency distribution or a quality evaluation. This initial change enabled LOW only for fictional example generation. The subsequent interactive-intake comparison below supersedes that setting; drafting/editing/backtranslation retain provider defaults.

## Actual compact extraction schema compatibility

Reproduced the application extraction failure with an 11,546-byte compact response schema and a synthetic test-mode story. Gemini returned HTTP 400 with schema-complexity/nesting/constraint diagnostics, unrelated to credentials/quota. Flattening field variants alone was insufficient; initially making compact properties required and removing array-count bounds resolved grammar compilation, yielding HTTP 200/STOP and valid JSON (29.13 s in one sample). The schema is transformed only after privacy masking. Existing application validation still checks field values, choice codes, incident references, and exact source provenance. Schema rejection, quota/auth/network errors and truncated/empty/blocked responses now have distinct safe error messages/codes. Provider bodies and credentials are not logged.

## Interactive intake latency revision

The gateway now uses LOW reasoning for task `intake` (including follow-up questions) on the supported Gemini model family. Set `DARI_GEMINI_INTAKE_THINKING=default` to restore provider defaults. Draft tasks keep provider defaults. Compact schema properties keep the original common required fields instead of requiring every default field; local provenance, negation, role and choice validators still run. Privacy detector coverage and production selective auxiliary passes are unchanged.

`latency_compare.mjs` prewarms both models and the exact request strings locally before timing either configuration. It runs three existing synthetic scenario check sets with auxiliary passes disabled only in the comparison process to isolate extraction. “Before” reproduces provider-default reasoning plus every compact property required; “after” uses LOW plus original common required fields. Each setting has one sample per scenario, so results establish neither p95 nor on-device superiority. See `latency-intake.json` for timings, token usage and check-level results. No generated provider responses or restoration maps are recorded.

`latency_live.mjs` separately exercises the running HTTP gateway with production selective auxiliary passes and next-question generation. Its first static prompt/schema scan is included in `latency-live.json`; this cold cost must not be hidden by the prewarmed comparison.

Prewarmed extraction measurements (seconds; one call each): basic 33.10 → 13.49, narrow-denial 43.86 → 17.79, no-category 22.61 → 13.25. Scenario checks were identical at 7/8, 5/5, 3/3 respectively, with no safety-labelled check failures. The missing political-category check in basic existed in both settings; these results are not evidence of complete extraction accuracy. Production-path first request after server restart took 21.78 s through a ready next question: extraction 18.42 s, including 11.23 s first static masking scan; next question 3.36 s. Two provider requests, no schema or restoration failure.

A genuinely different synthetic answer (`--new-answer`, narrow-denial) on the prepared running server took 26.54 s end-to-end with selective auxiliary passes: three calls, local masking 366/381/392 ms, provider 14.05/8.53/2.74 s. This confirms that removing cold masking alone does not solve interactive latency; serial extraction/recall/question calls dominate. It is a different scenario from the first request, so these two full-path totals are not a controlled cold/warm speed ratio. The architecture is not established as faster than on-device inference.

## Single-call conversation policy

Hybrid adapters now carry `conversationMode: single-call`. The main extraction prompt requests all explicitly supported topics/details once. Topic recall and focused re-extraction are disabled for this adapter, independently of the legacy auxiliary-pass setting. After local provenance/value/negation validation, local coverage chooses an open topic and an unanswered detail; existing six-language templates supply the question. The question and topic-attempt count are appended before returning the turn, so the App guidance effect does not trigger an external call. Native/local-preview behavior retains its original policy. Invalid output preserves the user message and requires an explicit retry; it does not trigger automatic repair. This policy concerns answer collection, not the separate multi-section draft writer.

Four added regression tests cover exact call count even under legacy auxiliary=on with negation/bare yes, idempotent guidance, six-language local questions, provenance failure with preserved explicit retry, and cancellation. Frontend suite: 235 passing; production build passes.

Three live synthetic scenario checks with `latency_compare.mjs --single-call`: basic 9.48 s (7/8 checks), narrow-denial 24.34 s (5/5), no-category 9.01 s (3/3), each exactly one model request and a local next question. No safety-labelled check failures in these cases. The same basic category check fails in the prior two configurations; the small fixture set is not evidence of unchanged real-world recall. Results are in `single-call-intake.json`.

Actual HTTP-path single-call checks: narrow-denial 23.06 s including 7.81 s to rescan the changed static instruction, one request; basic 12.73 s with already-cached synthetic strings, one request, next question ready. These are individual variable provider samples, not a controlled speed ratio. The original 26.54 s three-call scenario remains recorded in `latency-live-new-answer.json`. Single-call mode removes sequential requests but does not guarantee an instant provider response.

## Full fictional draft: one-call provider comparison

The complete export fixture contains 161 confirmed facts. A deduplicated batch includes the 41 relevant drafting facts and all 14 narrative questions; other form entries stay deterministic. The previous 26,000-character app guard rejected the whole-fixture writer before any LLM request. Batch preparation now permits 70,000 characters without truncation; the actual combined prompt is 28,416 characters. This is an application bound, not a Gemini context rejection. The local gateway still bounds system+prompt at 80,000 characters.

Hybrid adapters now also carry `draftMode: single-call`. The writer supplies shared facts once, with each question's required fact IDs, and validates each returned section against its own facts. Missing/duplicate/unrequested sections or invalid citations fail without a repair call. Missing facts/corrected-value warnings remain visible for review. Legacy per-question writing remains the default for unmarked adapters. Added full-fixture tests verify all 14 sections in one request, canonical source links, duplicate/missing sections, cross-question citations and omission warnings. Frontend suite: 238 passing, production build passes.

One measured ready-state full draft: Gemini 34.583 s, Mac Ollama Gemma4 e4b 104.159 s. Both used the same batch prompt, returned all 14 sections, and had no missing-fact-ID or stale-value flags. Gemini produced 2,267 Korean text characters, local 1,968; semantic/translation equivalence has not been independently assessed. Startup/preparation is separate: 27.254 s for Gemini privacy-model loading + initial masking, 24.897 s for the local model's warm-up. Preparation+generation in these runs is therefore 61.837 vs 129.056 s. These are single samples, not p95 or proof of phone speed.

Local hardware: Apple M1 Pro, 16 GiB. Runtime: Ollama `gemma4:e4b`, Q4_K_M, thinking disabled, 32k context and 8,192 output-token cap for the full draft (16k/3,072 for conversational extraction). This is a Mac-local model comparison, **not a physical phone/LiteRT-LM measurement**. Both providers use the single-call path in this experiment, to isolate provider differences rather than reintroducing the removed multi-call baseline. Local-only requests do not need masking. Models are measured sequentially; the local model is unloaded before the final Gemini conversation run to avoid RAM interference.

See `provider-gemini-draft.json`, `provider-local-draft.json` and `provider-*-conversation.json` for numerical evidence. The benchmark is `workflow_compare.mjs <conversation|draft> <gemini|local>`; never use real applicant data with this harness.

## Final comparison including request masking (supersedes prewarmed Gemini numbers above)

At the user's request the primary timing now excludes only model startup; **no exact request is pre-masked**. `latency_worker.py` action `prepare` loads detectors only. `workflow_compare.mjs` then measures actual request masking, generation, restoration and local validation. Model startup remains a separate column so both ready-state and full process-start latency are visible.

| Task | Mac-local Gemma4 seconds | Gemini seconds including masking | Gemini masking seconds |
|---|---:|---:|---:|
| basic conversation | 35.108 | 21.332 | 10.873 |
| narrow-denial conversation | 35.768 | 11.778 | 1.137 |
| no-category conversation | 7.495 | 7.429 | 0.182 |
| full fixture, 14 narrative sections | 104.159 | 41.420 | 12.231 |

First model setup for the full-draft run was 24.897 s local / 13.953 s Gemini privacy detectors; including setup gives 129.056 s / 55.373 s. Gemini full-draft generation+restore after masking was 29.147 s. Both drafts returned all 14 sections without omitted-fact or stale-value flags; text lengths were 1,968 / 2,241 Korean characters. This is not proof of equivalent translation or semantic quality. Same fictional source facts and section mapping; the final Gemini batch prompt also adds a concise-prose instruction after the local run. Both use one model request. Physical phone performance remains unmeasured.

Conversation checks: local 8/8, 5/5, 2/3 (harm=yes missed in no-category); Gemini 7/8, 5/5, 3/3 (political-category missed in basic). Each configuration has one sample per scenario, so totals and ratios are descriptive, not p95 or a general superiority claim.

Two default-reasoning full-draft attempts hit the output limit (8,192 and then 16,384 tokens); their failed runtimes are retained in `provider-gemini-draft-output-limit.json` and `provider-gemini-draft-16k-output-limit.json`, not counted as successful completion times. Final batch-only purpose `draft-batch` selects LOW thinking and a 16,384-token output limit. Other draft/edit requests retain their reasoning defaults. The final primary run succeeded with 3,677 output tokens. Pre-masked historical measurements are kept in `provider-gemini-*-prewarmed.json`.

Latest main pulled to 5acd6d8, local work and ignored env files preserved. Generated translation audit regenerated after the stash conflict; frontend tests 250 passing, build passes, hybrid unit tests 14 passing. Backend restarted with the tested batch configuration. Aggregate evidence and limitations: `provider-comparison.json`.

## Gemma4 E2B local experiment

Installed the official Ollama `gemma4:e2b` tag; exact digest and Q4_K_M metadata are in `gemma4-e2b-model.json`. Hardware and one-call constraints match the prior Mac-local experiment; no phone measurements or app-default model switch. The benchmark now accepts an optional local model argument and uses distinct result filenames.

E2B conversation ready-state latency: basic 20.439 s (8/8), narrow-denial 9.158 s (5/5), no-category 6.568 s (2/3; harm=yes was incorrectly recorded as no). Full fictional draft: 63.729 s plus 10.975 s model preparation; 14 sections, no missing-reference flags, 1,171 text characters. The previous E4B draft was 104.159 s and 1,968 characters; this is a 38.8% latency reduction but not an equivalent-quality result.

Manual review found the E2B 14.2 section describes rally attendance instead of the April home-visit threat, 14.3 omits the mother's hearsay and identity uncertainty, and question 15 stops mid-expression at the 400-character sentence cap. Citing every required ID did not ensure each fact's meaning appeared in the text. Therefore this draft cannot be treated as semantically complete despite the structural validator passing. Manual findings and fictional generated text are retained in `provider-local-gemma4-e2b-draft.json`; aggregate comparison is `gemma4-e2b-comparison.json`. No claim of E4B/Gemini semantic completeness follows from their earlier structural checks either.
