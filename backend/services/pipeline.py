"""Shared Pipeline core logic — cold filter → LLM rank → parse results."""

import json
import logging
import re
import time
from typing import Optional

from config import DB_MAP, TOP_N
from services.geo import cold_filter, query_online_recommendations
from services.llm import call_llm
from services.profile import get_profile_for_llm
from services.web_search import search_negative_reviews

logger = logging.getLogger(__name__)


def _resolve_db(data_source: str, category: str) -> Optional[str]:
    """Resolve DB path from (data_source, category). Returns str path or None."""
    key = (data_source.lower(), category.lower())
    path = DB_MAP.get(key)
    if path is None or not path.exists():
        return None
    return str(path)


def _format_places_for_llm(places: list[dict]) -> str:
    """Format top-N places as numbered text for LLM input."""
    lines = []
    for i, p in enumerate(places, 1):
        parts = [
            f"[{i}] {p['name']}",
            f"  評分: {p.get('rating', 'N/A')}",
            f"  評論數: {p.get('review_count', 0)}",
            f"  價格: {p.get('price_level', 'N/A')}",
            f"  類型: {p.get('primary_type', 'N/A')}",
            f"  距離: {p.get('distance_m', '?')}m",
        ]
        summary = p.get("editorial_summary")
        if summary:
            parts.append(f"  簡介: {summary}")
        reviews = p.get("reviews_preview")
        if reviews:
            parts.append(f"  評論摘要: {reviews[:300]}")
        lines.append("\n".join(parts))
    return "\n\n".join(lines)


def _format_negative_reviews(neg_reviews: dict[str, list[str]]) -> str:
    """Format negative review snippets for LLM."""
    if not neg_reviews:
        return "（未搜尋到差評資訊）"
    lines = []
    for name, snippets in neg_reviews.items():
        if snippets:
            joined = " | ".join(s[:150] for s in snippets[:2])
            lines.append(f"- {name}: {joined}")
    return "\n".join(lines) if lines else "（未搜尋到明顯差評）"


def _format_online_recs(recs: list[dict]) -> str:
    """Format online editorial recommendations for LLM input."""
    if not recs:
        return "（沒有匹配的線上編輯推薦）"
    lines = []
    for i, p in enumerate(recs, 1):
        parts = [
            f"[線上推薦 {i}] {p['name']}",
            f"  來源: {p.get('source', 'N/A')}",
            f"  評分: {p.get('rating', 'N/A')}",
            f"  評論數: {p.get('review_count', 0)}",
            f"  距離: {p.get('distance_m', '?')}m",
        ]
        desc = p.get("description")
        if desc:
            parts.append(f"  簡介: {desc}")
        summary = p.get("editorial_summary")
        if summary:
            parts.append(f"  編輯摘要: {summary}")
        reviews = p.get("reviews_preview")
        if reviews:
            parts.append(f"  評論摘要: {reviews[:300]}")
        lines.append("\n".join(parts))
    return "\n\n".join(lines)


