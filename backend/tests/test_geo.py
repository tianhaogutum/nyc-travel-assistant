import math
import random
import sqlite3

import pytest
from services.geo import cold_filter, filter_by_radius, haversine, query_places


def database(tmp_path, rows):
    path = tmp_path / "places.db"
    with sqlite3.connect(path) as conn:
        conn.execute(
            "CREATE TABLE places (name TEXT, latitude REAL, longitude REAL, rating REAL, review_count INTEGER, primary_type TEXT)"
        )
        conn.executemany("INSERT INTO places VALUES (?,?,?,?,?,?)", rows)
    return str(path)


@pytest.mark.parametrize(
    "lat,lon,radius",
    [
        (40.75, -73.98, 1),
        (0, 179.99, 10),
        (89.99, 10, 10),
        (-89.99, 0, 10),
        (0, 0, 100),
    ],
)
def test_sql_bounds_equal_exact_scan(tmp_path, lat, lon, radius):
    rng = random.Random(42)
    rows = [
        (
            str(i),
            max(-90, min(90, lat + rng.uniform(-1, 1))),
            (lon + rng.uniform(-1, 1) + 180) % 360 - 180,
            4.5,
            i,
            "cafe",
        )
        for i in range(400)
    ]
    rows += [("origin", lat, lon, 4.5, 100, "cafe")]
    path = database(tmp_path, rows)
    original = query_places(path)
    expected = filter_by_radius(original, lat, lon, radius)
    actual = cold_filter(path, lat, lon, radius, limit=1000)
    assert {p["place_id"] for p in actual} == {p["place_id"] for p in expected}
    assert all("distance_m" not in p for p in original)


def test_balanced_ranking_and_labels(tmp_path):
    path = database(
        tmp_path,
        [
            ("Popular but poor", 40.75, -73.98, 2.5, 10000, "cafe"),
            ("Reliable", 40.75, -73.98, 4.7, 500, "cafe"),
            ("One review", 40.75, -73.98, 5, 1, "cafe"),
            ("Other", 40.75, -73.98, 5, 1000, "museum"),
        ],
    )
    args = (path, 40.75, -73.98, 1)
    assert cold_filter(*args, labels=["cafe"])[0]["name"] == "Popular but poor"
    assert (
        cold_filter(*args, labels=["cafe"], ranking="balanced")[0]["name"] == "Reliable"
    )
    assert cold_filter(*args, labels=["cafe') OR 1=1 --"]) == []
    assert cold_filter(*args, limit=0) == []


def test_haversine_antipodes_and_same_point():
    assert haversine(40, -73, 40, -73) == 0
    assert haversine(0, 0, 0, 180) == pytest.approx(math.pi * 6371000)


def test_bad_database_values_do_not_break_search_or_json_serialization(tmp_path):
    import json

    path = database(
        tmp_path,
        [
            (None, 40.75, -73.98, 4.5, 20, "cafe"),
            ("   ", 40.75, -73.98, 4.5, 20, "cafe"),
            ("Bad latitude", "unknown", -73.98, 4.5, 20, "cafe"),
            ("Missing metrics", 40.75, -73.98, float("inf"), float("inf"), "cafe"),
            ("Negative metrics", 40.75, -73.98, -4, -12, "cafe"),
            ("Valid", 40.75, -73.98, 4.5, 20, "cafe"),
        ],
    )
    for ranking in ("popular", "balanced"):
        places = cold_filter(path, 40.75, -73.98, 1, ranking=ranking)
        assert {p["name"] for p in places} == {
            "Missing metrics",
            "Negative metrics",
            "Valid",
        }
        for place in places:
            if place["name"] != "Valid":
                assert place["rating"] is None
                assert place["review_count"] == 0
        json.dumps(places, allow_nan=False)
