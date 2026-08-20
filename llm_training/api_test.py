from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any

from inference_service import generate_risk_explanation


app = FastAPI(
    title="안심하랑께 LLM Inference API",
    version="1.0.0",
)


class RiskExplainRequest(BaseModel):
    subject: dict[str, Any]
    location: dict[str, Any] | None = None
    mobility: dict[str, Any]
    weather: dict[str, Any]
    air: dict[str, Any]
    risk: dict[str, Any]
    nearby_facilities: list[dict[str, Any]] = []


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "llm-inference",
    }


@app.post("/ai/explain-risk")
def explain_risk(data: RiskExplainRequest):
    try:
        return generate_risk_explanation(
            data.model_dump()
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )
