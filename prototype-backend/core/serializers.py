from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

from core.models import CgUser
from core.models import ContactUs


class LoginOut(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = {"full_name": self.user.full_name, "email": self.user.email}  # type: ignore # noqa
        # custom response
        return {"data": data}


class RefreshLoginOut(TokenRefreshSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        # custom response
        return {"data": data}


class CreateUserIn(serializers.ModelSerializer):
    class Meta:
        model = CgUser
        fields = ("email", "password")
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        user = CgUser.objects.create_user(**validated_data)
        return user


class ContactUsIn(serializers.ModelSerializer):
    class Meta:
        model = ContactUs
        fields = "__all__"
