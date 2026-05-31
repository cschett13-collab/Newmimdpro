FROM python:3.11-slim

# Run as non-root for safety on the NAS
RUN useradd --create-home --shell /bin/bash zenvy

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bot.py agents.py tools.py ./

# Persistent SQLite + .env mounted from NAS volumes (see docker-compose.yml)
ENV ZENVY_DB_PATH=/data/zenvy.db
VOLUME ["/data"]

USER zenvy
CMD ["python", "bot.py"]
