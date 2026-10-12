from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
import hashlib
import json
import math
import time
import uuid
from typing import Any, Callable, Mapping, Protocol, Sequence

from .contracts import (
    CASE_ID_RE,
    CODE_RE,
    Component,
    ContractViolation,
    Finding,
    Provenance,
    ReportError,
    VerificationCase,
    VerificationReport,
)


class VerificationStrategy(Protocol):
    strategy_id: str
    version: str

    def detect(self, case: VerificationCase) -> Sequence[Finding]: ...


class StrategyFailure(RuntimeError):
    code = "adapter_exception"
    retryable = False


class UnsupportedLanguage(StrategyFailure):
    code = "unsupported_language"


class StrategyTimeout(StrategyFailure):
    code = "timeout"
    retryable = True


class MalformedStrategyOutput(StrategyFailure):
    code = "malformed_output"


def _validate_json_value(value: Any, path: str) -> None:
    if value is None or isinstance(value, (str, bool, int)):
        return
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ContractViolation(
                "invalid_config", path, "must not contain NaN or Infinity"
            )
        return
    if isinstance(value, Mapping):
        for key, child in value.items():
            if not isinstance(key, str):
                raise ContractViolation(
                    "invalid_config", path, "must use string object keys"
                )
            _validate_json_value(child, f"{path}.{key}")
        return
    if isinstance(value, (list, tuple)):
        for index, child in enumerate(value):
            _validate_json_value(child, f"{path}[{index}]")
        return
    raise ContractViolation("invalid_config", path, "must contain JSON-compatible values")


