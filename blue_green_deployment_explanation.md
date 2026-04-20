# Blue-Green Deployment Architecture

## Overview
This document explains the Blue-Green deployment architecture using Jenkins, Terraform, Ansible, Nginx, and Prometheus. This approach ensures zero-downtime deployments while keeping the runtime simple and observable.

## Components

### 1. Jenkins (CI/CD Pipeline)
Jenkins orchestrates the entire workflow. Upon code push:
- It runs security scans (GitLeaks, Semgrep, Trivy, npm audit).
- It builds the application and creates new Docker images.
- It pushes these images to the container registry.
- It triggers Terraform to select the active Blue/Green target for Nginx.
- It runs Ansible to deploy/update Docker services, Nginx routing, and Prometheus monitoring.

### 2. Terraform (Infrastructure Provisioning)
Terraform is used to manage deployment state (active color) by rendering Nginx upstream configuration from the `active_environment` variable. If it is set to `blue`, Nginx routes production traffic to Blue services; if set to `green`, it routes to Green services.

### 3. Ansible (Configuration Management & Deployment)
Ansible configures target hosts and deploys the application.
- It installs Docker and Docker Compose.
- It copies the `docker-compose.prod.yml` to the server.
- It copies Nginx and Prometheus configuration.
- It pulls the newly built Docker images and starts the containers.
- It runs Nginx as the Blue/Green traffic switch and Prometheus for monitoring.

## The Blue-Green Deployment Process

Suppose the current live environment is **Blue** (`active_environment = "blue"` in Terraform).

1. **Build & Scan**: Jenkins builds the new version of the code, runs tests, and security scans.
2. **Deploy to Inactive (Green)**: Jenkins triggers Ansible to deploy the new Docker images to the **Green** environment. Green starts running the new code, but it is not yet receiving production traffic.
3. **Health Check**: Jenkins or an administrator verifies that the Green environment is healthy and the application is functioning correctly.
4. **Traffic Switch**: The `active_environment` variable in Terraform is updated to `green`. Jenkins runs `terraform apply`, which regenerates Nginx upstream routing to direct traffic to Green.
5. **Monitoring (Prometheus)**: Prometheus continuously scrapes runtime metrics (host and container metrics) while OWASP ZAP runs against the live endpoint for baseline security validation.

### Rollback
If an issue is detected in the Green environment after switching, rolling back is instantaneous. The Terraform variable is changed back to `blue`, routing traffic back to the previous environment.

## Database (Neon DB)
As requested, the Neon DB (PostgreSQL) remains entirely unchanged. Both Blue and Green environments connect to the same external database using the `DATABASE_URL` environment variable passed to the backend container.
