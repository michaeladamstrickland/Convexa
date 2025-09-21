# Environment Guardrails Checklist for Production Deployment

This checklist ensures that critical environment variables and security configurations are properly set up before deploying to a production or staging environment. This helps prevent common security vulnerabilities and operational issues.

## Pre-Deployment Checklist

### 1. Environment Variables

*   [ ] **`NODE_ENV`**: Set to `production`.
    *   **Rationale**: Ensures optimized performance, disables development-only features, and enables production-grade logging.
*   [ ] **`PORT`**: Set to a non-default port (e.g., `5001`) if running behind a proxy, or a standard port (e.g., `80`, `443`) if directly exposed.
    *   **Rationale**: Avoids port conflicts and adheres to best practices for containerized applications.
*   [ ] **`DATABASE_URL`**: Configured with production database credentials and host.
    *   **Rationale**: Connects to the correct, secure, and performant database instance.
*   [ ] **`REDIS_HOST`**: Configured with production Redis instance host.
    *   **Rationale**: Connects to the correct, secure, and performant Redis instance for queues and caching.
*   [ ] **`REDIS_PORT`**: Configured with production Redis instance port (default `6379`).
    *   **Rationale**: Ensures correct connectivity to Redis.
*   [ ] **`OPENAI_API_KEY`**: Set with a valid, production-ready OpenAI API key.
    *   **Rationale**: Enables AI functionalities with appropriate access controls and usage limits.
*   [ ] **`ATTOM_API_KEY`**: Set with a valid, production-ready ATTOM API key.
    *   **Rationale**: Enables property data enrichment with appropriate access controls and usage limits.
*   [ ] **`SIGNED_URL_SECRET`**: Set with a strong, unique, and confidential secret.
    *   **Rationale**: Ensures the integrity and security of signed URLs, preventing tampering and unauthorized access.
*   [ ] **All other sensitive keys/secrets**: (e.g., AWS credentials, third-party API keys) are set and managed securely (e.g., Kubernetes Secrets, AWS Secrets Manager, HashiCorp Vault).
    *   **Rationale**: Prevents exposure of sensitive information in code or configuration files.

### 2. Network and Security

*   [ ] **Firewall Rules**: Configured to allow only necessary inbound traffic (e.g., HTTP/HTTPS from load balancer, SSH for admin access).
    *   **Rationale**: Minimizes attack surface.
*   [ ] **Nginx/Load Balancer**: Properly configured for:
    *   [ ] **HTTPS**: All traffic is served over HTTPS with valid SSL/TLS certificates.
    *   [ ] **IP Allowlist**: Critical endpoints (e.g., `/admin`, `/metrics`) are restricted to trusted IP ranges (refer to `ops/proxy/nginx_samples.md`).
    *   [ ] **Basic Authentication**: Critical endpoints are protected with basic auth (refer to `ops/proxy/nginx_samples.md`).
    *   [ ] **Rate Limiting**: Implemented to protect against abuse and DDoS attacks.
    *   **Rationale**: Enhances data encryption, access control, and service availability.
*   [ ] **VPC/Network Segmentation**: Application components are deployed in private subnets with appropriate network access controls.
    *   **Rationale**: Isolates sensitive components and limits lateral movement in case of a breach.

### 3. Logging and Monitoring

*   [ ] **Centralized Logging**: Application logs are directed to a centralized logging system (e.g., ELK Stack, Splunk, CloudWatch Logs).
    *   **Rationale**: Facilitates troubleshooting, auditing, and security analysis.
*   [ ] **Metrics Collection**: Prometheus or similar agents are configured to scrape metrics from the `/metrics` endpoint.
    *   **Rationale**: Provides visibility into application performance and health.
*   [ ] **Alerting**: Critical alerts are configured for errors, performance degradation, and security incidents.
    *   **Rationale**: Ensures timely response to operational issues.
*   [ ] **PII Redaction**: Log redaction patterns (from `ops/PII/patterns.txt`) are applied to prevent sensitive data from appearing in logs.
    *   **Rationale**: Complies with data privacy regulations and reduces data exposure risk.

### 4. Database Security

*   [ ] **Least Privilege**: Database users have only the minimum necessary permissions.
    *   **Rationale**: Limits the impact of compromised credentials.
*   [ ] **Encryption at Rest**: Database data is encrypted at rest.
    *   **Rationale**: Protects data even if storage is compromised.
*   [ ] **Encryption in Transit**: Connections to the database are encrypted (SSL/TLS).
    *   **Rationale**: Prevents eavesdropping on data in transit.

### 5. Application Security

*   [ ] **Dependency Scanning**: All third-party dependencies are scanned for known vulnerabilities.
    *   **Rationale**: Mitigates risks from vulnerable libraries.
*   [ ] **Input Validation**: All user inputs are validated to prevent injection attacks (SQL, XSS, etc.).
    *   **Rationale**: Prevents common web vulnerabilities.
*   [ ] **Error Handling**: Generic error messages are returned to clients; detailed errors are logged internally.
    *   **Rationale**: Prevents information leakage that could aid attackers.

## Sign-off

*   [ ] All items in this checklist have been reviewed and addressed.
*   [ ] Any deviations or risks have been documented and approved.

**Date**: [YYYY-MM-DD]
**Reviewed By**: [Name/Team]
