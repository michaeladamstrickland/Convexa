# syntax=docker/dockerfile:1
FROM node:20-bullseye-slim

WORKDIR /app

# Install only production deps
COPY package*.json ./
RUN npm ci --only=production

# Copy just what the JS server needs
COPY backend ./backend
COPY ops ./ops
COPY infra ./infra

ENV NODE_ENV=production
ENV PORT=8080
ENV SQLITE_DB_PATH=/data/convexa.db
ENV LOCAL_STORAGE_PATH=/data/run_storage
ENV STORAGE_BACKEND=local

# Start integrated JS server (no TS build)
CMD ["node", "backend/integrated-server.js"]
