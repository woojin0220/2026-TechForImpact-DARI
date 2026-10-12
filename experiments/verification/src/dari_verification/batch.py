from __future__ import annotations

from typing import Any, Mapping, Sequence

from .contracts import VerificationReport
from .fixtures import Fixture, compute_dataset_digest
from .pipeline import VerificationPipeline


def run_batch(
    pipeline: VerificationPipeline,
    fixtures: Sequence[Fixture],
    *,
    dataset_version: str,
    git_commit: str,
    options: Mapping[str, Any] | None = None,
    prompt_digest: str | None = None,
    model_revision: str | None = None,
    random_seed: int | None = None,
    hardware_class: str = "unspecified",
) -> tuple[VerificationReport, ...]:
    """Run every validated fixture; case-level strategy failures stay isolated in reports."""

    dataset_digest = compute_dataset_digest(fixtures)
    return tuple(
        pipeline.run(
            fixture.case.to_dict(),
            dataset_version=dataset_version,
            dataset_digest=dataset_digest,
            git_commit=git_commit,
            options=options,
            prompt_digest=prompt_digest,
            model_revision=model_revision,
            random_seed=random_seed,
            hardware_class=hardware_class,
        )
        for fixture in fixtures
    )
