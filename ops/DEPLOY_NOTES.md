# Convexa AI Deployment Notes

This document contains additional notes and considerations for deploying the Convexa AI application. It complements the main `ops/deploy/deploy.md` guide and the `ops/deploy/env-guard-checklist.md`.

## 1. Infrastructure Provisioning

*   **Terraform/CloudFormation**: For production environments, it is highly recommended to use Infrastructure as Code (IaC) tools like Terraform or AWS CloudFormation to provision and manage all cloud resources (VPC, subnets, databases, Redis, load balancers, Kubernetes clusters, etc.). This ensures consistency, repeatability, and reduces manual errors.
*   **Resource Sizing**:
    *   **Application Servers**: Start with small to medium instances (e.g., 2 vCPU, 4-8GB RAM) and monitor CPU/memory usage. Scale horizontally (add more instances/pods) as traffic increases.
    *   **PostgreSQL**: Choose a managed database service with automatic backups, replication, and scaling capabilities. Monitor IOPS, CPU, and memory.
    *   **Redis**: Select a managed Redis service. Monitor memory usage and connection count.
*   **Auto-scaling**: Implement auto-scaling groups for application servers (e.g., based on CPU utilization or request queue length) to handle varying loads efficiently.

## 2. CI/CD Integration

*   **Automated Deployment**: Integrate the deployment steps into your CI/CD pipeline (e.g., GitHub Actions, GitLab CI, Jenkins).
    *   **Build Stage**: Automatically run `npm install` and `npm run build` on every push to `main` or `develop`.
    *   **Test Stage**: Execute `npm test` and collect coverage reports.
    *   **Deployment Stage**: After successful build and tests, automatically deploy to staging. Manual approval may be required for production deployments.
*   **Rollback Strategy**: Ensure your deployment process supports quick and reliable rollbacks to previous stable versions in case of issues.

## 3. Monitoring and Alerting

*   **Dashboarding**: Create comprehensive Grafana dashboards (using `ops/dashboards/convexa.json` as a base) to visualize key metrics:
    *   Application health (CPU, memory, network I/O)
    *   Request latency and error rates
    *   Queue depths and job processing rates (BullMQ)
    *   Database performance (connections, query times, disk usage)
    *   Redis performance (memory, hits/misses)
    *   Business metrics (leads generated, revenue, conversion rates)
*   **Alerting**: Configure alerts in Prometheus/Grafana for:
    *   High error rates (e.g., 5xx errors)
    *   High latency
    *   Queue backlogs
    *   Resource exhaustion (CPU, memory, disk)
    *   Failed deployments
    *   Security incidents (e.g., failed authentication attempts)

## 4. Security Best Practices

*   **Secrets Management**: Never hardcode secrets. Use dedicated secrets management services (e.g., AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault) or environment variables injected securely.
*   **Image Scanning**: Integrate Docker image scanning into your CI/CD pipeline to detect vulnerabilities in container images.
*   **Runtime Protection**: Consider using runtime application self-protection (RASP) or Web Application Firewalls (WAF) for enhanced security.
*   **Regular Audits**: Conduct regular security audits and penetration testing.

## 5. Data Management

*   **Backups**: Ensure automated, regular backups of your PostgreSQL database. Test restoration procedures periodically.
*   **Data Retention**: Define and implement data retention policies for logs, metrics, and application data to comply with regulations and manage storage costs.
*   **GDPR/CCPA Compliance**: Ensure all data handling, storage, and redaction practices comply with relevant data privacy regulations. Refer to `ops/PII/patterns.txt` for redaction guidance and DSR scripts (`scripts/exportLead.cjs`, `scripts/deleteLead.cjs`).

## 6. Staging Environment

*   **Mirror Production**: The staging environment should closely mirror production in terms of infrastructure, data, and configuration to catch issues before they reach production.
*   **Automated QA**: Run automated QA orchestrator tests (as described in the main task) against the staging environment to validate new deployments.

---

**Last Updated**: 2025-09-21
