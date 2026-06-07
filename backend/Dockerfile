FROM python:3.12-slim

WORKDIR /app

# System deps for ML libs (lightgbm/prophet/xgboost) + psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Install full ML stack; if any wheel is unavailable the app still runs via fallbacks.
RUN pip install --no-cache-dir -r requirements.txt || pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
