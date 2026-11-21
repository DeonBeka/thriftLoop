# ThriftLoop API — production image (used by Railway; works on any Docker host).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # Everything that must survive redeploys lives on the /data volume.
    DATABASE_URL=sqlite:////data/thriftloop.db \
    UPLOAD_DIR=/data/uploads \
    PRIVATE_UPLOAD_DIR=/data/private_uploads \
    SECRET_FILE=/data/.jwt_secret

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000
# --proxy-headers so rate limiting sees the real client IP behind Railway's proxy;
# long keep-alive avoids iOS "network connection was lost" on reused connections.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*' --timeout-keep-alive 120"]
