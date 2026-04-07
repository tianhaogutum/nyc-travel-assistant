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
        "Nickname": "Helen",
        "Age": "22 (Aquarius)",
        "MBTI": "INFJ",
        "Languages": "Cantonese, Mandarin, English",
        "Travel Companions": "Visiting NYC with friends",
        "Food Likes": "Taro balls, ramen, matcha, Hong Kong cuisine, Din Tai Fung, bagels, tiramisu, Japanese food, hojicha, sourdough, pan-fried dumplings/potstickers, snow ice, tofu pudding, purple yam, persimmon",
        "Food Dislikes": "Lamb, pizza, beer",
        "Dietary Habits": "No eating after 8pm · Asian palate · disciplined",
        "Favorite Colors": "Purple, earth tones",
        "Favorite Flower": "Cherry blossoms",
        "Favorite Animals": "Samoyed, cats",
        "Favorite Season": "Autumn (ginkgo, maple leaves)",
        "Travel Style": "Efficient but not rushed, enjoys photography and planning",
        "Hobbies": "Singing, guitar, baking, photography, Jellycat, Switch, mahjong, KTV",
        "Personality": "High EQ, independent, warm-hearted, thoughtful and organized",
        "Budget": "Student budget, value-for-money oriented",
    }

    return {
        "name": "Helen",
        "summary": "22 years old, Aquarius, INFJ 🌟 Visiting NYC with friends! Loves taro balls, matcha, and Hong Kong cuisine. Doesn't eat lamb or pizza, and stops eating after 8pm. Favorite color is purple, loves cherry blossoms 🌸 Favorite season is autumn.",
        "structured": structured,
        # keep flat fields for LLM usage
        "name_zh": "Helen",
        "age": 22,
        "origin": "Student studying in the US",
        "personality": "INFJ, high EQ, independent, thoughtful and organized",
        "travel_style": "Efficient but not rushed, enjoys photography and planning, tolerates cold but not heat",
        "food_likes": [
            "taro balls", "ramen", "matcha", "Hong Kong cuisine", "Din Tai Fung", "bagels",
            "tiramisu", "Japanese food", "hojicha", "sourdough", "pan-fried dumplings/potstickers",
            "snow ice", "tofu pudding", "purple yam", "persimmon",
        ],
        "food_dislikes": ["lamb", "pizza", "beer", "Hong Kong-style food in Taiwan"],
        "dietary_habits": [
            "No eating after 8pm",
            "Asian palate",
            "disciplined",
            "Often eats casually for lunch",
        ],
        "travel_companions": "Visiting NYC with friends",
        "budget": "Student budget, value-for-money oriented",
        "favorites": {
            "colors": ["purple", "earth tones"],
            "flowers": ["cherry blossoms"],
            "animals": ["Samoyed", "cats"],
            "season": "Autumn (ginkgo, maple leaves)",
        },
    }


def get_profile_for_llm() -> str:
    """Return a concise English text summary of the user profile for LLM prompts."""
    p = get_profile_summary()
    likes = ", ".join(p["food_likes"])
    dislikes = ", ".join(p["food_dislikes"])
    habits = "; ".join(p["dietary_habits"])

    return f"""User: {p['name']}, {p['age']} years old, {p['origin']}.
Personality: {p['personality']}.
Travel style: {p['travel_style']}. Travel companions: {p['travel_companions']}.
Food likes: {likes}.
Food dislikes: {dislikes}.
Dietary habits: {habits}.
Budget: {p['budget']}."""
