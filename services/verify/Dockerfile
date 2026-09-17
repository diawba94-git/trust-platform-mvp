FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*
COPY packages/backend-shared /packages/backend-shared
RUN pip install --no-cache-dir /packages/backend-shared
COPY services/verify/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/verify/app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
