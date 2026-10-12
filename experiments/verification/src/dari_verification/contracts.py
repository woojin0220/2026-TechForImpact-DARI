from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import math
import re
from typing import Any, Mapping


SCHEMA_VERSION = "1.0"

FINDING_TYPES = frozenset(
    {
        "omission",
        "unsupported_addition",
        "negation_flip",
        "certainty_shift",
        "source_attribution_change",
        "actor_role_change",
        "identity_value_change",
        "temporal_change",
        "causality_change",
        "harm_strength_change",
    }
)
CHANGES = frozenset({"added", "removed", "changed", "swapped"})
SEVERITIES = frozenset({"low", "medium", "high", "critical"})
FINDING_STATUSES = frozenset({"candidate", "confirmed", "rejected", "abstained"})
REPORT_STATUSES = frozenset({"completed", "issues_found", "indeterminate", "invalid_input"})
DATA_CLASSIFICATIONS = frozenset({"synthetic", "deidentified_research"})

CASE_ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$")
LANGUAGE_RE = re.compile(r"^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$")
CODE_RE = re.compile(r"^[a-z][a-z0-9._-]{0,63}$")
GIT_COMMIT_RE = re.compile(r"^[0-9a-f]{7,40}$")
DIGEST_RE = re.compile(r"^[0-9a-f]{64}$")


class ContractViolation(ValueError):
    """A stable, non-sensitive description of a contract error."""

    def __init__(self, code: str, path: str, message: str):
        self.code = code
        self.path = path
        super().__init__(f"{path}: {message}")


