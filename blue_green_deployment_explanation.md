# Blue-Green Deployment Architecture

## Overview
This document explains the transition from the previous Kubernetes-based deployment to a new Blue-Green deployment architecture using Jenkins, Terraform, AWS EC2, and Ansible. This approach ensures zero-downtime deployments while keeping the infrastructure simple and manageable.

## Components

### 1. Jenkins (CI/CD Pipeline)
Jenkins orchestrates the entire workflow. Upon code push:
- It runs security scans (GitLeaks, Semgrep, Trivy, npm audit).
- It builds the application and creates new Docker images.
- It pushes these images to the container registry.
- It triggers Terraform to ensure infrastructure is present.
- It runs Ansible to deploy the built containers to the target environment.

### 2. Terraform (Infrastructure Provisioning)
Terraform manages the AWS infrastructure. It provisions:
- A VPC with public subnets.
- Two identical EC2 instances: **Blue** and **Green**.
- An Application Load Balancer (ALB) with a listener routing HTTP traffic.
- Target Groups for both Blue and Green instances.
- CloudWatch Log Groups for application logs.

The active environment is controlled by the `active_environment` variable in Terraform. If it is set to `blue`, the ALB routes all production traffic to the Blue instance's Target Group.

### 3. Ansible (Configuration Management & Deployment)
Ansible configures the raw EC2 instances and deploys the application.
- It installs Docker, Docker Compose, and the Amazon CloudWatch Agent.
- It copies the `docker-compose.prod.yml` to the server.
- It pulls the newly built Docker images and starts the containers.

## The Blue-Green Deployment Process

Suppose the current live environment is **Blue** (`active_environment = "blue"` in Terraform).

1. **Build & Scan**: Jenkins builds the new version of the code, runs tests, and security scans.
2. **Deploy to Inactive (Green)**: Jenkins triggers Ansible to deploy the new Docker images to the **Green** environment. The Green environment starts running the new code, but it is not yet receiving production traffic from the ALB.
3. **Health Check**: Jenkins or an administrator verifies that the Green environment is healthy and the application is functioning correctly.
4. **Traffic Switch**: The `active_environment` variable in Terraform is updated to `green`. Jenkins runs `terraform apply`, which instantly modifies the ALB listener to route all incoming traffic to the Green Target Group.
5. **Monitoring (CloudWatch)**: The CloudWatch agent installed on both machines streams logs to AWS CloudWatch for monitoring. OWASP ZAP runs against the new live environment to ensure security baseline compliance.

### Rollback
If an issue is detected in the Green environment after switching, rolling back is instantaneous. The Terraform variable is changed back to `blue`, routing traffic back to the old, unmodified environment.

## Database (Neon DB)
As requested, the Neon DB (PostgreSQL) remains entirely unchanged. Both Blue and Green environments connect to the same external database using the `DATABASE_URL` environment variable passed to the backend container.
