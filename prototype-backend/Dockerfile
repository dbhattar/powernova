FROM python:3.12.3

RUN apt-get clean && apt-get update -y && \
    apt-get install -y \
    git \
    curl \
    python3-pip \
    locales\
    libgdal-dev\
    gdal-bin\ 
    python3-gdal\
    gettext

RUN locale-gen en_US.UTF-8
ENV LANG en_US.UTF-8

RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

ARG GITHUB_TOKEN
ENV GITHUB_TOKEN=${GITHUB_TOKEN}

COPY ./requirements.txt /code/requirements.txt
RUN bash -c "/venv/bin/pip install -r <(envsubst < /code/requirements.txt)"

WORKDIR /code

COPY . .

RUN mkdir -p /code/logs