def _build_eat_prompt(
    places_text: str,
    user_profile: str,
    questionnaire: dict,
    radius_km: float,
    neg_reviews_text: str,
    online_recs_text: str,
) -> str:
    q = questionnaire
    q_text = f"""- 菜系偏好: {q.get('cuisine', '隨便')}
- 吃辣: {q.get('spicy', '不限')}
- 預算: {q.get('budget', '隨意')}
- 氛圍偏好: {q.get('vibe', '不限')}
- 忌口: {q.get('avoid', '無')}
- 最看重: {q.get('priority', '不限')}
- 心情: {q.get('mood', '隨便')}
- 餐次: {q.get('meal_type', '隨時')}
- 食量: {q.get('portion', '正常')}
- 飲料: {q.get('drink', '不需要')}
- 願意走多遠: {q.get('distance', '不限')}
- 排隊容忍度: {q.get('wait', '無所謂')}"""

    return f"""你是紐約旅遊美食推薦專家，專門為華人遊客提供個性化推薦。請用繁體中文回答。

## 用戶畫像
{user_profile}

## 用戶本次偏好 (問卷答案)
{q_text}

## 候選餐廳 (按評論數排序的 Top {len(places_text.split('['))}, 距離用戶 {radius_km}km 以內)
{places_text}

## 網上差評/負面資訊參考
{neg_reviews_text}

## 線上編輯推薦（來自 Wikipedia/Timeout/NYCgo 等權威來源）
{online_recs_text}

## 你的任務
1. 綜合分析每個餐廳的 rating、review_count、簡介、評論摘要
2. 結合用戶畫像和本次問卷偏好，對所有餐廳進行個性化排序
3. 特別關注: 食品安全問題、服務態度差、性價比低、名不副實等負面評論
4. 注意用戶不吃羊肉、不愛 pizza 和啎酒、過了八點不吃東西
5. 如果線上編輯推薦中的地點也出現在候選餐廳中，請適當加分
6. 如果線上推薦中有不在候選清單中的餐廳但在範圍內，也可以納入推薦
7. 對每個餐廳，請明確說明排名依據來自哪些資料來源
8. **必須輸出候選清單中的全部餐廳**，不得省略任何一家，按排名從高到低列出

## 輸出格式
請嚴格按以下 JSON 陣列格式輸出，不要輸出其他內容:
```json
[
  {{
    "rank": 1,
    "name": "餐廳名稱",
    "description": "1句繁體中文簡述（這是什麼類型的餐廳）",
    "recommendation": "1句推薦理由",
    "review": "4-6句詳細繁體中文評語：綜合你的內部知識、Google 評論數據、用戶評價摘要、網上差評、線上編輯推薦等所有資訊，用自然的語言描述這家餐廳的優點與缺點。像一個熟悉紐約的朋友在跟你聊天一樣，告訴用戶這家店好在哪裡、有什麼需要注意的地方、適合什麼場景、招牌菜是什麼、性價比如何等等。",
    "highlights": ["亮點1", "亮點2"],
    "warnings": ["風險提醒（如有）"],
    "reasoning_sources": {{
      "user_pref": "這家店符合用戶的哪些偏好（如菜系、預算、口味等）",
      "google_data": "Google 資料告訴了什麼（評分、評論數、類型等）",
      "llm_knowledge": "你作為 AI 對這家店的額外了解（如名氣、招牌菜、文化背景等）",
      "negative_reviews": "網上差評搜尋發現了什麼（如有的話）",
      "online_editorial": "線上編輯推薦提到了什麼（如有的話，來自 Wikipedia/Timeout 等）"
    }}
  }}
]
```

## review 欄位撰寫要求
- 必須是繁體中文
- 綜合所有資料來源（Google 數據、評論、差評、你的知識、編輯推薦），不要只複述某一個來源
- 要明確提到優點和缺點（如果有的話）
- 語氣像朋友在聊天推薦，自然、有趣、有觀點
- 每家餐廳的 review 都要獨特，不要套模板

請用自然、友好的繁體中文描述，像朋友在推薦一樣。"""


