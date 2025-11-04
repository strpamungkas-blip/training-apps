# 🚀 Jenkins CI/CD Setup (Docker Compose + Pipeline)

## Struktur Folder

```
training-apps/
├── app/
│   ├── Dockerfile
│   ├── package.json
│   └── index.js
├── jenkins/
│   └── Dockerfile
├── Jenkinsfile
├── docker-compose.yml
└── README.md
```

---

## docker-compose.yml

Update file `docker-compose.yml` di root proyek:

```yaml
version: "3.9"

services:
  jenkins:
    image: jenkins/jenkins:lts-jdk17
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

  agent:
    image: jenkins/inbound-agent:jdk17
    container_name: simple-agent
    depends_on:
      - jenkins
    environment:
      - JENKINS_URL=http://jenkins:8080
      - JENKINS_AGENT_NAME=devops1-agent
      - JENKINS_SECRET=<TOKEN_DARI_JENKINS>
    restart: unless-stopped

volumes:
  vol-simple:
  sonarqube_data:
  sonarqube_extensions:
  sonarqube_logs:
  postgres_data:
  jenkins_home:
```

---

## Jalankan Jenkins

```bash
docker compose up -d jenkins agent
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
                git branch: 'main', url: 'https://github.com/username/simple-apps.git'
            }
        }

        stage('Build') {
            steps {
                sh '''
                cd app
                npm install
                '''
            }
        }

        stage('Testing') {
            steps {
                sh '''
                cd app
                npm test || true
                npm run test:coverage || true
                '''
            }
        }

        stage('Code Review') {
            steps {
                sh '''
                cd app
                sonar-scanner \
                    -Dsonar.projectKey=Simple-Apps \
                    -Dsonar.sources=. \
                    -Dsonar.host.url=http://sonarqube:9000 \
                    -Dsonar.login=<SONAR_TOKEN>
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh 'docker compose up --build -d'
            }
        }

        stage('Backup') {
            steps {
                sh 'docker compose push || true'
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
