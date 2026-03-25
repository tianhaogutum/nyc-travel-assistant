"""User profile service — read helen_profile.md and provide structured summary."""

import logging
from pathlib import Path
from functools import lru_cache

from config import USER_PROFILE_PATH

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _load_raw_profile() -> str:
    """Load the raw markdown profile from disk (cached)."""
    try:
        return USER_PROFILE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        logger.warning("User profile not found at %s", USER_PROFILE_PATH)
        return ""


def get_profile_summary() -> dict:
    """Return a structured profile summary for API and LLM consumption."""
    structured = {
        "暱稱": "Helen",
        "年齡": "22 歲（水瓶座）",
        "MBTI": "INFJ",
        "語言": "廣東話、國語、英語",
        "同行者": "和朋友一起來紐約",
        "喜歡的食物": "芋圓、拉麵、抹茶、港式料理、鼎泰豐、貝果、提拉米蘇、日料、焙茶、酸種麵包、煎餃/鍋貼、綿綿冰、豆花、紫薯、柿子",
        "不吃": "羊肉、pizza、啤酒",
        "飲食習慣": "過了八點不吃東西 · 亞洲胃 · 自律",
        "喜歡的顏色": "紫色、大地色",
        "喜歡的花": "櫻花",
        "喜歡的動物": "薩摩耶、貓",
        "喜歡的季節": "秋天（銀杏、楓葉）",
        "旅行風格": "高效但不特種兵，喜歡拍照做攻略",
        "興趣": "唱歌、吉他、烘焙、攝影、Jellycat、Switch、麻將、K歌",
        "性格": "情商高、獨立堅強、善良溫暖、細心有計畫",
        "預算": "學生預算，偏性價比",
    }

    return {
        "name": "Helen",
        "summary": "22 歲，水瓶座，INFJ 🌟 和朋友一起來紐約玩！喜歡芋圓、抹茶、港式料理，不吃羊肉和 pizza，過了八點不吃東西。喜歡紫色和櫻花 🌸 最愛的季節是秋天。",
        "structured": structured,
        # keep flat fields for LLM usage
        "name_zh": "Helen",
        "age": 22,
        "origin": "在美國讀書的學生",
        "personality": "INFJ，情商高，獨立，細心有計畫",
        "travel_style": "高效但不特種兵，喜歡拍照做攻略，怕熱不怕冷",
        "food_likes": [
            "芋圓", "拉麵", "抹茶", "港式料理", "鼎泰豐", "貝果",
            "提拉米蘇", "日料", "焙茶", "酸種麵包", "煎餃/鍋貼",
            "綿綿冰", "豆花", "紫薯", "柿子",
        ],
        "food_dislikes": ["羊肉", "pizza", "啤酒", "台灣的港式料理"],
        "dietary_habits": [
            "過了八點不吃東西",
            "亞洲胃",
            "自律",
            "午餐經常隨便吃",
        ],
        "travel_companions": "和朋友一起來紐約",
        "budget": "學生預算，偏性價比",
        "favorites": {
            "colors": ["紫色", "大地色"],
            "flowers": ["櫻花"],
            "animals": ["薩摩耶", "貓"],
            "season": "秋天（銀杏、楓葉）",
        },
    }


def get_profile_for_llm() -> str:
    """Return a concise Traditional Chinese text summary of the user profile for LLM prompts."""
    p = get_profile_summary()
    likes = "、".join(p["food_likes"])
    dislikes = "、".join(p["food_dislikes"])
    habits = "；".join(p["dietary_habits"])

    return f"""用戶: {p['name']}，{p['age']}歲，{p['origin']}。
性格: {p['personality']}。
旅行風格: {p['travel_style']}。同行者: {p['travel_companions']}。
喜歡的食物: {likes}。
不喜歡的食物: {dislikes}。
飲食習慣: {habits}。
預算: {p['budget']}。"""
