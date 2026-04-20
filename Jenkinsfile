pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "my-docker-repo/notes-backend"
        DOCKER_TAG = "${env.BUILD_ID}"
        ACTIVE_ENV = "blue" // Or "green", depending on current state, ideally fetched dynamically
        APP_URL = "http://localhost"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Secret Scan (GitLeaks)') {
            steps {
                // Scan workspace files (not full git history) using repo config/allowlist.
                sh 'gitleaks detect --no-git --source . --config=.gitleaks.toml -v'
            }
        }
        
        stage('SAST (Semgrep)') {
            steps {
                // Exclude dependency folders to avoid pathological scan times in CI agents.
                sh 'semgrep scan --config=p/nodejs --config=p/jwt --config=semgrep.yml --exclude backend/node_modules --exclude frontend/node_modules --timeout 300 .'
            }
        }

        stage('Dependency Scan (npm audit)') {
            steps {
                dir('backend') {
                    sh 'npm audit --audit-level=high || true'
                }
                dir('frontend') {
                    sh 'npm audit --audit-level=high || true'
                }
            }
        }
        
        stage('Build & Test') {
            steps {
                dir('backend') {
                    sh 'npm ci'
                    sh "npm test -- --coverageThreshold='{\"global\":{\"branches\":80,\"functions\":80,\"lines\":80,\"statements\":80}}'"
                }
                dir('frontend') {
                    sh 'npm ci'
                    sh 'npm run build'
                }
            }
        }
        
        stage('Docker Build & Image Scan (Trivy)') {
            steps {
                script {
                    docker.withRegistry('https://index.docker.io/v1/', 'dockerhub-creds') {
                        def backendImage = docker.build("${env.DOCKER_IMAGE}:${env.DOCKER_TAG}", "./backend")
                        // Scan image with Trivy before pushing
                        sh "trivy image --exit-code 1 --severity CRITICAL ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}"
                        backendImage.push()
                        backendImage.push("latest")
                    }
                }
            }
        }

        stage('Set Active Environment (Terraform)') {
            steps {
                dir('terraform') {
                    // Terraform renders the active Nginx upstream (blue or green), no AWS required.
                    sh 'terraform init -backend=false'
                    sh "terraform apply -auto-approve -var='active_environment=${ACTIVE_ENV}'"
                }
            }
        }

        stage('Deploy Application (Ansible)') {
            steps {
                dir('ansible') {
                    // Bind deployment secrets from Jenkins Credentials and pass them to Ansible.
                    // Update credential IDs below to match your Jenkins instance.
                    withCredentials([
                        string(credentialsId: 'notes-database-url', variable: 'DATABASE_URL'),
                        string(credentialsId: 'notes-encryption-key', variable: 'NOTE_ENCRYPTION_KEY'),
                        string(credentialsId: 'notes-jwt-private-key', variable: 'JWT_PRIVATE_KEY'),
                        string(credentialsId: 'notes-jwt-public-key', variable: 'JWT_PUBLIC_KEY')
                    ]) {
                        sh "ansible-playbook -i inventory.ini playbook.yml -e 'docker_image_tag=${env.DOCKER_TAG}'"
                    }
                }
            }
        }
        
        stage('DAST (OWASP ZAP)') {
            steps {
                // Use maintained ZAP image and mount workspace config inside container.
                sh 'docker run --rm -t -v "$PWD:/zap/wrk:ro" zaproxy/zap-stable zap-baseline.py -t "${APP_URL}" -c /zap/wrk/zap-baseline.conf || true'
            }
        }
    }
}
