"""Configuration for NYC Travel Assistant backend."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend/ directory
load_dotenv(Path(__file__).resolve().parent / ".env")

# Project root (parent of backend/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Dataset paths
DATASET_DIR = PROJECT_ROOT / "dataset"

# DB mapping: (data_source, category) -> relative db path
DB_MAP = {
    # Eat pipeline
    ("brooklyn", "food_drink"): DATASET_DIR / "brooklyn" / "classifications" / "food_drink.db",
    ("manhattan", "food_drink"): DATASET_DIR / "manhattan" / "classifications" / "food_drink.db",
    # Explore pipeline — culture
    ("brooklyn", "culture"): DATASET_DIR / "brooklyn" / "classifications" / "culture.db",
    ("manhattan", "culture"): DATASET_DIR / "manhattan" / "classifications" / "culture.db",
    # Explore pipeline — entertainment
    ("brooklyn", "entertainment"): DATASET_DIR / "brooklyn" / "classifications" / "entertainment.db",
    ("manhattan", "entertainment"): DATASET_DIR / "manhattan" / "classifications" / "entertainment_recreation.db",
    # Explore pipeline — shopping
    ("brooklyn", "shopping"): DATASET_DIR / "brooklyn" / "classifications" / "shopping.db",
    ("manhattan", "shopping"): DATASET_DIR / "manhattan" / "classifications" / "shopping.db",
    # Explore pipeline — other
    ("brooklyn", "other"): DATASET_DIR / "brooklyn" / "classifications" / "other.db",
    ("manhattan", "other"): DATASET_DIR / "manhattan" / "classifications" / "other.db",
}

# Online recommendations DB
ONLINE_RECS_DB = DATASET_DIR / "online_recommendations" / "nyc_recommendations.db"

# Map online_recommendations categories → our pipeline categories
ONLINE_RECS_CATEGORY_MAP = {
    "food_drink": ["Food & Drink"],
    "culture": ["Museum", "Landmark & Monument"],
    "entertainment": ["General"],
    "shopping": [],
    "other": ["Park & Nature", "Neighborhood", "General"],
}

# User profile path
USER_PROFILE_PATH = PROJECT_ROOT / "user_profil" / "helen_profile.md"

# LLM provider: "azure", "ollama", or "anthropic"
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "anthropic")

# Azure OpenAI settings
AZURE_API_KEY = os.getenv("AZURE_API_KEY", "")
AZURE_ENDPOINT = os.getenv("AZURE_ENDPOINT", "")
AZURE_API_VERSION = os.getenv("AZURE_API_VERSION", "2025-01-01-preview")
AZURE_DEPLOYMENT = os.getenv("AZURE_DEPLOYMENT", "gpt-5.2")

# Ollama settings
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

# Anthropic settings
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")

LLM_TIMEOUT = 300  # seconds

# Pipeline settings
TOP_N = 10
DEFAULT_RADIUS_KM = 1.0

# CORS — allow frontend
CORS_ORIGINS = ["*"]
