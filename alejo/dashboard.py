from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import uvicorn
import os

app = FastAPI()
templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))

@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    # Dummy data; in real integration, fetch dynamic data from ServiceRegistry, etc.
    data = {
        "title": "ALEJO Dashboard",
        "services": ["ALEJOBrain", "EmotionalIntelligence", "SkillPluginRegistry"],
        "metrics": {"registered_services": 5, "events_processed": 120}
    }
    return templates.TemplateResponse("dashboard.html", {"request": request, "data": data})

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