def _build_explore_prompt(
    places_text: str,
    user_profile: str,
    questionnaire: dict,
    radius_km: float,
    category: str,
    neg_reviews_text: str,
    online_recs_text: str,
) -> str:
    category_zh = {"culture": "文化", "entertainment": "娛樂", "shopping": "購物", "other": "其他"}.get(category, category)
    q = questionnaire
    q_text = f"""- 興趣類型: {q.get('interest', '隨便逛逛')}
- 旅行節奏: {q.get('pace', '適中')}
- 同行人數: {q.get('companion', '不限')}
- 可用時間: {q.get('time_avail', '不限')}
- 室內/室外: {q.get('outdoor', '都行')}
- 拍照需求: {q.get('photo', '不限')}
- 歷史文化: {q.get('history', '不限')}
- 人潮偏好: {q.get('crowd', '無所謂')}
- 免費/付費: {q.get('free_paid', '都行')}
- 經典/小眾: {q.get('unique', '不限')}
- 今天天氣: {q.get('weather', '不限')}
- 紀念品: {q.get('souvenir', '不限')}"""

    return f"""你是紐約旅遊探索推薦專家，專門為華人遊客提供個性化推薦。請用繁體中文回答。

## 用戶畫像
{user_profile}

## 用戶本次偏好 (問卷答案)
{q_text}

## 探索類別: {category_zh}

## 候選地點 (按評論數排序的 Top {len(places_text.split('['))}, 距離用戶 {radius_km}km 以內)
{places_text}

## 網上差評/負面資訊參考
{neg_reviews_text}

## 線上編輯推薦（來自 Wikipedia/Timeout/NYCgo 等權威來源）
{online_recs_text}

## 你的任務
1. 綜合分析每個地點的 rating、review_count、簡介、評論摘要
2. 結合用戶畫像和本次問卷偏好，對所有地點進行個性化排序
3. 特別關注: 安全隱患、宰客、虛假宣傳等負面資訊
4. 注意用戶喜歡拍照
5. 如果線上編輯推薦中的地點也出現在候選清單中，請適當加分
6. 如果線上推薦中有不在候選清單中的地點但在範圍內，也可以納入推薦
7. 對每個地點，請明確說明排名依據來自哪些資料來源
8. **必須輸出候選清單中的全部地點**，不得省略任何一個，按排名從高到低列出

## 輸出格式
請嚴格按以下 JSON 陣列格式輸出，不要輸出其他內容:
```json
[
  {{
    "rank": 1,
    "name": "地點名稱",
    "description": "1句繁體中文簡述（這是什麼類型的地點）",
    "recommendation": "1句推薦理由",
    "review": "4-6句詳細繁體中文評語：綜合你的內部知識、Google 評論數據、用戶評價摘要、網上差評、線上編輯推薦等所有資訊，用自然的語言描述這個地點的優點與缺點。像一個熟悉紐約的朋友在跟你聊天一樣，告訴用戶這裡好在哪裡、有什麼需要注意的地方、適合什麼樣的遊客、有什麼必看亮點、門票值不值等等。",
    "highlights": ["亮點1", "亮點2"],
    "warnings": ["風險提醒（如有）"],
    "reasoning_sources": {{
      "user_pref": "這個地點符合用戶的哪些偏好",
      "google_data": "Google 資料告訴了什麼（評分、評論數等）",
      "llm_knowledge": "你作為 AI 對這個地點的額外了解",
      "negative_reviews": "網上差評搜尋發現了什麼（如有的話）",
      "online_editorial": "線上編輯推薦提到了什麼（如有的話，來自 Wikipedia/Timeout 等）"
    }}
  }}
]
```

## review 欄位撰寫要求
- 必須是繁體中文
- 綜合所有資料來源（Google 數據、評論、差評、你的知識、編輯推薦），不要只複述某一個來源
- 要明確提到優點和缺點（如果有的話）
- 語氣像朋友在聊天推薦，自然、有趣、有觀點
- 每個地點的 review 都要獨特，不要套模板
```
請用自然、友好的繁體中文描述，像朋友在推薦一樣。"""


def _parse_llm_response(text: str) -> list[dict]:
    """Try to extract a JSON array from LLM output."""
    if not text:
        return []
    # Try to find JSON array inside markdown code block or raw
    match = re.search(r'\[[\s\S]*\]', text)
    if not match:
        return []
    try:
        arr = json.loads(match.group())
        if isinstance(arr, list):
            return arr
    except json.JSONDecodeError:
        logger.warning("Failed to parse LLM JSON response")
    return []


def _fallback_rankings(places: list[dict]) -> list[dict]:
    """Generate fallback rankings from cold-sorted places (no LLM)."""
    rankings = []
    for i, p in enumerate(places, 1):
        rankings.append({
            "rank": i,
            "name": p["name"],
            "rating": p.get("rating"),
            "review_count": p.get("review_count", 0),
            "price_level": p.get("price_level"),
            "primary_type": p.get("primary_type"),
            "distance_m": p.get("distance_m"),
            "latitude": p.get("latitude"),
            "longitude": p.get("longitude"),
            "description": p.get("editorial_summary") or "暫無描述",
            "recommendation": "按評論數排序推薦（AI 排名暫不可用）",
            "highlights": [],
            "warnings": [],
        })
    return rankings


