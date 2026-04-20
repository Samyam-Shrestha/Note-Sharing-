# Secure CI/CD Notes Application

Production-oriented sample stack for a note-sharing app with security-first CI/CD.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- Containers: Docker + Docker Compose
- CI/CD: GitHub Actions
- Registry: GHCR
- Deploy: Kubernetes manifests
- Security scans: GitLeaks, Semgrep, Trivy, OWASP ZAP

## ASCII Pipeline Diagram

```text
Developer Commit/PR
   |
   v
Branch Protection + Required Reviewers
   |
   v
Merge to main -> Webhook Trigger
   |
   v
[CI]
  - GitLeaks secret scan
  - Build + Unit/Integration tests + Coverage gate (80%)
  - Semgrep SAST
  - npm audit + Snyk dependency scan
  - Docker build
  - Trivy image scan (CRITICAL fails)
  - Cosign keyless sign
  - Push to GHCR
   |
   v
[CD - Staging]
  - Deploy to notes-staging
  - Smoke test /health
  - OWASP ZAP baseline
   |
   v
Manual Approval (GitHub Environment reviewers)
   |
   v
[CD - Production]
  - Blue/Green switch
  - Health validation
  - Auto rollback on failure <= 60s
   |
   v
Monitoring + Alerting + SIEM
```

## Local Development

1. Copy `.env.example` to `.env` and replace placeholders.
2. Run:
   - `docker compose --profile dev up --build`
3. App endpoints:
   - Frontend: `http://localhost:3000`
   - Backend health: `http://localhost:4000/health`
   - pgAdmin: `http://localhost:5050`

## Security Notes

- No secrets are hardcoded; all sensitive values come from env vars or secret stores.
- Backend enforces:
  - `helmet` headers
  - CORS allowlist (`FRONTEND_ORIGIN`)
  - RS256 JWT validation
  - API rate limits (general + stricter auth)
  - AES-256-GCM note encryption at write-time
  - PostgreSQL SSL transport (`sslmode=require`)

## Kubernetes Deployment

1. Create namespaces:
   - `kubectl apply -f k8s/namespace.yaml`
2. Create required secrets per namespace:
   - `notes-backend-secrets` with DB URL, JWT keys, encryption key, frontend origin.
   - `notes-postgres-secrets` with `POSTGRES_*`.
3. Apply manifests:
   - `kubectl apply -f k8s/rbac.yaml -n notes-staging`
   - `kubectl apply -f k8s/postgres-statefulset.yaml -n notes-staging`
   - `kubectl apply -f k8s/backend-deployment.yaml -n notes-staging`
   - `kubectl apply -f k8s/frontend-deployment.yaml -n notes-staging`
   - `kubectl apply -f k8s/services.yaml -n notes-staging`
   - `kubectl apply -f k8s/ingress.yaml -n notes-staging`
   - `kubectl apply -f k8s/network-policy.yaml -n notes-staging`
   - `kubectl apply -f k8s/hpa.yaml -n notes-staging`

Repeat for `notes-production`.

## GitHub Actions Secrets Required

- `SNYK_TOKEN`
- `KUBE_CONFIG`
- `STAGING_URL`
- `PRODUCTION_URL`

## Production Hardening Checklist

- Use managed secrets: Vault or cloud secrets manager synced to K8s Secrets.
- Pin image digests in deployments.
- Enable OIDC workload identity for cluster pulls.
- Configure SIEM ingestion from app, ingress, and cluster audit logs.
- Add dedicated integration tests for ACL and sharing edge cases.
