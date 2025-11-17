#!/bin/sh
set -e

echo "Starting SSH daemon..."
/usr/sbin/sshd

echo "Starting FastAPI application..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1