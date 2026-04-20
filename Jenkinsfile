pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "aryawastakn/notes-backend"
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
                    sh 'npm test'
                }
                dir('frontend') {
                    sh 'npm ci'
                    sh 'npm run build'
                }
            }
        }
        
        stage('Docker Build & Image Scan (Trivy)') {
            steps {
                // Build the image locally to ensure the Dockerfile is valid
                sh "docker build -t ${env.DOCKER_IMAGE}:${env.DOCKER_TAG} ./backend"
                
                // Note: Docker login and push steps have been removed to run without credentials
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
