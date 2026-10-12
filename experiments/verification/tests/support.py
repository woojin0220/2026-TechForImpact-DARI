from __future__ import annotations

from datetime import datetime, timezone
from typing import Sequence

from dari_verification import Component, EvidenceSpan, Finding


TEST_COMMIT = "9dea7dbae9febc7d0ad445663c56394ef0ce399b"
FIXED_NOW = datetime(2026, 10, 12, 12, 0, tzinfo=timezone.utc)


def valid_payload(
    *,
    case_id: str = "case-001",
    source_text: str = "경찰인 것 같은 사람이 나를 한 번 밀었습니다.",
    translation_text: str = "A person who seemed to be a police officer pushed me once.",
) -> dict:
    return {
        "schema_version": "1.0",
        "case_id": case_id,
        "data_classification": "synthetic",
        "source": {"language": "ko", "text": source_text},
        "translation": {"language": "en", "text": translation_text},
        "context": {"question_id": "14.1"},
    }


def span(document: str, text: str, quote: str, unit_id: str) -> EvidenceSpan:
    start = text.index(quote)
    return EvidenceSpan(
        document=document,
        unit_id=unit_id,
        start=start,
        end=start + len(quote),
        quote=quote,
    )


def sample_finding(
    payload: dict,
    *,
    finding_id: str = "finding-001",
    status: str = "candidate",
    confidence: float = 0.8,
    related_types: tuple[str, ...] = (),
) -> Finding:
    source_text = payload["source"]["text"]
    translation_text = payload["translation"]["text"]
    return Finding(
        finding_id=finding_id,
        type="certainty_shift",
        related_types=related_types,
        change="removed",
        severity="high",
        source_span=span("source", source_text, "것 같은", "source:0"),
        translation_span=span("translation", translation_text, "a police officer", "translation:0"),
        evidence_absence_reason=None,
        confidence=confidence,
        status=status,
        detectors=(Component(id="scripted", version="1.0"),),
        rationale="The translation states the identity without the source uncertainty.",
    )


class StaticStrategy:
    strategy_id = "scripted"
    version = "1.0"

    def __init__(self, findings: Sequence[Finding] = (), error: Exception | None = None):
        self.findings = findings
        self.error = error
        self.calls = []

    def detect(self, case):
        self.calls.append(case)
        if self.error is not None:
            raise self.error
        return self.findings


def fixed_now() -> datetime:
    return FIXED_NOW


def fixed_monotonic() -> float:
    return 100.0
