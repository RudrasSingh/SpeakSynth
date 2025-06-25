FROM python:3.11-slim-bookworm

WORKDIR /app

COPY requirements.txt .

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends ffmpeg sqlite3 && \
    rm -rf /var/lib/apt/lists/* && \
    pip install --no-cache-dir -r requirements.txt

RUN useradd -m appuser

RUN mkdir -p /app/data && chown -R appuser:appuser /app

COPY ./app ./app
COPY .env .env
RUN chown -R appuser:appuser /app

USER appuser

ENV SQLITE_DB_PATH=/app/data/speaksynth.db

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
