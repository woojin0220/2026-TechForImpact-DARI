from dataclasses import replace
import math
import unittest

from dari_verification import (
    Component,
    ContractViolation,
    EvidenceSpan,
    Finding,
    Provenance,
    ReportError,
    VerificationCase,
    VerificationReport,
)

from tests.support import TEST_COMMIT, sample_finding, valid_payload


def provenance() -> Provenance:
    return Provenance(
        pipeline_version="0.1.0",
        dataset_version="fixtures-v1",
        dataset_digest="c" * 64,
        git_commit=TEST_COMMIT,
        config_digest="a" * 64,
        experiment_fingerprint="b" * 64,
        components=(Component(id="scripted", version="1.0"),),
        random_seed=7,
        hardware_class="test",
        started_at="2026-10-12T12:00:00Z",
        duration_ms=10,
    )


class InputContractTests(unittest.TestCase):
    def test_valid_input_round_trips_without_changing_text(self):
        payload = valid_payload(source_text="어머니는 \"기다려\"라고 말했다.\nثم غادرت.")
        case = VerificationCase.from_mapping(payload)
        self.assertEqual(case.to_dict(), payload)

    def test_unknown_input_field_is_rejected(self):
        payload = valid_payload()
        payload["gold_hint"] = "certainty_shift"
        with self.assertRaisesRegex(ContractViolation, "unknown gold_hint"):
            VerificationCase.from_mapping(payload)

    def test_enum_fields_reject_non_string_json_values(self):
        payload = valid_payload()
        payload["data_classification"] = []
        with self.assertRaises(ContractViolation) as caught:
            VerificationCase.from_mapping(payload)
        self.assertEqual(caught.exception.code, "invalid_classification")

        with self.assertRaises(ContractViolation) as caught:
            EvidenceSpan([], "source:0", 0, 1, "x")
        self.assertEqual(caught.exception.code, "invalid_document")

        finding = sample_finding(valid_payload())
        with self.assertRaises(ContractViolation) as caught:
            replace(finding, type=[])
        self.assertEqual(caught.exception.code, "invalid_finding_type")

    def test_empty_text_and_invalid_language_are_rejected(self):
        for text in ("", " \r\n\t"):
            empty = valid_payload()
            empty["source"]["text"] = text
            with self.subTest(text=repr(text)), self.assertRaises(ContractViolation):
                VerificationCase.from_mapping(empty)

        invalid_language = valid_payload()
        invalid_language["source"]["language"] = "Korean language"
        with self.assertRaises(ContractViolation):
            VerificationCase.from_mapping(invalid_language)


class EvidenceContractTests(unittest.TestCase):
    def test_unicode_and_rtl_offsets_are_checked_against_original_text(self):
        payload = valid_payload(
            source_text="첫 줄\r\n그는 말했다: مَرْحَبًا 👋 e\u0301",
            translation_text="First line\r\nHe said: hello 👋 é",
        )
        case = VerificationCase.from_mapping(payload)
        quote = "مَرْحَبًا 👋"
        start = case.source.text.index(quote)
        evidence = EvidenceSpan("source", "source:0", start, start + len(quote), quote)
        evidence.validate_against(case, expected_document="source")

    def test_bool_and_non_finite_confidence_are_rejected(self):
        finding = sample_finding(valid_payload())
        for confidence in (True, math.nan, math.inf, -math.inf):
            with self.subTest(confidence=confidence), self.assertRaises(ContractViolation):
                replace(finding, confidence=confidence)

    def test_wrong_document_and_stale_quote_are_rejected(self):
        case = VerificationCase.from_mapping(valid_payload())
        wrong_document = EvidenceSpan("translation", "source:0", 0, 1, "A")
        with self.assertRaisesRegex(ContractViolation, "must refer to source"):
            wrong_document.validate_against(case, expected_document="source")

        stale = EvidenceSpan("source", "source:0", 0, 2, "없는")
        with self.assertRaisesRegex(ContractViolation, "span does not match"):
            stale.validate_against(case, expected_document="source")

    def test_missing_side_requires_an_explicit_reason(self):
        payload = valid_payload()
        source_text = payload["source"]["text"]
        source_span = EvidenceSpan("source", "source:0", 0, len(source_text), source_text)
        with self.assertRaisesRegex(ContractViolation, "evidence_absence_reason"):
            Finding(
                finding_id="omission-1",
                type="omission",
                related_types=(),
                change="removed",
                severity="high",
                source_span=source_span,
                translation_span=None,
                evidence_absence_reason=None,
                confidence=0.7,
                status="candidate",
                detectors=(Component(id="scripted", version="1.0"),),
                rationale="The event is absent from the translation.",
            )

    def test_finding_type_controls_evidence_shape(self):
        payload = valid_payload()
        base = sample_finding(payload)
        with self.assertRaisesRegex(ContractViolation, "omission requires"):
            replace(base, type="omission", change="removed")
        with self.assertRaisesRegex(ContractViolation, "unsupported_addition requires"):
            replace(base, type="unsupported_addition", change="added")
        with self.assertRaisesRegex(ContractViolation, "requires evidence from both"):
            replace(
                base,
                translation_span=None,
                evidence_absence_reason="The translation side is absent.",
            )


