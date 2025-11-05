# 🚀 Jenkins CI/CD Setup (Docker Compose + Pipeline)

## Struktur Folder

```
training-apps/
├── app/
│   ├── Dockerfile
│   └── package.json
├── jenkins/
│   └── Dockerfile
├── jenkins-agent/
│   └── Dockerfile
├── Jenkinsfile
├── docker-compose.yml
└── README.md
```

---

## docker-compose.yml

Berikut konfigurasi final dengan **Jenkins**, **Agent**, **SonarQube**, dan **Docker-in-Docker (DinD)**:

```yaml
name: simple

services:
  app:
    build: ./app
    ports:
      - "5050:3000"
    volumes:
      - vol-simple:/app/public/images/
    networks:
      - jenkins-net

  sonarqube:
    image: sonarqube:9.9.1-community
    container_name: simple-sonarqube
    depends_on:
      - db
    ports:
      - "9000:9000"
    environment:
      - SONAR_JDBC_URL=jdbc:postgresql://db:5432/sonar
      - SONAR_JDBC_USERNAME=sonar
      - SONAR_JDBC_PASSWORD=sonar
      - SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true
    volumes:
      - sonarqube_data:/opt/sonarqube/data
      - sonarqube_extensions:/opt/sonarqube/extensions
      - sonarqube_logs:/opt/sonarqube/logs
    deploy:
      resources:
        limits:
          memory: 2g
    networks:
      - jenkins-net

  db:
    image: postgres:15
    container_name: simple-db
    environment:
      - POSTGRES_USER=sonar
      - POSTGRES_PASSWORD=sonar
      - POSTGRES_DB=sonar
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sonar"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - jenkins-net

  jenkins:
    build: ./jenkins
    container_name: simple-jenkins
    user: root
    ports:
      - "8080:8080"
      - "50000:50000"
    volumes:
      - jenkins_home:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock
      - ./Jenkinsfile:/var/jenkins_home/Jenkinsfile:ro
    environment:
      - JAVA_OPTS=-Djenkins.install.runSetupWizard=false
    restart: unless-stopped
    networks:
      - jenkins-net

  dind:
    image: docker:24-dind
    privileged: true
    environment:
      - DOCKER_TLS_CERTDIR=
    ports:
      - "2375:2375"
    volumes:
      - dind_data:/var/lib/docker
    networks:
      - jenkins-net

  agent:
    build: ./jenkins-agent
    container_name: simple-agent
    depends_on:
      - jenkins
    environment:
      - DOCKER_HOST=tcp://dind:2375
      - JENKINS_URL=http://jenkins:8080
      - JENKINS_AGENT_NAME=devops1-agent
      - JENKINS_SECRET=<TOKEN_DARI_JENKINS>
    networks:
      - jenkins-net
    restart: unless-stopped

volumes:
  vol-simple:
  sonarqube_data:
  sonarqube_extensions:
  sonarqube_logs:
  postgres_data:
  jenkins_home:
  dind_data:

networks:
  jenkins-net:
    driver: bridge
```

---

## Dockerfile (Jenkins)

Simpan file di folder jenkins:
```
FROM jenkins/jenkins:lts-jdk17

USER root

RUN apt-get update && \
    apt-get install -y git git-lfs ca-certificates curl libcurl4-openssl-dev && \
    git --version && which git

USER jenkins

```
---


## Dockerfile (Jenkins Agents)

Simpan file di folder jenkins-agents:
```
FROM jenkins/inbound-agent:jdk17

USER root

# Install Node.js, npm, Git, Docker CLI, dan SonarScanner
RUN apt-get update && apt-get install -y \
    curl gnupg2 git git-lfs ca-certificates libcurl4-openssl-dev docker-cli unzip && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    # Install Docker Compose (CLI plugin)
    mkdir -p /usr/local/lib/docker/cli-plugins && \
    curl -SL https://github.com/docker/compose/releases/download/v2.24.7/docker-compose-linux-aarch64 -o /usr/local/lib/docker/cli-plugins/docker-compose && \
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose && \
    # Install SonarScanner CLI
    mkdir -p /opt/sonar-scanner && \
    curl -sLo /tmp/sonar.zip https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-5.0.1.3006.zip && \
    unzip /tmp/sonar.zip -d /opt/sonar-scanner && \
    ln -sf /opt/sonar-scanner/sonar-scanner-*/bin/sonar-scanner /usr/local/bin/sonar-scanner && \
    chmod +x /usr/local/bin/sonar-scanner && \
    rm /tmp/sonar.zip && \
    node -v && npm -v && git --version && docker --version

# Tambahkan SonarScanner ke PATH
ENV PATH="/usr/local/bin:/opt/sonar-scanner/sonar-scanner-5.0.1.3006/bin:${PATH}"

# Nonaktifkan TLS Docker karena kita pakai TCP tanpa sertifikat
ENV DOCKER_TLS_CERTDIR=

USER jenkins

```
---