def _sha256(value: Mapping[str, Any], path: str) -> str:
    _validate_json_value(value, path)
    try:
        encoded = json.dumps(
            value,
            allow_nan=False,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    except (TypeError, ValueError) as error:
        raise ContractViolation(
            "invalid_config", path, "must be canonical JSON"
        ) from error
    return hashlib.sha256(encoded).hexdigest()


def _validate_run_id(run_id: Any) -> str:
    if not isinstance(run_id, str) or not 1 <= len(run_id) <= 128:
        raise ContractViolation(
            "invalid_run_id", "pipeline.run_id", "must be a non-empty string up to 128 characters"
        )
    return run_id


def _span_key(finding: Finding) -> tuple[Any, ...]:
    def span_value(span: Any) -> tuple[Any, ...] | None:
        if span is None:
            return None
        return (span.document, span.unit_id, span.start, span.end)

    return (
        finding.type,
        finding.change,
        span_value(finding.source_span),
        span_value(finding.translation_span),
    )


def _deduplicate(findings: Sequence[Finding]) -> tuple[Finding, ...]:
    by_id: dict[str, tuple[Any, ...]] = {}
    grouped: dict[tuple[Any, ...], list[Finding]] = {}
    for finding in findings:
        if not isinstance(finding, Finding):
            raise MalformedStrategyOutput("strategy returned a non-Finding value")
        semantic_key = _span_key(finding)
        previous_key = by_id.setdefault(finding.finding_id, semantic_key)
        if previous_key != semantic_key:
            raise MalformedStrategyOutput("one finding_id refers to different findings")
        grouped.setdefault(semantic_key, []).append(finding)

    rank = {"confirmed": 4, "candidate": 3, "abstained": 2, "rejected": 1}
    merged: list[Finding] = []
    for key in sorted(grouped, key=repr):
        candidates = grouped[key]
        winner = sorted(
            candidates,
            key=lambda item: (
                rank[item.status],
                -1.0 if item.confidence is None else item.confidence,
                item.finding_id,
            ),
            reverse=True,
        )[0]
        related = tuple(
            sorted(
                {
                    related_type
                    for item in candidates
                    for related_type in item.related_types
                    if related_type != winner.type
                }
            )
        )
        detectors_by_key: dict[tuple[str, str], Component] = {}
        for item in candidates:
            for detector in item.detectors:
                detector_key = (detector.id, detector.version)
                previous = detectors_by_key.setdefault(detector_key, detector)
                if previous != detector:
                    raise MalformedStrategyOutput(
                        "one detector identity has conflicting provenance"
                    )
        detectors = tuple(detectors_by_key[key] for key in sorted(detectors_by_key))
        merged.append(replace(winner, related_types=related, detectors=detectors))
    return tuple(sorted(merged, key=lambda item: item.finding_id))


class VerificationPipeline:
    def __init__(
        self,
        strategy: VerificationStrategy,
        *,
        pipeline_version: str = "0.1.0",
        now: Callable[[], datetime] | None = None,
        monotonic: Callable[[], float] | None = None,
        id_factory: Callable[[], str] | None = None,
    ):
        self.strategy = strategy
        self.pipeline_version = pipeline_version
        self._now = now or (lambda: datetime.now(timezone.utc))
        self._monotonic = monotonic or time.monotonic
        self._id_factory = id_factory or (lambda: f"run-{uuid.uuid4().hex}")

    def run(
        self,
        payload: Any,
        *,
        dataset_version: str,
        dataset_digest: str,
        git_commit: str,
        options: Mapping[str, Any] | None = None,
        prompt_digest: str | None = None,
        model_revision: str | None = None,
        random_seed: int | None = None,
        hardware_class: str = "unspecified",
        run_id: str | None = None,
    ) -> VerificationReport:
        started_at = self._now().astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        started = self._monotonic()
        if not isinstance(self.strategy.strategy_id, str) or not CODE_RE.fullmatch(
            self.strategy.strategy_id
        ):
            raise ContractViolation(
                "invalid_strategy_id", "pipeline.strategy_id", "has an invalid format"
            )
        if options is None:
            resolved_options: Mapping[str, Any] = {}
        elif isinstance(options, Mapping):
            resolved_options = dict(options)
        else:
            raise ContractViolation("invalid_config", "pipeline.options", "must be an object")
        resolved_run_id = _validate_run_id(
            self._id_factory() if run_id is None else run_id
        )
        config_digest = _sha256(
            {
                "pipeline_version": self.pipeline_version,
                "strategy_id": self.strategy.strategy_id,
                "strategy_version": self.strategy.version,
                "options": resolved_options,
            },
            "pipeline.config",
        )
        experiment_fingerprint = _sha256(
            {
                "pipeline_version": self.pipeline_version,
                "dataset_version": dataset_version,
                "dataset_digest": dataset_digest,
                "git_commit": git_commit,
                "strategy_id": self.strategy.strategy_id,
                "strategy_version": self.strategy.version,
                "config_digest": config_digest,
                "prompt_digest": prompt_digest,
                "model_revision": model_revision,
                "random_seed": random_seed,
            },
            "pipeline.fingerprint",
        )
        self._provenance(
            dataset_version,
            dataset_digest,
            git_commit,
            config_digest,
            experiment_fingerprint,
            prompt_digest,
            model_revision,
            random_seed,
            hardware_class,
            started_at,
            0,
        )

        try:
            case = VerificationCase.from_mapping(payload)
        except ContractViolation as error:
            duration = self._duration(started)
            safe_case_id = payload.get("case_id") if isinstance(payload, Mapping) else None
            if not isinstance(safe_case_id, str) or not CASE_ID_RE.fullmatch(safe_case_id):
                safe_case_id = None
            return VerificationReport(
                run_id=resolved_run_id,
                case_id=safe_case_id,
                strategy_id=self.strategy.strategy_id,
                status="invalid_input",
                findings=(),
                errors=(
                    ReportError(
                        code="input_schema_violation",
                        stage="input",
                        message=f"Input contract failed at {error.path}.",
                        retryable=False,
                    ),
                ),
                provenance=self._provenance(
                    dataset_version,
                    dataset_digest,
                    git_commit,
                    config_digest,
                    experiment_fingerprint,
                    prompt_digest,
                    model_revision,
                    random_seed,
                    hardware_class,
                    started_at,
                    duration,
                ),
            )

        try:
            raw_findings = self.strategy.detect(case)
            if isinstance(raw_findings, (str, bytes)) or not isinstance(raw_findings, Sequence):
                raise MalformedStrategyOutput("strategy result must be a sequence")
            raw_findings = tuple(raw_findings)
            for finding in raw_findings:
                if not isinstance(finding, Finding):
                    raise MalformedStrategyOutput("strategy returned a non-Finding value")
                finding.validate_evidence(case)
            findings = _deduplicate(raw_findings)
            abstained = any(item.status == "abstained" for item in findings)
            if abstained:
                status = "indeterminate"
                errors = (
                    ReportError(
                        code="strategy_abstained",
                        stage="verification",
                        message="The strategy could not complete every required judgment.",
                        retryable=False,
                    ),
                )
            else:
                active = any(item.status in {"candidate", "confirmed"} for item in findings)
                status = "issues_found" if active else "completed"
                errors = ()
        except ContractViolation as error:
            findings = ()
            status = "indeterminate"
            errors = (
                ReportError(
                    code=("evidence_mismatch" if error.code in {"evidence_mismatch", "wrong_document", "invalid_unit_id"} else "report_contract_violation"),
                    stage="output_validation",
                    message="The strategy output violated the verification contract.",
                    retryable=False,
                ),
            )
        except StrategyFailure as error:
            findings = ()
            status = "indeterminate"
            errors = (
                ReportError(
                    code=error.code,
                    stage="verification",
                    message="The verification strategy did not complete.",
                    retryable=error.retryable,
                ),
            )
        except Exception:
            findings = ()
            status = "indeterminate"
            errors = (
                ReportError(
                    code="adapter_exception",
                    stage="verification",
                    message="The verification strategy failed unexpectedly.",
                    retryable=False,
                ),
            )

        report = VerificationReport(
            run_id=resolved_run_id,
            case_id=case.case_id,
            strategy_id=self.strategy.strategy_id,
            status=status,
            findings=findings,
            errors=errors,
            provenance=self._provenance(
                dataset_version,
                dataset_digest,
                git_commit,
                config_digest,
                experiment_fingerprint,
                prompt_digest,
                model_revision,
                random_seed,
                hardware_class,
                started_at,
                self._duration(started),
            ),
        )
        report.validate_evidence(case)
        return report

    def _duration(self, started: float) -> int:
        return max(0, round((self._monotonic() - started) * 1000))

    def _provenance(
        self,
        dataset_version: str,
        dataset_digest: str,
        git_commit: str,
        config_digest: str,
        experiment_fingerprint: str,
        prompt_digest: str | None,
        model_revision: str | None,
        random_seed: int | None,
        hardware_class: str,
        started_at: str,
        duration_ms: int,
    ) -> Provenance:
        return Provenance(
            pipeline_version=self.pipeline_version,
            dataset_version=dataset_version,
            dataset_digest=dataset_digest,
            git_commit=git_commit,
            config_digest=config_digest,
            experiment_fingerprint=experiment_fingerprint,
            components=(
                Component(
                    id=self.strategy.strategy_id,
                    version=self.strategy.version,
                    config_digest=config_digest,
                    prompt_digest=prompt_digest,
                    model_revision=model_revision,
                ),
            ),
            random_seed=random_seed,
            hardware_class=hardware_class,
            started_at=started_at,
            duration_ms=duration_ms,
        )
