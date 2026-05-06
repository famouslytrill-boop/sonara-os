from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.core.cors import add_cors
from app.core.logging import logger
from app.routers import health, auth, organizations, memberships, billing, media, ingestion, transcription, civic, music, tableops, audit, admin

app = FastAPI(title="SONARA Industries API", version="0.1.0")
add_cors(app)

for router in [health.router, auth.router, organizations.router, memberships.router, billing.router, media.router, ingestion.router, transcription.router, civic.router, music.router, tableops.router, audit.router, admin.router]:
    app.include_router(router)

@app.on_event("startup")
async def startup_event():
    logger.info("SONARA Industries API starting")

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled API error")
    return JSONResponse(status_code=500, content={"detail": "internal_server_error"})

