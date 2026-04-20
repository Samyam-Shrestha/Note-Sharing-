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
        



        
        stage('DAST (OWASP ZAP)') {
            steps {
                // Use maintained ZAP image and mount workspace config inside container.
                sh 'docker run --rm -t -v "$PWD:/zap/wrk:ro" zaproxy/zap-stable zap-baseline.py -t "${APP_URL}" -c /zap/wrk/zap-baseline.conf || true'
            }
        }
    }
}
