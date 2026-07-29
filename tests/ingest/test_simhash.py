from services.ingest.dedupe.simhash import hamming_distance, simhash64


def test_simhash_is_stable_and_near_duplicate_sensitive() -> None:
    first = simhash64("Example senior python engineer remote")
    same = simhash64("Example senior python engineer remote")
    close = simhash64("Example senior python developer remote")

    assert first == same
    assert hamming_distance(first, same) == 0
    assert hamming_distance(first, close) < 20
