from fastapi import FastAPI
import uvicorn
import time
import logging
from fastapi.responses import JSONResponse

app = FastAPI()
logger = logging.getLogger(__name__)

# A simple in-memory metrics store (for demonstration)
metrics = {
    "registered_services": 0,
    "events_processed": 0
}

start_time = time.time()

@app.get("/metrics")
async def get_metrics():
    return metrics

@app.get("/health")
async def get_health():
    uptime_seconds = time.time() - start_time
    health_status = {
        "status": "healthy",
        "database": "connected",  # Placeholder for actual database connection status
        "uptime_seconds": uptime_seconds
    }
    return JSONResponse(content=health_status)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

import uvicorn
import logging

app = FastAPI()
logger = logging.getLogger(__name__)

# A simple in-memory metrics store (for demonstration)
metrics = {
    "registered_services": 0,
    "events_processed": 0
}

@app.get("/metrics")
async def get_metrics():
    return metrics

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
