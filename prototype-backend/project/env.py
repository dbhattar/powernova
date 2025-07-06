from pydantic_settings import BaseSettings
from pydantic_settings import SettingsConfigDict


class Environment(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    DEBUG: bool = True
    SECRET_KEY: str = (
        "django-insecure-_^m87ihn)(jw)_us9p5f!60v-fo3ajlovyat5+goa!nglu(+wi"
    )
    ALLOWED_HOSTS: str = "*"
    ACCESS_TOKEN_LIFETIME_DAYS: int = 7
    REFRESH_TOKEN_LIFETIME_DAYS: int = 14
    POSTGRES_DB: str = "cosmic_global"
    POSTGRES_USER: str = "root"
    POSTGRES_PASSWORD: str = "root"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5433
    MAILGUN_API_KEY: str = "key-1234567890"
    MAILGUN_HOSTNAME: str = "sandbox1234567890.mailgun.org"
    ENVIRONMENT: str = "development"
    CORS_ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:8000"
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    GITHUB_TOKEN: str = "ghp_1234567890"
    DATA_UPLOAD_MAX_NUMBER_FIELDS: int = 100000000
    COSMIC_AI_API_KEY: str = "secret"
    COSMIC_AI_URL: str = "http://localhost:8000"
    FORECAST_LENGTH: int = 90


ENV = Environment()