## Jalankan Jenkins

```bash
docker compose up -d --build 
```

Cek status:
```bash
docker compose ps
```

Akses Jenkins di browser:
```
http://localhost:8080
```

---

## Setup Jenkins Pertama Kali

1. Masuk ke Jenkins UI → **Manage Jenkins → Plugins → Installed plugins**  
   Kamu harus sudah lihat plugin seperti:
   - Pipeline
   - Docker Pipeline
   - Git
   - Blue Ocean
   - SonarQube Scanner

3. Buat user admin baru jika diminta, lalu login kembali.

---

##  Register Agent (Node Worker)

1. Masuk ke Jenkins UI → **Manage Jenkins → Nodes → New Node**  
   - Name: `devops1-agent`  
   - Type: `Permanent Agent`

2. Isi:
   - **# of executors**: `2`
   - **Remote root directory**: `/home/jenkins/agent`
   - **Launch method**: `Launch agent by connecting it to the controller`

3. Simpan, lalu Jenkins akan menampilkan:
   - `JENKINS_URL`
   - `JENKINS_SECRET`

4. Masukkan nilai secret ke `docker-compose.yml` bagian agent:
   ```yaml
   - JENKINS_SECRET=xxxxxx
   ```

5. Jalankan ulang Jenkins:
   ```bash
   docker compose up -d agent
   ```

6. Sekarang agent akan muncul **Connected** di Jenkins UI ✅

---

## Jenkinsfile (Declarative Pipeline)

Simpan file `Jenkinsfile` di root proyek (sejajar dengan compose):

```groovy
pipeline {
    agent { label 'devops1-agent' }

    stages {
        stage('Pull SCM') {
            steps {
                git branch: 'main', url: 'https://github.com/mubinibum/training-app.git'
            }
        }
        
        stage('Build') {
            steps {
                sh'''
                cd app
                npm install
                '''
            }
        }
        
        stage('Testing') {
            steps {
                sh'''
                cd app
                npm test
                npm run test:coverage
                '''
            }
        }
        
        stage('Code Review') {
            steps {
                sh'''
                cd app
                sonar-scanner \
                    -Dsonar.projectKey=simple-apps \
                    -Dsonar.sources=. \
                    -Dsonar.host.url=http://sonarqube:9000 \
                    -Dsonar.login=sqp_2b775a77230f12e4d0f12a5a3716022a375f63d5
                '''
            }
        }
        
       stage('Deploy') {
            steps {
                sh '''
                docker compose pull app || true
                docker compose build --pull app
                docker compose up -d --force-recreate app
                '''
            }
        }

        
        stage('Backup') {
            steps {
                 sh 'docker compose push' 
            }
        }
    }
}
```

---

## Buat Pipeline di Jenkins

1. Di Jenkins UI → **New Item → Pipeline**
2. Isi nama, lalu pilih:
   - **Definition**: *Pipeline script from SCM*
   - **SCM**: *Git*
   - **Repository URL**: `https://github.com/username/simple-apps.git`
   - **Script Path**: `Jenkinsfile`
3. Klik **Save → Build Now**

---

## Tips Tambahan

- Jika plugin belum muncul, kamu bisa update manual lewat:
  ```
  docker exec -it simple-jenkins jenkins-plugin-cli --plugins workflow-aggregator git blueocean docker-workflow
  docker restart simple-jenkins
  ```
- Jika pipeline gagal karena `docker compose not found`, pastikan Jenkins container punya akses ke `/var/run/docker.sock` (sudah ada di compose).

---

## Summary

| Komponen | Deskripsi |
|-----------|------------|
| `jenkins` | Controller (UI + Scheduler) |
| `agent` | Worker node tempat build/test jalan |
| `Dockerfile` | Otomatis install plugin pipeline |
| `Jenkinsfile` | Script CI/CD pipeline |
| `docker.sock` | Agar Jenkins bisa akses Docker di host |

---

Sekarang Jenkins kamu sudah full CI/CD ready 🎉  
Pipeline bisa build aplikasi, testing, code review via SonarQube, sampai deploy container secara otomatis.

---
