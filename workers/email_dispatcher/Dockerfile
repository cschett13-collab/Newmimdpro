# syntax=docker/dockerfile:1.7
# Minimal Python image for the dispatcher worker — stdlib only, no pip deps.
FROM python:3.12-alpine

WORKDIR /app

# Run as non-root, owning the mounted /data volume.
RUN addgroup -S dispatcher \
 && adduser -S -G dispatcher -u 1001 dispatcher \
 && mkdir -p /data \
 && chown -R dispatcher:dispatcher /data /app

COPY --chown=dispatcher:dispatcher dispatcher.py schema.sql ./

USER dispatcher
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DISPATCHER_DB=/data/lead_queue.db \
    DISPATCHER_SCHEMA=/app/schema.sql

VOLUME ["/data"]
CMD ["python", "-u", "/app/dispatcher.py"]
