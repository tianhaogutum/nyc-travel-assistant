"""NYC Travel Intelligence Engine — FastAPI backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from config import CORS_ORIGINS, DB_MAP, LLM_PROVIDER, OLLAMA_BASE_URL, OLLAMA_MODEL, AZURE_DEPLOYMENT
from api.eat import router as eat_router
from api.explore import router as explore_router
from api.profile import router as profile_router
from services.geo import get_labels

app = FastAPI(
    title="NYC Travel Intelligence Engine",
    version="0.2.0",
    description="AI-powered NYC restaurant & attraction recommendations for Chinese tourists",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/llm-provider")
async def llm_provider():
    """Return which LLM provider is active."""
    if LLM_PROVIDER == "ollama":
        return {"provider": "ollama", "model": OLLAMA_MODEL, "base_url": OLLAMA_BASE_URL}
    return {"provider": "azure", "model": AZURE_DEPLOYMENT}


@app.get("/api/labels")
async def labels(data_source: str = "manhattan", category: str = "food_drink"):
    """Return available primary_type labels for a data_source + category."""
    key = (data_source.lower(), category.lower())
    path = DB_MAP.get(key)
    if path is None or not path.exists():
        return {"labels": []}
    return {"labels": get_labels(str(path))}

app.include_router(eat_router, prefix="/api", tags=["eat"])
app.include_router(explore_router, prefix="/api", tags=["explore"])
app.include_router(profile_router, prefix="/api", tags=["profile"])

# Serve frontend static files (mount AFTER api routes so /api/* is not intercepted)
frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
