from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import bids, hil, audit, inputs, reports

AGENT_PREFIX = "/mei-aegis"

app = FastAPI(title="Bid Management API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    # CORS spec forbids combining wildcard origin with credentials, so credentials=False.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bids.router,    prefix=f"{AGENT_PREFIX}/bids",    tags=["bids"])
app.include_router(hil.router,     prefix=f"{AGENT_PREFIX}/hil",     tags=["hil"])
app.include_router(audit.router,   prefix=f"{AGENT_PREFIX}/audit",   tags=["audit"])
app.include_router(inputs.router,  prefix=f"{AGENT_PREFIX}/inputs",  tags=["inputs"])
app.include_router(reports.router, prefix=f"{AGENT_PREFIX}/reports", tags=["reports"])


@app.get(f"{AGENT_PREFIX}/health")
async def health():
    return {"status": "ok"}
