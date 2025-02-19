pipeline {
  agent any

  stages {
    // stage('Checkout') {
    //   steps {
    //     checkout([$class: 'GitSCM', branches: [
    //       [name: '*/development']
    //     ], userRemoteConfigs: [
    //       [url: 'http://gitlab.elluminatiinc.net/eber-product/web/backend.git']
    //     ]])
    //     dir('/var/lib/jenkins/workspace/eber-backend') {}
    //   }
    // }

    stage('Retrieve GitLab Variables') {
    steps {
        script {
                def response = sh(script: "curl -sS 'http://gitlab.elluminatiinc.com/api/v4/projects/eber-product%2Fweb/backend/variables?per_page=100' --header 'PRIVATE-TOKEN: glpat-sqxByxvgESj9UoAysSqy'", returnStdout: true).trim()

            def gitlabVariables = new groovy.json.JsonSlurper().parseText(response)                        
            DOCKER_IMAGE = gitlabVariables.find { it.key == 'DOCKER_IMAGE' }?.value
            DOCKER_IMAGE_TAG = gitlabVariables.find { it.key == 'DOCKER_IMAGE_TAG' }?.value
            CONTAINER_NAME = gitlabVariables.find { it.key == 'CONTAINER_NAME' }?.value
            DOCKER_USERNAME = gitlabVariables.find { it.key == 'DOCKER_USERNAME' }?.value
            DOCKER_PASSWORD = gitlabVariables.find { it.key == 'DOCKER_PASSWORD' }?.value
            SERVER_PASSWORD = gitlabVariables.find { it.key == 'SERVER_PASSWORD' }?.value
            SERVER_IP = gitlabVariables.find { it.key == 'SERVER_IP' }?.value
            USER_NAME = gitlabVariables.find { it.key == 'USER_NAME' }?.value            
        }
    }
}

    stage('build') {
      when {
                anyOf {
                    branch 'development'
                }
            }
      steps {
        script {
          dir('/var/lib/jenkins/workspace/eber-backend_development/history-earning') {
            echo "DOCKER_IMAGE: ${DOCKER_IMAGE}"
            sh "docker build -t ${DOCKER_IMAGE} ."
            sh "docker tag ${DOCKER_IMAGE}:${DOCKER_IMAGE_TAG} ${DOCKER_USERNAME}/${DOCKER_IMAGE}:${DOCKER_IMAGE_TAG}"
            sh "docker login -u ${DOCKER_USERNAME} -p ${DOCKER_PASSWORD}"
            sh "docker push ${DOCKER_USERNAME}/${DOCKER_IMAGE}:${DOCKER_IMAGE_TAG}"
          }
        }
      }
    }
    
    // stage('deploy') {
    //   steps {
    //     script {
    //       dir('/var/lib/jenkins/workspace/eber-admin_development') {
    //        // sh "sshpass -p '${SERVER_PASSWORD}' rsync -avz ./ ${USER_NAME}@${SERVER_IP}:/var/www/html/eber/admin-panel"
    //         sh "docker login -u ${DOCKER_USERNAME} -p ${DOCKER_PASSWORD}"
    //         sh "sshpass -p '${SERVER_PASSWORD}' ssh ${USER_NAME}@${SERVER_IP} 'docker pull ${DOCKER_USERNAME}/${DOCKER_IMAGE}:${DOCKER_IMAGE_TAG}'"
    //         sh "sshpass -p '${SERVER_PASSWORD}' ssh ${USER_NAME}@${SERVER_IP} 'docker stop ${CONTAINER_NAME} && docker rm ${CONTAINER_NAME}'"
    //         sh "sshpass -p '${SERVER_PASSWORD}' ssh ${USER_NAME}@${SERVER_IP} 'docker run -d -p 9000:9000 --name ${CONTAINER_NAME} ${DOCKER_USERNAME}/${DOCKER_IMAGE}:${DOCKER_IMAGE_TAG}'"
    //       }
    //     }
    //   }
    // }        
}
}

