"""Compare SQL prefiltering with the original full-table algorithm, offline."""

import statistics
import time

from config import DB_MAP
from services.geo import cold_filter, haversine, query_places

PATH = str(DB_MAP["manhattan", "food_drink"])


def baseline():
    nearby = []
    for place in query_places(PATH):
        if place["latitude"] is None or place["longitude"] is None:
            continue
        distance = haversine(40.758, -73.9855, place["latitude"], place["longitude"])
        if distance <= 1000:
            nearby.append(place)
    return sorted(nearby, key=lambda p: p.get("review_count") or 0, reverse=True)[:50]


def optimized():
    return cold_filter(PATH, 40.758, -73.9855, 1, limit=50)


if __name__ == "__main__":
    assert [p["name"] for p in baseline()] == [p["name"] for p in optimized()]
    for name, query in [
        ("Full table baseline", baseline),
        ("SQL prefilter", optimized),
    ]:
        samples = []
        for _ in range(30):
            started = time.perf_counter()
            query()
            samples.append((time.perf_counter() - started) * 1000)
        print(f"{name}: median {statistics.median(samples):.2f} ms (30 local runs)")
    print("Top 50 names and ordering match for this Times Square query.")
