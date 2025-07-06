# Write tests for Contact Us

from rest_framework import status

from core.tests.base_test import BaseAPITestCase

from core.models import ContactUs


class ContactUsTest(BaseAPITestCase):
    URL = "/api/v1/contact/"

    def test_contact_us(self):
        data = {
            "name": "test",
            "email": "4Y9Qx@example.com",
            "message": "test",
        }
        response = self.client.post(self.URL, data)
        self.assertTrue(ContactUs.objects.filter(email=data["email"]).exists())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_contact_us_email_required(self):
        data = {
            "name": "test",
            "message": "test",
        }
        response = self.client.post(self.URL, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["email"][0], "This field is required.")

    def test_contact_us_name_required(self):
        data = {
            "email": "4Y9Qx@example.com",
            "message": "test",
        }
        response = self.client.post("/api/v1/contact/", data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["name"][0], "This field is required.")
