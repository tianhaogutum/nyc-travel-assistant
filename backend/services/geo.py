"""SQL bounding-box filtering followed by exact great-circle distances."""

import hashlib
import heapq
import math
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Optional

from config import ONLINE_RECS_CATEGORY_MAP, ONLINE_RECS_DB

EARTH_RADIUS_M = 6_371_000


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    a = (
        math.sin(math.radians(lat2 - lat1) / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    )
    a = min(1.0, max(0.0, a))
    return EARTH_RADIUS_M * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _connect(db_path: str):
    # Do not silently create an empty database when the dataset is missing.
    conn = sqlite3.connect(Path(db_path).resolve().as_uri() + "?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def query_places(db_path: str) -> list[dict]:
    with closing(_connect(db_path)) as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM places")]


def get_labels(db_path: str) -> list[dict]:
    with closing(_connect(db_path)) as conn:
        rows = conn.execute(
            "SELECT primary_type, COUNT(*) AS cnt FROM places "
            "WHERE primary_type IS NOT NULL AND primary_type != '' "
            "GROUP BY primary_type ORDER BY cnt DESC, primary_type"
        ).fetchall()
    return [{"label": r[0], "count": r[1]} for r in rows]


def _bounding_box(lat: float, lon: float, radius_km: float) -> tuple[str, list]:
    angular = radius_km * 1000 / EARTH_RADIUS_M
    delta_lat = math.degrees(angular)
    low, high = max(-90, lat - delta_lat), min(90, lat + delta_lat)
    clause, params = "latitude BETWEEN ? AND ?", [low, high]
    if low > -90 and high < 90:
        delta_lon = math.degrees(
            math.asin(min(1, math.sin(angular) / math.cos(math.radians(lat))))
        )
        left, right = lon - delta_lon, lon + delta_lon
        if left < -180 or right > 180:
            clause += " AND (longitude >= ? OR longitude <= ?)"
            params += [(left + 180) % 360 - 180, (right + 180) % 360 - 180]
        else:
            clause += " AND longitude BETWEEN ? AND ?"
            params += [left, right]
    return clause, params


def place_id(place: dict) -> str:
    """Identity includes coordinates so same-name branches remain distinct."""
    key = f"{place['name'].strip().casefold()}|{place['latitude']:.5f}|{place['longitude']:.5f}"
    return hashlib.sha256(key.encode()).hexdigest()[:20]


def filter_by_radius(
    places: list[dict], lat: float, lon: float, radius_km: float
) -> list[dict]:
    result = []
    for p in places:
        p_lat, p_lon = p.get("latitude"), p.get("longitude")
        if p_lat is None or p_lon is None:
            continue
        if not (-90 <= p_lat <= 90 and -180 <= p_lon <= 180):
            continue
        dist = haversine(lat, lon, p_lat, p_lon)
        if dist <= radius_km * 1000:
            result.append({**p, "distance_m": round(dist), "place_id": place_id(p)})
    return result


def recommendation_score(place: dict) -> float:
    """Shrink sparse ratings toward 4/5 with 20 prior reviews; prefer nearby ties.

    This is a transparent cold-start heuristic, not a learned preference model.
    Raw mode retains its original review-count ordering.
    """
    count = max(0, place.get("review_count") or 0)
    rating = place.get("rating") or 4.0
    quality = (count * min(5, max(0, rating)) + 20 * 4.0) / (count + 20)
    proximity = 0.25 / (1 + (place.get("distance_m") or 0) / 1000)
    return quality + proximity


def cold_filter(
    db_path: str,
    lat: float,
    lon: float,
    radius_km: float,
    limit: int = 25,
    labels: Optional[list] = None,
    ranking: str = "popular",
) -> list[dict]:
    clause, params = _bounding_box(lat, lon, radius_km)
    if labels:
        clause += f" AND primary_type IN ({','.join('?' for _ in labels)})"
        params.extend(labels)
    with closing(_connect(db_path)) as conn:
        places = [
            dict(r)
            for r in conn.execute(f"SELECT * FROM places WHERE {clause}", params)
        ]
    nearby = filter_by_radius(places, lat, lon, radius_km)
    # De-duplicate rows before applying the result limit.
    nearby = list({p["place_id"]: p for p in nearby}.values())

    def key(p):
        score = (
            recommendation_score(p)
            if ranking == "balanced"
            else (p.get("review_count") or 0)
        )
        return (-score, -(p.get("review_count") or 0), p["distance_m"], p["place_id"])

    return heapq.nsmallest(max(0, limit), nearby, key=key)


def query_online_recommendations(
    category: str,
    lat: float,
    lon: float,
    radius_km: float,
    limit: int = 10,
    labels: Optional[list] = None,
) -> list[dict]:
    categories = ONLINE_RECS_CATEGORY_MAP.get(category, [])
    if not categories or not ONLINE_RECS_DB.exists():
        return []
    clause, params = _bounding_box(lat, lon, radius_km)
    clause += f" AND category IN ({','.join('?' for _ in categories)})"
    params.extend(categories)
    if labels:
        clause += f" AND primary_type IN ({','.join('?' for _ in labels)})"
        params.extend(labels)
    with closing(_connect(str(ONLINE_RECS_DB))) as conn:
        places = [
            dict(r)
            for r in conn.execute(
                f"SELECT * FROM recommendations WHERE {clause}", params
            )
        ]
    nearby = filter_by_radius(places, lat, lon, radius_km)
    nearby.sort(
        key=lambda p: (-(p.get("review_count") or 0), p["distance_m"], p["place_id"])
    )
    unique = {}
    for p in nearby:
        unique.setdefault(p["place_id"], {**p, "source_tag": "online_rec"})
    return list(unique.values())[:limit]