def _merge_rankings(llm_rankings: list[dict], places: list[dict], neg_reviews: Optional[dict] = None) -> list[dict]:
    """Merge LLM ranking data with original place data (lat/lon, distance, etc.).
    Any place not returned by the LLM is appended at the end to ensure nothing is dropped."""
    place_lookup = {p["name"]: p for p in places}
    merged = []
    ranked_names = set()
    for item in llm_rankings:
        name = item.get("name", "")
        orig = place_lookup.get(name, {})
        ranked_names.add(name)
        merged.append({
            "rank": item.get("rank", 0),
            "name": name,
            "rating": orig.get("rating"),
            "review_count": orig.get("review_count", 0),
            "price_level": orig.get("price_level"),
            "primary_type": orig.get("primary_type"),
            "distance_m": orig.get("distance_m"),
            "latitude": orig.get("latitude"),
            "longitude": orig.get("longitude"),
            "description": item.get("description", ""),
            "recommendation": item.get("recommendation", ""),
            "review": item.get("review", ""),
            "highlights": item.get("highlights", []),
            "warnings": item.get("warnings", []),
            "reasoning_sources": item.get("reasoning_sources"),
            "neg_review_snippets": (neg_reviews or {}).get(name, []),
        })
    # Append places the LLM omitted, ranked after all LLM results
    next_rank = len(merged) + 1
    for p in places:
        if p["name"] not in ranked_names:
            merged.append({
                "rank": next_rank,
                "name": p["name"],
                "rating": p.get("rating"),
                "review_count": p.get("review_count", 0),
                "price_level": p.get("price_level"),
                "primary_type": p.get("primary_type"),
                "distance_m": p.get("distance_m"),
                "latitude": p.get("latitude"),
                "longitude": p.get("longitude"),
                "description": p.get("editorial_summary") or "",
                "recommendation": "",
                "review": "",
                "highlights": [],
                "warnings": [],
                "reasoning_sources": None,
                "neg_review_snippets": (neg_reviews or {}).get(p["name"], []),
            })
            next_rank += 1
    return merged


async def run_eat_pipeline(
    latitude: float,
    longitude: float,
    radius_km: float,
    data_source: str,
    questionnaire: dict,
    labels: Optional[list] = None,
) -> dict:
    """Run the full eat pipeline: cold filter → web search → LLM rank."""
    t0 = time.time()

    db_path = _resolve_db(data_source, "food_drink")
    if db_path is None:
        return {"error": f"Database not found for {data_source}/food_drink", "rankings": [], "total": 0}

    # Step 1: Cold filter
    places = cold_filter(db_path, latitude, longitude, radius_km, limit=TOP_N, labels=labels)
    if not places:
        return {"rankings": [], "total": 0, "radius_km": radius_km, "data_source": data_source, "pipeline_time_ms": 0}

    # Step 2: Web search for negative reviews (best-effort)
    place_names = [p["name"] for p in places]
    try:
        neg_reviews = await search_negative_reviews(place_names)
    except Exception:
        neg_reviews = {}

    # Step 3: Build prompt and call LLM
    user_profile = get_profile_for_llm()
    places_text = _format_places_for_llm(places)
    neg_text = _format_negative_reviews(neg_reviews)

    # Step 3b: Query online editorial recommendations
    online_recs = query_online_recommendations("food_drink", latitude, longitude, radius_km)
    online_recs_text = _format_online_recs(online_recs)

    prompt = _build_eat_prompt(places_text, user_profile, questionnaire, radius_km, neg_text, online_recs_text)

    llm_response = await call_llm(prompt)
    llm_rankings = _parse_llm_response(llm_response)

    if llm_rankings:
        rankings = _merge_rankings(llm_rankings, places + online_recs, neg_reviews)
    else:
        rankings = _fallback_rankings(places)

    elapsed = round((time.time() - t0) * 1000)
    return {
        "rankings": rankings,
        "total": len(rankings),
        "radius_km": radius_km,
        "data_source": data_source,
        "pipeline_time_ms": elapsed,
    }


