FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app

EXPOSE 8000

# Auto-migrate on deploy: run Alembic from the migrations bundled in this
# image, then start the API behind a reverse proxy (forward X-Forwarded-* so
# rate limiting sees the real client IP). If the DB is unreachable the app
# still boots on its in-memory store, matching the dev fallback behaviour.
CMD ["sh", "-c", \
    "alembic upgrade head 2>/dev/null || echo '[mausam] migrations skipped (DB unavailable); continuing on in-memory store'; " \
    "exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]