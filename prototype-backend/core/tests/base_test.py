import json

from django.test import TestCase

from rest_framework.test import APITestCase, APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import CgUser


class BaseAPITestCase(APITestCase, TestCase):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.client = APIClient()

    def setUp(self) -> None:
        self.user = CgUser.objects.create_user(
            email="test@cosmicglobaltech.com",
            password="password",
        )

    @staticmethod
    def collect_stream_chunks(response) -> dict:
        collected_data = {"columns": [], "rows": []}
        try:
            for chunk in response.streaming_content:
                line = chunk.decode("utf-8").strip()
                if line:
                    parsed_chunk = json.loads(line)
                    if "columns" in parsed_chunk:
                        collected_data["columns"] = parsed_chunk["columns"]
                    if "rows" in parsed_chunk:
                        collected_data["rows"].extend(parsed_chunk["rows"])
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON chunk: {e}")
        return collected_data

    def set_auth(self, user: CgUser):
        usr = self.user if user is None else user
        refresh_token = RefreshToken.for_user(usr)
        self.client.credentials(  # type: ignore
            HTTP_AUTHORIZATION=f"Bearer {str(refresh_token.access_token)}"  # type: ignore # noqa
        )
