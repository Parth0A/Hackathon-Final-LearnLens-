import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
from lib.db import client, db, ensure_indexes
from routers.learning import router as learning_router
from routers.auth import router as auth_router
from routers.classrooms import router as classrooms_router
from routers.library import router as library_router
from routers.intelligence import router as intelligence_router
from services.seeding import ensure_seeded


# Startup runs before the yield, shutdown after it. Add your own setup/teardown here.
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())  # background: a big index build must not block boot
    try:
        await asyncio.wait_for(ensure_seeded(), timeout=float(os.environ.get("SEED_TIMEOUT_SECONDS", "30")))
    except Exception as exc:
        # Never let a cold or briefly unavailable database hang application startup.
        logger.warning("Startup seeding skipped: %s", exc)
    yield
    client.close()


# Create the main app without a prefix
app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "LearnLens Learning Recovery API", "demo_student_id": "demo-student"}

api_router.include_router(auth_router)
api_router.include_router(library_router)
api_router.include_router(classrooms_router)
api_router.include_router(learning_router)
api_router.include_router(intelligence_router)

# Include the router in the main app
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[item.strip() for item in os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if item.strip()],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)

@app.middleware("http")
async def security_middleware(request, call_next):
    origin = request.headers.get("origin")
    if origin and request.method not in {"GET", "HEAD", "OPTIONS"}:
        configured = [item.strip().rstrip("/") for item in os.environ.get("CORS_ORIGINS", "").split(",") if item.strip()]
        request_origin = origin.rstrip("/")
        host = request.headers.get("host", "")
        # Honour proxy headers so same-origin checks pass behind a TLS-terminating proxy.
        scheme = request.headers.get("x-forwarded-proto", request.url.scheme).split(",")[0].strip() or request.url.scheme
        same_origin = request_origin == f"{scheme}://{host}".rstrip("/")
        if not same_origin and request_origin not in configured:
            from fastapi.responses import JSONResponse
            return JSONResponse({"detail": "Cross-origin request blocked"}, status_code=403)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    if request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Keep the /api router include last so every endpoint is mounted under the proxy prefix.
app.include_router(api_router)
