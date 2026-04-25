from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import bids, hil, audit, inputs, reports

app = FastAPI(title="Bid Management API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    # CORS spec forbids combining wildcard origin with credentials, so credentials=False.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bids.router,    prefix="/api/bids",    tags=["bids"])
app.include_router(hil.router,     prefix="/api/hil",     tags=["hil"])
app.include_router(audit.router,   prefix="/api/audit",   tags=["audit"])
app.include_router(inputs.router,  prefix="/api/inputs",  tags=["inputs"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
