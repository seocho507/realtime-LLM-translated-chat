FROM node:22-bookworm-slim AS web-build
WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ ./
RUN npm run build

FROM python:3.11-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000 \
    DATABASE_URL=sqlite+aiosqlite:////data/talk.db \
    WEB_DIST_DIR=/app/web/dist

WORKDIR /app/backend

RUN mkdir -p /data

COPY backend/pyproject.toml ./pyproject.toml
COPY backend/app ./app
RUN pip install .

COPY --from=web-build /app/web/dist /app/web/dist

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
