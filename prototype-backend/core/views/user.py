from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.serializers import CreateUserIn
from core.serializers import ContactUsIn

from core.throttling import ContactUsThrottle


class RegisterView(APIView):
    def post(self, request):
        serializer = CreateUserIn(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {
                "data": {"email": serializer.data["email"]},
                "message": "User created successfully.",
            },
            status=status.HTTP_201_CREATED,
        )


class ContactUsView(APIView):
    throttle_classes = [ContactUsThrottle]

    def post(self, request):
        serializer = ContactUsIn(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {
                "data": serializer.data,
                "message": "Contact details submitted successfully.",
            },
            status=status.HTTP_201_CREATED,
        )