async def run_explore_pipeline(
    latitude: float,
    longitude: float,
    radius_km: float,
    data_source: str,
    category: str,
    questionnaire: dict,
    labels: Optional[list] = None,
) -> dict:
    """Run the full explore pipeline: cold filter → web search → LLM rank."""
    t0 = time.time()

    db_path = _resolve_db(data_source, category)
    if db_path is None:
        return {"error": f"Database not found for {data_source}/{category}", "rankings": [], "total": 0}

    places = cold_filter(db_path, latitude, longitude, radius_km, limit=TOP_N, labels=labels)
    if not places:
        return {"rankings": [], "total": 0, "radius_km": radius_km, "data_source": data_source, "pipeline_time_ms": 0}

    place_names = [p["name"] for p in places]
    try:
        neg_reviews = await search_negative_reviews(place_names)
    except Exception:
        neg_reviews = {}

    user_profile = get_profile_for_llm()
    places_text = _format_places_for_llm(places)
    neg_text = _format_negative_reviews(neg_reviews)

    # Query online editorial recommendations for this category
    online_recs = query_online_recommendations(category, latitude, longitude, radius_km)
    online_recs_text = _format_online_recs(online_recs)

    prompt = _build_explore_prompt(places_text, user_profile, questionnaire, radius_km, category, neg_text, online_recs_text)

    llm_response = await call_llm(prompt)
    llm_rankings = _parse_llm_response(llm_response)

    if llm_rankings:
        rankings = _merge_rankings(llm_rankings, places + online_recs, neg_reviews)
    else:
        rankings = _fallback_rankings(places)

    elapsed = round((time.time() - t0) * 1000)
    return {
        "rankings": rankings,
        "total": len(rankings),
        "radius_km": radius_km,
        "data_source": data_source,
        "category": category,
        "pipeline_time_ms": elapsed,
    }


# ── Raw mode (no LLM) ─────────────────────────────────────────────

RAW_LIMIT = 50


def _raw_rankings(places: list[dict]) -> list[dict]:
    """Build rankings from cold-sorted places without LLM."""
    rankings = []
    for i, p in enumerate(places, 1):
        rankings.append({
            "rank": i,
            "name": p["name"],
            "rating": p.get("rating"),
            "review_count": p.get("review_count", 0),
            "price_level": p.get("price_level"),
            "primary_type": p.get("primary_type"),
            "distance_m": p.get("distance_m"),
            "latitude": p.get("latitude"),
            "longitude": p.get("longitude"),
            "description": p.get("editorial_summary") or "",
            "recommendation": "",
            "review": "",
            "highlights": [],
            "warnings": [],
        })
    return rankings


async def run_raw_eat_pipeline(
    latitude: float,
    longitude: float,
    radius_km: float,
    data_source: str,
    labels: Optional[list] = None,
) -> dict:
    """Raw mode: top 50 by review count, no LLM."""
    t0 = time.time()
    db_path = _resolve_db(data_source, "food_drink")
    if db_path is None:
        return {"error": f"Database not found for {data_source}/food_drink", "rankings": [], "total": 0}

    places = cold_filter(db_path, latitude, longitude, radius_km, limit=RAW_LIMIT, labels=labels)
    rankings = _raw_rankings(places)

    elapsed = round((time.time() - t0) * 1000)
    return {
        "rankings": rankings,
        "total": len(rankings),
        "radius_km": radius_km,
        "data_source": data_source,
        "pipeline_time_ms": elapsed,
    }


async def run_raw_explore_pipeline(
    latitude: float,
    longitude: float,
    radius_km: float,
    data_source: str,
    category: str,
    labels: Optional[list] = None,
) -> dict:
    """Raw mode: top 50 by review count, no LLM."""
    t0 = time.time()
    db_path = _resolve_db(data_source, category)
    if db_path is None:
        return {"error": f"Database not found for {data_source}/{category}", "rankings": [], "total": 0}

    places = cold_filter(db_path, latitude, longitude, radius_km, limit=RAW_LIMIT, labels=labels)
    rankings = _raw_rankings(places)

    elapsed = round((time.time() - t0) * 1000)
    return {
        "rankings": rankings,
        "total": len(rankings),
        "radius_km": radius_km,
        "data_source": data_source,
        "category": category,
        "pipeline_time_ms": elapsed,
    }


# ── Streaming pipelines (SSE) ──────────────────────────────────────

