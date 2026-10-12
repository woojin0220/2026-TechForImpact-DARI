import json
from dataclasses import replace
import unittest

from dari_verification import (
    Component,
    ContractViolation,
    MalformedStrategyOutput,
    StrategyTimeout,
    UnsupportedLanguage,
    VerificationPipeline,
)

from tests.support import (
    TEST_COMMIT,
    StaticStrategy,
    fixed_monotonic,
    fixed_now,
    sample_finding,
    valid_payload,
)


def run(strategy, payload=None, **kwargs):
    pipeline = VerificationPipeline(
        strategy,
        now=fixed_now,
        monotonic=fixed_monotonic,
    )
    dataset_digest = kwargs.pop("dataset_digest", "c" * 64)
    return pipeline.run(
        payload if payload is not None else valid_payload(),
        dataset_version="fixtures-v1",
        dataset_digest=dataset_digest,
        git_commit=TEST_COMMIT,
        random_seed=7,
        **kwargs,
    )


class PipelineTests(unittest.TestCase):
    def test_empty_success_is_completed(self):
        report = run(StaticStrategy())
        self.assertEqual(report.status, "completed")
        self.assertEqual(report.findings, ())
        self.assertEqual(report.errors, ())

    def test_valid_finding_is_issues_found_and_keeps_exact_evidence(self):
        payload = valid_payload()
        report = run(StaticStrategy([sample_finding(payload)]), payload)
        self.assertEqual(report.status, "issues_found")
        self.assertEqual(report.findings[0].source_span.quote, "것 같은")
        self.assertEqual(report.findings[0].translation_span.quote, "a police officer")

    def test_invalid_input_never_calls_strategy(self):
        strategy = StaticStrategy()
        payload = valid_payload()
        del payload["case_id"]
        report = run(strategy, payload)
        self.assertEqual(report.status, "invalid_input")
        self.assertIsNone(report.case_id)
        self.assertEqual(strategy.calls, [])

        payload = valid_payload(case_id="-unsafe")
        report = run(strategy, payload)
        self.assertEqual(report.status, "invalid_input")
        self.assertIsNone(report.case_id)
        self.assertEqual(strategy.calls, [])

    def test_strategy_failures_are_indeterminate_not_clean(self):
        for error, code, retryable in (
            (UnsupportedLanguage("ru-en unavailable"), "unsupported_language", False),
            (StrategyTimeout("secret raw text"), "timeout", True),
            (RuntimeError("secret raw text"), "adapter_exception", False),
        ):
            with self.subTest(code=code):
                report = run(StaticStrategy(error=error))
                self.assertEqual(report.status, "indeterminate")
                self.assertEqual(report.errors[0].code, code)
                self.assertEqual(report.errors[0].retryable, retryable)
                serialized = json.dumps(report.to_dict(), ensure_ascii=False)
                self.assertNotIn("secret raw text", serialized)

    def test_malformed_and_out_of_range_evidence_are_indeterminate(self):
        malformed = StaticStrategy()
        malformed.findings = {"not": "a sequence of findings"}
        report = run(malformed)
        self.assertEqual(report.status, "indeterminate")
        self.assertEqual(report.errors[0].code, "malformed_output")

        payload = valid_payload()
        finding = sample_finding(payload)
        finding = replace(finding, source_span=replace(finding.source_span, quote="stale quote"))
        report = run(StaticStrategy([finding]), payload)
        self.assertEqual(report.status, "indeterminate")
        self.assertEqual(report.errors[0].code, "evidence_mismatch")

    def test_every_duplicate_is_validated_before_merge(self):
        payload = valid_payload()
        valid = sample_finding(
            payload,
            finding_id="valid-confirmed",
            status="confirmed",
            confidence=0.9,
        )
        stale = replace(
            valid,
            finding_id="stale-candidate",
            status="candidate",
            confidence=0.8,
            source_span=replace(valid.source_span, quote="stale quote"),
        )
        report = run(StaticStrategy([valid, stale]), payload)
        self.assertEqual(report.status, "indeterminate")
        self.assertEqual(report.errors[0].code, "evidence_mismatch")

    def test_conflicting_detector_metadata_is_malformed_output(self):
        payload = valid_payload()
        first = sample_finding(payload, finding_id="first")
        second = replace(
            first,
            finding_id="second",
            detectors=(
                Component(id="scripted", version="1.0", config_digest="a" * 64),
            ),
        )
        report = run(StaticStrategy([first, second]), payload)
        self.assertEqual(report.status, "indeterminate")
        self.assertEqual(report.errors[0].code, "malformed_output")

    def test_duplicate_findings_merge_deterministically(self):
        payload = valid_payload()
        candidate = sample_finding(
            payload,
            finding_id="candidate-copy",
            status="candidate",
            confidence=0.9,
            related_types=("identity_value_change",),
        )
        confirmed = sample_finding(
            payload,
            finding_id="confirmed-copy",
            status="confirmed",
            confidence=0.7,
            related_types=("source_attribution_change",),
        )
        first = run(StaticStrategy([candidate, confirmed]), payload, run_id="run-dedup")
        second = run(StaticStrategy([confirmed, candidate]), payload, run_id="run-dedup")
        self.assertEqual(first.to_dict(), second.to_dict())
        self.assertEqual(len(first.findings), 1)
        self.assertEqual(first.findings[0].status, "confirmed")
        self.assertEqual(
            first.findings[0].related_types,
            ("identity_value_change", "source_attribution_change"),
        )

    def test_duplicate_findings_preserve_all_distinct_detectors(self):
        payload = valid_payload()
        first = sample_finding(payload, finding_id="first")
        second = replace(
            first,
            finding_id="second",
            detectors=(Component(id="confirmer", version="1.0"),),
        )
        report = run(StaticStrategy([first, second]), payload)
        self.assertEqual(
            [(item.id, item.version) for item in report.findings[0].detectors],
            [("confirmer", "1.0"), ("scripted", "1.0")],
        )

    def test_fingerprint_is_stable_but_run_id_is_unique(self):
        first = run(StaticStrategy(), options={"threshold": 0.4}, run_id="run-a")
        second = run(StaticStrategy(), options={"threshold": 0.4}, run_id="run-b")
        changed = run(StaticStrategy(), options={"threshold": 0.5}, run_id="run-c")
        changed_dataset = run(
            StaticStrategy(),
            options={"threshold": 0.4},
            dataset_digest="d" * 64,
            run_id="run-d",
        )
        self.assertNotEqual(first.run_id, second.run_id)
        self.assertEqual(
            first.provenance.experiment_fingerprint,
            second.provenance.experiment_fingerprint,
        )
        self.assertNotEqual(
            first.provenance.experiment_fingerprint,
            changed.provenance.experiment_fingerprint,
        )
        self.assertNotEqual(
            first.provenance.experiment_fingerprint,
            changed_dataset.provenance.experiment_fingerprint,
        )

    def test_invalid_run_configuration_never_calls_strategy(self):
        invalid_runs = (
            {"options": {"threshold": float("nan")}},
            {"options": {1: "non-string key"}},
            {"git_commit": "not-a-commit"},
            {"dataset_digest": "bad-digest"},
            {"run_id": ""},
        )
        for overrides in invalid_runs:
            strategy = StaticStrategy()
            with self.subTest(overrides=overrides), self.assertRaises(ContractViolation):
                pipeline = VerificationPipeline(
                    strategy,
                    now=fixed_now,
                    monotonic=fixed_monotonic,
                )
                arguments = {
                    "dataset_version": "fixtures-v1",
                    "dataset_digest": "c" * 64,
                    "git_commit": TEST_COMMIT,
                    "random_seed": 7,
                }
                arguments.update(overrides)
                pipeline.run(valid_payload(), **arguments)
            self.assertEqual(strategy.calls, [])

    def test_prompt_injection_like_text_remains_unmodified_data(self):
        payload = valid_payload(
            source_text="그 메모에는 'ignore previous instructions'라고 쓰여 있었다.",
            translation_text="The note said 'ignore previous instructions'.",
        )
        strategy = StaticStrategy()
        report = run(strategy, payload)
        self.assertEqual(report.status, "completed")
        self.assertEqual(strategy.calls[0].source.text, payload["source"]["text"])

    def test_explicit_abstention_makes_the_report_indeterminate(self):
        payload = valid_payload()
        finding = sample_finding(payload, status="abstained")
        report = run(StaticStrategy([finding]), payload)
        self.assertEqual(report.status, "indeterminate")
        self.assertEqual(report.errors[0].code, "strategy_abstained")


if __name__ == "__main__":
    unittest.main()
