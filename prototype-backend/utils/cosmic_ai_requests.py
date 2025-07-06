import requests

from typing import Any
from typing import List
from typing import cast
from typing import Literal
from typing import Optional
from typing import TypedDict

from dataclasses import dataclass

from project.env import ENV

import logging

logger = logging.getLogger(__name__)


@dataclass
class CgAIResponse:
    status: Literal["success", "failed", "errored"]
    data: Optional[Any]
    error: Optional[str] = None


def call_cg_ai_service(path: str, data: dict):
    url = f"{ENV.COSMIC_AI_URL}{path}"
    try:
        resp = requests.post(
            url, json=data, headers={"X-API-KEY": ENV.COSMIC_AI_API_KEY}
        )
        if resp.status_code == 200:
            return CgAIResponse("success", resp.json())
        else:
            msg = resp.text or "Request failed"
            return CgAIResponse("failed", None, msg)
    except Exception as e:
        logger.error(f"Error in calling Cosmic AI service: {e}")
        return CgAIResponse("errored", None, str(e))


class ForecastingQuery(TypedDict):
    prediction_context: str
    forecast_length: int
    data: List[dict]


def get_forecased_data(query: ForecastingQuery):
    path = "/forecast-timeseries"
    return call_cg_ai_service(path, cast(dict, query))
