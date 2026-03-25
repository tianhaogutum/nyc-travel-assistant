"""Haversine distance calculation and geo-filtering."""

import math
import sqlite3
from typing import Optional

from config import ONLINE_RECS_DB, ONLINE_RECS_CATEGORY_MAP


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return distance in meters between two (lat, lon) points."""
    R = 6_371_000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def query_places(db_path: str) -> list[dict]:
    """Read all places from a classification DB."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM places").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_labels(db_path: str) -> list[dict]:
    """Return distinct primary_type labels with counts, sorted by count desc."""
    conn = sqlite3.connect(db_path)
    rows = conn.execute(
        "SELECT primary_type, COUNT(*) as cnt FROM places "
        "WHERE primary_type IS NOT NULL AND primary_type != '' "
        "GROUP BY primary_type ORDER BY cnt DESC"
    ).fetchall()
    conn.close()
    return [{"label": r[0], "count": r[1]} for r in rows]


def filter_by_radius(
    places: list[dict],
    lat: float,
    lon: float,
    radius_km: float,
) -> list[dict]:
    """Filter places within radius and annotate with distance_m."""
    radius_m = radius_km * 1000
    result = []
    for p in places:
        p_lat = p.get("latitude")
        p_lon = p.get("longitude")
        if p_lat is None or p_lon is None:
            continue
        dist = haversine(lat, lon, p_lat, p_lon)
        if dist <= radius_m:
            p["distance_m"] = round(dist)
            result.append(p)
    return result


def cold_filter(
    db_path: str,
    lat: float,
    lon: float,
    radius_km: float,
    limit: int = 25,
    labels: Optional[list] = None,
) -> list[dict]:
    """Cold-start filter: places within radius, ordered by review_count desc, top N.
    If labels is provided, only include places whose primary_type is in the list."""
    places = query_places(db_path)
    if labels:
        label_set = set(labels)
        places = [p for p in places if p.get("primary_type") in label_set]
    nearby = filter_by_radius(places, lat, lon, radius_km)
    nearby.sort(key=lambda p: p.get("review_count") or 0, reverse=True)
    return nearby[:limit]


def query_online_recommendations(category: str, lat: float, lon: float, radius_km: float, limit: int = 10) -> list[dict]:
    """Query online editorial recommendations matching a pipeline category, filtered by radius."""
    db_categories = ONLINE_RECS_CATEGORY_MAP.get(category, [])
    if not db_categories or not ONLINE_RECS_DB.exists():
        return []
    placeholders = ",".join("?" for _ in db_categories)
    conn = sqlite3.connect(str(ONLINE_RECS_DB))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        f"SELECT name, rating, review_count, price_level, primary_type, "
        f"latitude, longitude, editorial_summary, reviews_preview, source, description "
        f"FROM recommendations WHERE category IN ({placeholders})",
        db_categories,
    ).fetchall()
    conn.close()
    places = [dict(r) for r in rows]
    nearby = filter_by_radius(places, lat, lon, radius_km)
    nearby.sort(key=lambda p: p.get("review_count") or 0, reverse=True)
    for p in nearby:
        p["source_tag"] = "online_rec"
    return nearby[:limit]