def _object(value: Any, path: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ContractViolation("invalid_type", path, "must be an object")
    return value


def _strict_keys(
    value: Mapping[str, Any], *, required: set[str], optional: set[str], path: str
) -> None:
    missing = required - set(value)
    if missing:
        raise ContractViolation("missing_field", path, f"missing {sorted(missing)[0]}")
    unknown = set(value) - required - optional
    if unknown:
        raise ContractViolation("unknown_field", path, f"unknown {sorted(unknown)[0]}")


def _string(value: Any, path: str, *, minimum: int = 1, maximum: int) -> str:
    if not isinstance(value, str):
        raise ContractViolation("invalid_type", path, "must be a string")
    if not minimum <= len(value) <= maximum:
        raise ContractViolation("invalid_length", path, f"length must be {minimum}..{maximum}")
    return value


def _integer(value: Any, path: str, *, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise ContractViolation("invalid_integer", path, f"must be an integer >= {minimum}")
    return value


def _number(value: Any, path: str, *, minimum: float, maximum: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ContractViolation("invalid_number", path, "must be a number")
    result = float(value)
    if not math.isfinite(result) or not minimum <= result <= maximum:
        raise ContractViolation("invalid_number", path, f"must be between {minimum} and {maximum}")
    return result


@dataclass(frozen=True)
class TextDocument:
    language: str
    text: str

    @classmethod
    def from_mapping(cls, value: Any, path: str) -> "TextDocument":
        raw = _object(value, path)
        _strict_keys(raw, required={"language", "text"}, optional=set(), path=path)
        language = _string(raw["language"], f"{path}.language", maximum=32)
        if not LANGUAGE_RE.fullmatch(language):
            raise ContractViolation("invalid_language", f"{path}.language", "must be a BCP-47-like code")
        text = _string(raw["text"], f"{path}.text", maximum=20_000)
        if not text.strip():
            raise ContractViolation("blank_text", f"{path}.text", "must contain non-whitespace text")
        return cls(language=language, text=text)

    def to_dict(self) -> dict[str, Any]:
        return {"language": self.language, "text": self.text}


@dataclass(frozen=True)
class VerificationCase:
    case_id: str
    data_classification: str
    source: TextDocument
    translation: TextDocument
    context: Mapping[str, str] | None = None
    schema_version: str = SCHEMA_VERSION

    @classmethod
    def from_mapping(cls, value: Any) -> "VerificationCase":
        raw = _object(value, "input")
        _strict_keys(
            raw,
            required={"schema_version", "case_id", "data_classification", "source", "translation"},
            optional={"context"},
            path="input",
        )
        if raw["schema_version"] != SCHEMA_VERSION:
            raise ContractViolation("unsupported_schema", "input.schema_version", "must equal 1.0")
        case_id = _string(raw["case_id"], "input.case_id", maximum=128)
        if not CASE_ID_RE.fullmatch(case_id):
            raise ContractViolation("invalid_case_id", "input.case_id", "contains unsupported characters")
        classification = raw["data_classification"]
        if not isinstance(classification, str) or classification not in DATA_CLASSIFICATIONS:
            raise ContractViolation(
                "invalid_classification", "input.data_classification", "is not supported"
            )

        context: dict[str, str] | None = None
        if "context" in raw:
            context_raw = _object(raw["context"], "input.context")
            _strict_keys(
                context_raw,
                required=set(),
                optional={"question_id", "document_id"},
                path="input.context",
            )
            context = {}
            for key, maximum in (("question_id", 64), ("document_id", 128)):
                if key in context_raw:
                    context[key] = _string(
                        context_raw[key], f"input.context.{key}", maximum=maximum
                    )

        return cls(
            case_id=case_id,
            data_classification=classification,
            source=TextDocument.from_mapping(raw["source"], "input.source"),
            translation=TextDocument.from_mapping(raw["translation"], "input.translation"),
            context=context,
        )

    def to_dict(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "schema_version": self.schema_version,
            "case_id": self.case_id,
            "data_classification": self.data_classification,
            "source": self.source.to_dict(),
            "translation": self.translation.to_dict(),
        }
        if self.context is not None:
            value["context"] = dict(self.context)
        return value


@dataclass(frozen=True)
class EvidenceSpan:
    document: str
    unit_id: str
    start: int
    end: int
    quote: str

    def __post_init__(self) -> None:
        if not isinstance(self.document, str) or self.document not in {"source", "translation"}:
            raise ContractViolation(
                "invalid_document", "finding.evidence.document", "must be source or translation"
            )
        _string(self.unit_id, "finding.evidence.unit_id", maximum=128)
        start = _integer(self.start, "finding.evidence.start")
        end = _integer(self.end, "finding.evidence.end", minimum=1)
        if end <= start:
            raise ContractViolation(
                "invalid_span", "finding.evidence", "end must be greater than start"
            )
        _string(self.quote, "finding.evidence.quote", maximum=2_000)

    @classmethod
    def from_mapping(cls, value: Any, path: str) -> "EvidenceSpan":
        raw = _object(value, path)
        _strict_keys(
            raw,
            required={"document", "unit_id", "start", "end", "quote"},
            optional=set(),
            path=path,
        )
        document = raw["document"]
        if not isinstance(document, str) or document not in {"source", "translation"}:
            raise ContractViolation("invalid_document", f"{path}.document", "must be source or translation")
        start = _integer(raw["start"], f"{path}.start")
        end = _integer(raw["end"], f"{path}.end", minimum=1)
        if end <= start:
            raise ContractViolation("invalid_span", path, "end must be greater than start")
        return cls(
            document=document,
            unit_id=_string(raw["unit_id"], f"{path}.unit_id", maximum=128),
            start=start,
            end=end,
            quote=_string(raw["quote"], f"{path}.quote", maximum=2_000),
        )

    def validate_against(self, case: VerificationCase, *, expected_document: str) -> None:
        if self.document != expected_document:
            raise ContractViolation(
                "wrong_document", "finding.evidence", f"must refer to {expected_document}"
            )
        expected_unit = f"{expected_document}:0"
        if self.unit_id != expected_unit:
            raise ContractViolation(
                "invalid_unit_id", "finding.evidence", f"must use {expected_unit} in contract v1"
            )
        text = case.source.text if self.document == "source" else case.translation.text
        if self.end > len(text) or text[self.start : self.end] != self.quote:
            raise ContractViolation(
                "evidence_mismatch", "finding.evidence", "span does not match the original text"
            )

    def to_dict(self) -> dict[str, Any]:
        return {
            "document": self.document,
            "unit_id": self.unit_id,
            "start": self.start,
            "end": self.end,
            "quote": self.quote,
        }


@dataclass(frozen=True)
class Component:
    id: str
    version: str
    config_digest: str | None = None
    prompt_digest: str | None = None
    model_revision: str | None = None

    def __post_init__(self) -> None:
        _string(self.id, "component.id", maximum=128)
        _string(self.version, "component.version", maximum=128)
        if self.config_digest is not None and (
            not isinstance(self.config_digest, str)
            or not DIGEST_RE.fullmatch(self.config_digest)
        ):
            raise ContractViolation("invalid_digest", "component.config_digest", "must be sha256 hex")
        if self.prompt_digest is not None and (
            not isinstance(self.prompt_digest, str)
            or not DIGEST_RE.fullmatch(self.prompt_digest)
        ):
            raise ContractViolation("invalid_digest", "component.prompt_digest", "must be sha256 hex")
        if self.model_revision is not None:
            _string(self.model_revision, "component.model_revision", maximum=256)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "version": self.version,
            "config_digest": self.config_digest,
            "prompt_digest": self.prompt_digest,
            "model_revision": self.model_revision,
        }


@dataclass(frozen=True)
class Finding:
    finding_id: str
    type: str
    related_types: tuple[str, ...]
    change: str
    severity: str
    source_span: EvidenceSpan | None
    translation_span: EvidenceSpan | None
    evidence_absence_reason: str | None
    confidence: float | None
    status: str
    detectors: tuple[Component, ...]
    rationale: str

    def __post_init__(self) -> None:
        _string(self.finding_id, "finding.finding_id", maximum=128)
        if not isinstance(self.type, str) or self.type not in FINDING_TYPES:
            raise ContractViolation("invalid_finding_type", "finding.type", "is not supported")
        if not isinstance(self.related_types, tuple):
            raise ContractViolation(
                "invalid_type", "finding.related_types", "must be a tuple of strings"
            )
        if any(
            not isinstance(value, str) or value not in FINDING_TYPES
            for value in self.related_types
        ):
            raise ContractViolation("invalid_finding_type", "finding.related_types", "contains an unknown type")
        if len(set(self.related_types)) != len(self.related_types):
            raise ContractViolation("duplicate_related_type", "finding.related_types", "must be unique")
        if self.type in self.related_types:
            raise ContractViolation("duplicate_primary_type", "finding.related_types", "contains the primary type")
        if not isinstance(self.change, str) or self.change not in CHANGES:
            raise ContractViolation("invalid_change", "finding.change", "is not supported")
        if not isinstance(self.severity, str) or self.severity not in SEVERITIES:
            raise ContractViolation("invalid_severity", "finding.severity", "is not supported")
        if not isinstance(self.status, str) or self.status not in FINDING_STATUSES:
            raise ContractViolation("invalid_finding_status", "finding.status", "is not supported")
        if not isinstance(self.detectors, tuple):
            raise ContractViolation(
                "invalid_type", "finding.detectors", "must be a tuple of components"
            )
        if not self.detectors:
            raise ContractViolation("missing_detector", "finding.detectors", "must not be empty")
        if any(not isinstance(item, Component) for item in self.detectors):
            raise ContractViolation(
                "invalid_type", "finding.detectors", "must contain components"
            )
        detector_keys = [(item.id, item.version) for item in self.detectors]
        if len(detector_keys) != len(set(detector_keys)):
            raise ContractViolation("duplicate_detector", "finding.detectors", "must be unique")
        if self.confidence is None:
            if self.status != "abstained":
                raise ContractViolation(
                    "missing_confidence", "finding.confidence", "may be null only when status is abstained"
                )
        else:
            _number(self.confidence, "finding.confidence", minimum=0, maximum=1)
        _string(self.rationale, "finding.rationale", maximum=1_000)
        if self.source_span is not None and not isinstance(self.source_span, EvidenceSpan):
            raise ContractViolation("invalid_type", "finding.source_span", "must be evidence")
        if self.translation_span is not None and not isinstance(
            self.translation_span, EvidenceSpan
        ):
            raise ContractViolation("invalid_type", "finding.translation_span", "must be evidence")
        missing_span = self.source_span is None or self.translation_span is None
        if self.source_span is None and self.translation_span is None:
            raise ContractViolation("missing_evidence", "finding", "requires at least one evidence span")
        if missing_span:
            _string(
                self.evidence_absence_reason,
                "finding.evidence_absence_reason",
                maximum=500,
            )
        elif self.evidence_absence_reason is not None:
            raise ContractViolation(
                "unexpected_absence_reason",
                "finding.evidence_absence_reason",
                "must be null when both spans exist",
            )
        if self.type == "omission":
            if self.change != "removed" or self.source_span is None or self.translation_span is not None:
                raise ContractViolation(
                    "invalid_evidence_shape",
                    "finding",
                    "omission requires change=removed and source-only evidence",
                )
        elif self.type == "unsupported_addition":
            if self.change != "added" or self.source_span is not None or self.translation_span is None:
                raise ContractViolation(
                    "invalid_evidence_shape",
                    "finding",
                    "unsupported_addition requires change=added and translation-only evidence",
                )
        elif self.source_span is None or self.translation_span is None:
            raise ContractViolation(
                "invalid_evidence_shape",
                "finding",
                "this finding type requires evidence from both documents",
            )

    def validate_evidence(self, case: VerificationCase) -> None:
        if self.source_span is not None:
            self.source_span.validate_against(case, expected_document="source")
        if self.translation_span is not None:
            self.translation_span.validate_against(case, expected_document="translation")

    def to_dict(self) -> dict[str, Any]:
        return {
            "finding_id": self.finding_id,
            "type": self.type,
            "related_types": list(self.related_types),
            "change": self.change,
            "severity": self.severity,
            "source_span": self.source_span.to_dict() if self.source_span else None,
            "translation_span": self.translation_span.to_dict() if self.translation_span else None,
            "evidence_absence_reason": self.evidence_absence_reason,
            "confidence": self.confidence,
            "status": self.status,
            "detectors": [item.to_dict() for item in self.detectors],
            "rationale": self.rationale,
        }


@dataclass(frozen=True)
class ReportError:
    code: str
    stage: str
    message: str
    retryable: bool

    def __post_init__(self) -> None:
        if not isinstance(self.code, str) or not CODE_RE.fullmatch(self.code):
            raise ContractViolation("invalid_error_code", "error.code", "has an invalid format")
        if not isinstance(self.stage, str) or not CODE_RE.fullmatch(self.stage):
            raise ContractViolation("invalid_error_stage", "error.stage", "has an invalid format")
        _string(self.message, "error.message", maximum=500)
        if not isinstance(self.retryable, bool):
            raise ContractViolation("invalid_type", "error.retryable", "must be boolean")

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "stage": self.stage,
            "message": self.message,
            "retryable": self.retryable,
        }


@dataclass(frozen=True)
class Provenance:
    pipeline_version: str
    dataset_version: str
    dataset_digest: str
    git_commit: str
    config_digest: str
    experiment_fingerprint: str
    components: tuple[Component, ...]
    random_seed: int | None
    hardware_class: str
    started_at: str
    duration_ms: int

    def __post_init__(self) -> None:
        _string(self.pipeline_version, "provenance.pipeline_version", maximum=128)
        _string(self.dataset_version, "provenance.dataset_version", maximum=128)
        if not isinstance(self.dataset_digest, str) or not DIGEST_RE.fullmatch(
            self.dataset_digest
        ):
            raise ContractViolation(
                "invalid_digest", "provenance.dataset_digest", "must be sha256 hex"
            )
        if not isinstance(self.git_commit, str) or not GIT_COMMIT_RE.fullmatch(self.git_commit):
            raise ContractViolation("invalid_git_commit", "provenance.git_commit", "must be 7..40 hex chars")
        if not isinstance(self.config_digest, str) or not DIGEST_RE.fullmatch(self.config_digest):
            raise ContractViolation("invalid_digest", "provenance.config_digest", "must be sha256 hex")
        if not isinstance(self.experiment_fingerprint, str) or not DIGEST_RE.fullmatch(
            self.experiment_fingerprint
        ):
            raise ContractViolation(
                "invalid_digest", "provenance.experiment_fingerprint", "must be sha256 hex"
            )
        if not isinstance(self.components, tuple):
            raise ContractViolation(
                "invalid_type", "provenance.components", "must be a tuple of components"
            )
        if not self.components:
            raise ContractViolation("missing_component", "provenance.components", "must not be empty")
        if any(not isinstance(item, Component) for item in self.components):
            raise ContractViolation(
                "invalid_type", "provenance.components", "must contain components"
            )
        component_keys = [(item.id, item.version) for item in self.components]
        if len(component_keys) != len(set(component_keys)):
            raise ContractViolation(
                "duplicate_component", "provenance.components", "must be unique"
            )
        if self.random_seed is not None:
            _integer(self.random_seed, "provenance.random_seed")
        _string(self.hardware_class, "provenance.hardware_class", maximum=128)
        _string(self.started_at, "provenance.started_at", maximum=64)
        try:
            parsed_started_at = datetime.fromisoformat(self.started_at.replace("Z", "+00:00"))
        except (TypeError, ValueError) as error:
            raise ContractViolation(
                "invalid_datetime", "provenance.started_at", "must be ISO-8601"
            ) from error
        if parsed_started_at.tzinfo is None or parsed_started_at.utcoffset() is None:
            raise ContractViolation(
                "invalid_datetime", "provenance.started_at", "must include a UTC offset"
            )
        _integer(self.duration_ms, "provenance.duration_ms")

    def to_dict(self) -> dict[str, Any]:
        return {
            "pipeline_version": self.pipeline_version,
            "dataset_version": self.dataset_version,
            "dataset_digest": self.dataset_digest,
            "git_commit": self.git_commit,
            "config_digest": self.config_digest,
            "experiment_fingerprint": self.experiment_fingerprint,
            "components": [item.to_dict() for item in self.components],
            "random_seed": self.random_seed,
            "hardware_class": self.hardware_class,
            "started_at": self.started_at,
            "duration_ms": self.duration_ms,
        }


@dataclass(frozen=True)
class VerificationReport:
    run_id: str
    case_id: str | None
    strategy_id: str
    status: str
    findings: tuple[Finding, ...]
    errors: tuple[ReportError, ...]
    provenance: Provenance
    schema_version: str = SCHEMA_VERSION

    def __post_init__(self) -> None:
        if self.schema_version != SCHEMA_VERSION:
            raise ContractViolation("unsupported_schema", "report.schema_version", "must equal 1.0")
        _string(self.run_id, "report.run_id", maximum=128)
        if self.case_id is not None:
            _string(self.case_id, "report.case_id", maximum=128)
            if not CASE_ID_RE.fullmatch(self.case_id):
                raise ContractViolation(
                    "invalid_case_id", "report.case_id", "contains unsupported characters"
                )
        if not isinstance(self.strategy_id, str) or not CODE_RE.fullmatch(self.strategy_id):
            raise ContractViolation("invalid_strategy_id", "report.strategy_id", "has an invalid format")
        if not isinstance(self.status, str) or self.status not in REPORT_STATUSES:
            raise ContractViolation("invalid_report_status", "report.status", "is not supported")
        if not isinstance(self.findings, tuple):
            raise ContractViolation("invalid_type", "report.findings", "must be a tuple")
        if not isinstance(self.errors, tuple):
            raise ContractViolation("invalid_type", "report.errors", "must be a tuple")
        if any(not isinstance(item, Finding) for item in self.findings):
            raise ContractViolation("invalid_type", "report.findings", "must contain findings")
        if any(not isinstance(item, ReportError) for item in self.errors):
            raise ContractViolation("invalid_type", "report.errors", "must contain errors")
        if not isinstance(self.provenance, Provenance):
            raise ContractViolation("invalid_type", "report.provenance", "must be provenance")
        active = [item for item in self.findings if item.status in {"candidate", "confirmed"}]
        abstained = [item for item in self.findings if item.status == "abstained"]
        if self.status == "completed" and (active or abstained or self.errors):
            raise ContractViolation(
                "invalid_status_transition",
                "report",
                "completed cannot contain active or abstained findings or errors",
            )
        if self.status == "issues_found" and (not active or abstained or self.errors):
            raise ContractViolation(
                "invalid_status_transition",
                "report",
                "issues_found requires active findings and no abstentions or errors",
            )
        if self.status in {"indeterminate", "invalid_input"} and not self.errors:
            raise ContractViolation(
                "invalid_status_transition", "report", f"{self.status} requires at least one error"
            )
        if self.status == "invalid_input" and self.findings:
            raise ContractViolation(
                "invalid_status_transition", "report", "invalid_input cannot contain findings"
            )
        if self.status != "invalid_input" and self.case_id is None:
            raise ContractViolation("missing_case_id", "report.case_id", "is required for this status")
        ids = [item.finding_id for item in self.findings]
        if len(ids) != len(set(ids)):
            raise ContractViolation("duplicate_finding_id", "report.findings", "finding IDs must be unique")

    def validate_evidence(self, case: VerificationCase) -> None:
        if self.case_id != case.case_id:
            raise ContractViolation("case_id_mismatch", "report.case_id", "does not match input")
        for finding in self.findings:
            finding.validate_evidence(case)

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "run_id": self.run_id,
            "case_id": self.case_id,
            "strategy_id": self.strategy_id,
            "status": self.status,
            "findings": [item.to_dict() for item in self.findings],
            "errors": [item.to_dict() for item in self.errors],
            "provenance": self.provenance.to_dict(),
        }