class ReportStateTests(unittest.TestCase):
    def test_completed_cannot_hide_an_active_finding(self):
        finding = sample_finding(valid_payload())
        with self.assertRaisesRegex(ContractViolation, "completed"):
            VerificationReport(
                run_id="run-1",
                case_id="case-001",
                strategy_id="scripted",
                status="completed",
                findings=(finding,),
                errors=(),
                provenance=provenance(),
            )

    def test_issues_found_requires_an_active_finding(self):
        with self.assertRaisesRegex(ContractViolation, "issues_found"):
            VerificationReport(
                run_id="run-1",
                case_id="case-001",
                strategy_id="scripted",
                status="issues_found",
                findings=(),
                errors=(),
                provenance=provenance(),
            )

    def test_indeterminate_and_invalid_input_require_errors(self):
        for status in ("indeterminate", "invalid_input"):
            with self.subTest(status=status), self.assertRaisesRegex(ContractViolation, status):
                VerificationReport(
                    run_id="run-1",
                    case_id=None,
                    strategy_id="scripted",
                    status=status,
                    findings=(),
                    errors=(),
                    provenance=provenance(),
                )

    def test_invalid_input_can_report_a_missing_case_id(self):
        report = VerificationReport(
            run_id="run-1",
            case_id=None,
            strategy_id="scripted",
            status="invalid_input",
            findings=(),
            errors=(ReportError("missing_field", "input", "Input contract failed.", False),),
            provenance=provenance(),
        )
        self.assertIsNone(report.to_dict()["case_id"])

    def test_abstention_requires_indeterminate_status(self):
        finding = sample_finding(valid_payload(), status="abstained", confidence=None)
        error = ReportError("strategy_abstained", "verification", "Strategy abstained.", False)
        for status, errors in (("completed", ()), ("issues_found", ())):
            with self.subTest(status=status), self.assertRaises(ContractViolation):
                VerificationReport(
                    run_id="run-1",
                    case_id="case-001",
                    strategy_id="scripted",
                    status=status,
                    findings=(finding,),
                    errors=errors,
                    provenance=provenance(),
                )
        report = VerificationReport(
            run_id="run-1",
            case_id="case-001",
            strategy_id="scripted",
            status="indeterminate",
            findings=(finding,),
            errors=(error,),
            provenance=provenance(),
        )
        self.assertEqual(report.status, "indeterminate")

    def test_report_case_id_and_started_at_are_strict(self):
        with self.assertRaisesRegex(ContractViolation, "report.case_id"):
            VerificationReport(
                run_id="run-1",
                case_id="-invalid",
                strategy_id="scripted",
                status="completed",
                findings=(),
                errors=(),
                provenance=provenance(),
            )
        with self.assertRaisesRegex(ContractViolation, "UTC offset"):
            replace(provenance(), started_at="2026-10-12T12:00:00")


if __name__ == "__main__":
    unittest.main()
