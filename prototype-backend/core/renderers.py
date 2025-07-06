import json
import time

from typing import List
from typing import Callable

from django.db.models import QuerySet

from rest_framework.renderers import JSONRenderer


class CgApiRenderer(JSONRenderer):
    def render(self, data, accepted_media_type=None, renderer_context=None):
        status_code = renderer_context["response"].status_code
        response_dict = {
            "success": True,
            "data": data.get("data", None),
            "error": None,
            "message": data.get("message", None) or data.get("detail", None),
        }
        if not str(status_code).startswith("2"):
            response_dict["success"] = False
            response_dict["error"] = {
                k: v for k, v in data.items() if k not in ["detail", "message", "data"]
            } or None
        return super(CgApiRenderer, self).render(
            response_dict, accepted_media_type, renderer_context
        )


ROWS_PER_CHUNK = 10


def generate_json_response(
    queryset: QuerySet, column_headers: List[str], row_transform: Callable
):
    """
    Generate JSON or dictionary chunks for a queryset.

    :param queryset: The queryset to process.
    :param column_headers: A list of column headers for the JSON output.
    :param row_transform: A callable that transforms an object in the queryset into a list of row values. # noqa
    :return: A generator yielding dictionaries for column headers and rows.
    """

    yield '{"columns": ' + json.dumps(column_headers) + "}"

    current_chunk = []
    for obj in queryset.iterator():
        current_chunk.append(row_transform(obj))
        if len(current_chunk) >= ROWS_PER_CHUNK:
            time.sleep(0.2)
            yield '{"rows": ' + json.dumps(current_chunk) + "}"
            current_chunk = []

    if current_chunk:
        yield '{"rows": ' + json.dumps(current_chunk) + "}"
