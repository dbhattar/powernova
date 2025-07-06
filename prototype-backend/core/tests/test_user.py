from core.models import CgUser

from core.tests.base_test import BaseAPITestCase


# class TestRegister(BaseAPITestCase):
#     REGISTER_API = "/api/v1/register/"

#     def test_register_success(self):
#         data = {"email": "testing@test.com", "password": "testing"}
#         response = self.client.post(self.REGISTER_API, data)
#         data = response.json()
#         self.assertEqual(response.status_code, 201)

#     def test_register_fail(self):
#         email = "testing@test.com"
#         password = "testing"
#         CgUser.objects.create_user(email=email, password=password)
#         data = {"email": "testing@test.com", "password": "testing"}
#         response = self.client.post(self.REGISTER_API, data)
#         data = response.json()
#         self.assertEqual(response.status_code, 400)


class TestLogin(BaseAPITestCase):
    LOGIN_API = "/api/v1/login/"
    REFRESH_API = "/api/v1/login/refresh/"

    def setUp(self) -> None:
        email = "testing@test.com"
        password = "testing"
        CgUser.objects.create_user(email=email, password=password)
        return super().setUp()

    def test_login_success(self):
        data = {"email": "testing@test.com", "password": "testing"}
        response = self.client.post(self.LOGIN_API, data)
        data = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", data["data"])

    def test_login_fail(self):
        data = {"email": "testing@test.com", "password": "wrong"}
        response = self.client.post(self.LOGIN_API, data)
        data = response.json()
        self.assertEqual(response.status_code, 401)

    def test_refresh_token(self):
        data = {"email": "testing@test.com", "password": "testing"}
        response = self.client.post(self.LOGIN_API, data)
        data = response.json()
        self.assertEqual(response.status_code, 200)
        refresh_token = data["data"]["refresh"]
        response = self.client.post(
            self.REFRESH_API,
            {
                "refresh": refresh_token,
            },
        )
        data = response.json()
        self.assertEqual(response.status_code, 200)
