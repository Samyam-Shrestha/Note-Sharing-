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
                sh "docker build -t ${env.DOCKER_IMAGE}:${env.DOCKER_TAG} ./backend"
                // Trivy scan is commented out as the tool might not be installed natively
                // sh "trivy image --exit-code 1 --severity CRITICAL ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}"
                
                withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', passwordVariable: 'DOCKER_PASS', usernameVariable: 'DOCKER_USER')]) {
                    sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin || true'
                    sh "docker push ${env.DOCKER_IMAGE}:${env.DOCKER_TAG} || true"
                    sh "docker tag ${env.DOCKER_IMAGE}:${env.DOCKER_TAG} ${env.DOCKER_IMAGE}:latest"
                    sh "docker push ${env.DOCKER_IMAGE}:latest || true"
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
