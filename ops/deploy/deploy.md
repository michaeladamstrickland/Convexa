# Deployment Guide for Convexa AI

This document outlines the steps required to deploy the Convexa AI application to a production environment. It covers building the application, setting up the environment, and deploying the services.

## 1. Prerequisites

*   **Git**: For cloning the repository.
*   **Node.js (v20 or higher)**: For building the application.
*   **npm**: Node package manager.
*   **Docker & Docker Compose**: For containerization and orchestration.
*   **Kubernetes (Optional)**: For container orchestration in larger deployments.
*   **Cloud Provider Account**: (e.g., AWS, GCP, Azure) with necessary permissions to provision resources.
*   **Nginx**: For reverse proxy, load balancing, and security (IP allowlist, basic auth).
*   **PostgreSQL Database**: Managed service recommended (e.g., AWS RDS, GCP Cloud SQL).
*   **Redis Instance**: Managed service recommended (e.g., AWS ElastiCache, GCP Memorystore) for BullMQ queues and caching.

## 2. Build the Application

First, clone the repository and build the application.

```bash
git clone https://github.com/michaeladamstrickland/Convexa.git
cd Convexa
npm install
npm run build # This will compile TypeScript to JavaScript
```

## 3. Environment Setup

### 3.1. Database Setup

Provision a PostgreSQL database instance. Ensure it's accessible from your application servers.

*   **Database Name**: `convexa_db` (or as configured in your `DATABASE_URL`)
*   **User**: `convexa_user`
*   **Password**: `your_secure_password`

Apply database migrations:

```bash
npx prisma migrate deploy
```

### 3.2. Redis Setup

Provision a Redis instance. This will be used by BullMQ for job queues and potentially for caching.

### 3.3. Environment Variables

Create a `.env` file (or configure environment variables directly in your deployment platform) with the following:

```
NODE_ENV=production
PORT=5001
DATABASE_URL="postgresql://convexa_user:your_secure_password@your_db_host:5432/convexa_db?schema=public"
REDIS_HOST=your_redis_host
REDIS_PORT=6379
OPENAI_API_KEY=your_openai_api_key
ATTOM_API_KEY=your_attom_api_key
SIGNED_URL_SECRET=YOUR_SUPER_SECRET_KEY_FOR_SIGNED_URLS_1234567890
# Add any other secrets or configuration specific to your environment
```

### 3.4. Nginx Configuration

Set up Nginx as a reverse proxy. Refer to `ops/proxy/nginx_samples.md` for examples on IP allowlisting and basic authentication.

Example `nginx.conf` snippet:

```nginx
server {
    listen 80;
    server_name api.your_domain.com;

    # Optional: IP Allowlist
    # allow 192.168.1.0/24;
    # deny all;

    # Optional: Basic Authentication
    # auth_basic "Restricted Area";
    # auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://localhost:5001; # Or your internal application IP/port
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Add other proxy headers as needed
    }

    # For Prometheus scraping
    location /metrics {
        allow 10.0.0.0/8; # Example: Allow Prometheus server IP range
        deny all;
        proxy_pass http://localhost:5001/metrics;
    }
}
```

## 4. Deployment

### 4.1. Docker Deployment

Build and run Docker containers.

```bash
docker-compose build
docker-compose up -d
```

### 4.2. Kubernetes Deployment (Conceptual)

For Kubernetes, you would create `Deployment` and `Service` manifests for your application, Redis, and PostgreSQL.

*   **Deployment**: Defines how your application pods are run.
*   **Service**: Exposes your application to the network.
*   **Ingress**: Manages external access to the services in a cluster, typically with Nginx or similar.

Example (simplified):

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: convexa-ai
spec:
  replicas: 3
  selector:
    matchLabels:
      app: convexa-ai
  template:
    metadata:
      labels:
        app: convexa-ai
    spec:
      containers:
      - name: convexa-ai
        image: your-docker-registry/convexa-ai:latest
        ports:
        - containerPort: 5001
        env:
        - name: NODE_ENV
          value: production
        - name: PORT
          value: "5001"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: convexa-secrets
              key: DATABASE_URL
        - name: REDIS_HOST
          valueFrom:
            secretKeyRef:
              name: convexa-secrets
              key: REDIS_HOST
        # ... other environment variables
---
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: convexa-ai-service
spec:
  selector:
    app: convexa-ai
  ports:
    - protocol: TCP
      port: 5001
      targetPort: 5001
  type: ClusterIP
```

Remember to create Kubernetes secrets for sensitive environment variables.

## 5. Post-Deployment Checks

*   **Verify Application Health**: Access `/health` endpoint.
*   **Monitor Logs**: Ensure application logs are being collected and no critical errors are present.
*   **Prometheus Scrape**: Confirm Prometheus can successfully scrape metrics from `/metrics`.
*   **Functionality Test**: Perform smoke tests to ensure core features are working.
