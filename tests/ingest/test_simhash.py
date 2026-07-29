from services.ingest.dedupe.simhash import (
    DEDUPE_HAMMING_THRESHOLD,
    hamming_distance,
    job_blocking_key,
    simhash64,
)


def test_simhash_is_stable_and_near_duplicate_sensitive() -> None:
    first = simhash64("Example senior python engineer remote")
    same = simhash64("Example senior python engineer remote")
    close = simhash64("Example senior python developer remote")

    assert first == same
    assert hamming_distance(first, same) == 0
    assert hamming_distance(first, close) < 20


def test_dedupe_threshold_keeps_distinct_seniority_roles_separate() -> None:
    engineer = job_blocking_key(
        company_name="Anduril Industries",
        title_normalized="mechanical engineer undersea reconnaissance strike",
        country="US",
        city="Boston",
    )
    senior_engineer = job_blocking_key(
        company_name="Anduril Industries",
        title_normalized="senior mechanical engineer undersea reconnaissance strike",
        country="US",
        city="Boston",
    )

    assert engineer != senior_engineer
    assert DEDUPE_HAMMING_THRESHOLD == 0