async def stream_eat_pipeline(
    latitude: float,
    longitude: float,
    radius_km: float,
    data_source: str,
    questionnaire: dict,
    labels: Optional[list] = None,
):
    """SSE generator: yields cold results immediately, then AI rankings."""
    t0 = time.time()
    db_path = _resolve_db(data_source, "food_drink")
    if db_path is None:
        yield f"data: {json.dumps({'error': f'Database not found for {data_source}/food_drink', 'rankings': [], 'total': 0})}\n\n"
        return

    places = cold_filter(db_path, latitude, longitude, radius_km, limit=TOP_N, labels=labels)
    if not places:
        yield f"data: {json.dumps({'type': 'cold', 'rankings': [], 'total': 0, 'radius_km': radius_km, 'data_source': data_source, 'pipeline_time_ms': 0})}\n\n"
        return

    cold_rankings = _fallback_rankings(places)
    yield f"data: {json.dumps({'type': 'cold', 'rankings': cold_rankings, 'total': len(cold_rankings), 'radius_km': radius_km, 'data_source': data_source, 'pipeline_time_ms': 0})}\n\n"

    place_names = [p["name"] for p in places]
    try:
        neg_reviews = await search_negative_reviews(place_names)
    except Exception:
        neg_reviews = {}

    user_profile = get_profile_for_llm()
    places_text = _format_places_for_llm(places)
    neg_text = _format_negative_reviews(neg_reviews)
    online_recs = query_online_recommendations("food_drink", latitude, longitude, radius_km)
    online_recs_text = _format_online_recs(online_recs)
    prompt = _build_eat_prompt(places_text, user_profile, questionnaire, radius_km, neg_text, online_recs_text)

    llm_response = await call_llm(prompt)
    llm_rankings = _parse_llm_response(llm_response)

    if llm_rankings:
        rankings = _merge_rankings(llm_rankings, places + online_recs, neg_reviews)
    else:
        rankings = _fallback_rankings(places)

    elapsed = round((time.time() - t0) * 1000)
    yield f"data: {json.dumps({'type': 'ai', 'rankings': rankings, 'total': len(rankings), 'radius_km': radius_km, 'data_source': data_source, 'pipeline_time_ms': elapsed})}\n\n"
    yield "data: [DONE]\n\n"


async def stream_explore_pipeline(
    latitude: float,
    longitude: float,
    radius_km: float,
    data_source: str,
    category: str,
    questionnaire: dict,
    labels: Optional[list] = None,
):
    """SSE generator: yields cold results immediately, then AI rankings."""
    t0 = time.time()
    db_path = _resolve_db(data_source, category)
    if db_path is None:
        yield f"data: {json.dumps({'error': f'Database not found for {data_source}/{category}', 'rankings': [], 'total': 0})}\n\n"
        return

    places = cold_filter(db_path, latitude, longitude, radius_km, limit=TOP_N, labels=labels)
    if not places:
        yield f"data: {json.dumps({'type': 'cold', 'rankings': [], 'total': 0, 'radius_km': radius_km, 'data_source': data_source, 'category': category, 'pipeline_time_ms': 0})}\n\n"
        return

    cold_rankings = _fallback_rankings(places)
    yield f"data: {json.dumps({'type': 'cold', 'rankings': cold_rankings, 'total': len(cold_rankings), 'radius_km': radius_km, 'data_source': data_source, 'category': category, 'pipeline_time_ms': 0})}\n\n"

    place_names = [p["name"] for p in places]
    try:
        neg_reviews = await search_negative_reviews(place_names)
    except Exception:
        neg_reviews = {}

    user_profile = get_profile_for_llm()
    places_text = _format_places_for_llm(places)
    neg_text = _format_negative_reviews(neg_reviews)
    online_recs = query_online_recommendations(category, latitude, longitude, radius_km)
    online_recs_text = _format_online_recs(online_recs)
    prompt = _build_explore_prompt(places_text, user_profile, questionnaire, radius_km, category, neg_text, online_recs_text)

    llm_response = await call_llm(prompt)
    llm_rankings = _parse_llm_response(llm_response)

    if llm_rankings:
        rankings = _merge_rankings(llm_rankings, places + online_recs, neg_reviews)
    else:
        rankings = _fallback_rankings(places)

    elapsed = round((time.time() - t0) * 1000)
    yield f"data: {json.dumps({'type': 'ai', 'rankings': rankings, 'total': len(rankings), 'radius_km': radius_km, 'data_source': data_source, 'category': category, 'pipeline_time_ms': elapsed})}\n\n"
    yield "data: [DONE]\n\n"
