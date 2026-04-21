# Interview App — full documentation

Quick local setup: [README.md](README.md).

---

## Структура проекта

```
interview-app/
├── interview-app-frontend/    # Next.js (SSR) → AWS Amplify
├── interview-app-backend/     # NestJS API → ECS Fargate
└── interview-app-workflows/   # Step Functions + Lambda
```

GitHub (alexkochnev1987):
- https://github.com/alexkochnev1987/interview-app-frontend
- https://github.com/alexkochnev1987/interview-app-backend
- https://github.com/alexkochnev1987/interview-app-workflows

---

## Живые URL

### Dev
- **Frontend:** https://develop.d1z0clbcev0y8a.amplifyapp.com
- **Backend API:** https://pjz9l12wad.execute-api.us-east-1.amazonaws.com (постоянный URL через API Gateway + VPC Link)
- **Health check:** https://pjz9l12wad.execute-api.us-east-1.amazonaws.com/health

### Prod (остановлен для экономии)
- **Frontend:** https://main.d2k50usvcss92k.amplifyapp.com
- **Backend API:** будет настроен при запуске prod

### Логин
- Email: `admin@interview-app.com` / `admin123`
- Или через Google OAuth

---

## Начало работы на новом компьютере

### Что нужно установить
```bash
brew install awscli hashicorp/tap/terraform node docker
```

### 1. Настроить AWS CLI
```bash
aws configure
# AWS Access Key ID: (из IAM → Users → terraform_admin → Security credentials)
# AWS Secret Access Key: (оттуда же)
# Region: us-east-1
# Output: json

# Проверить:
aws sts get-caller-identity
```

### 2. Склонировать репозитории
```bash
mkdir ~/interview-app && cd ~/interview-app
git clone git@github.com:alexkochnev1987/interview-app-backend.git
git clone git@github.com:alexkochnev1987/interview-app-frontend.git
git clone git@github.com:alexkochnev1987/interview-app-workflows.git
```

### 3. Переменные окружения (без AWS)

В каждом репозитории есть шаблон: **backend** — `.env.example` → копия в **`.env`**, **frontend** — `.env.example` → копия в **`.env.local`**.

```bash
cd interview-app-backend
cp .env.example .env
# Отредактируй .env: поставь свой JWT_SECRET; Google OAuth можно оставить пустым (вход по email/паролю из раздела «Логин»).

cd ../interview-app-frontend
cp .env.example .env.local
```

**Секреты из AWS не обязательны** для первого запуска: Docker поднимает Postgres и MinIO, `JWT_SECRET` достаточно сгенерировать локально. **Google OAuth** заполняй, если нужен вход через Google (креды из Google Cloud или у владельца).

### 4. Подставить JWT / Google из AWS (опционально)

Если есть доступ к `interview-app/terraform-secrets` в **AWS Secrets Manager**, можно сгенерировать `.env` целиком (как раньше), вместо ручного копирования шаблона:

```bash
cd interview-app-backend

SECRETS=$(aws secretsmanager get-secret-value \
  --secret-id interview-app/terraform-secrets \
  --region us-east-1 --query SecretString --output text)

cat > .env << EOF
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://interview_app:localpass@localhost:5433/interview_app_dev
JWT_SECRET=$(echo $SECRETS | python3 -c "import sys,json;print(json.load(sys.stdin)['jwt_secret'])")
AWS_S3_BUCKET=interview-app-local
S3_PREFIX=dev/
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
S3_ENDPOINT=http://localhost:9002
S3_FORCE_PATH_STYLE=true
GOOGLE_CLIENT_ID=$(echo $SECRETS | python3 -c "import sys,json;print(json.load(sys.stdin)['google_client_id'])")
GOOGLE_CLIENT_SECRET=$(echo $SECRETS | python3 -c "import sys,json;print(json.load(sys.stdin)['google_client_secret'])")
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
FRONTEND_URL=http://localhost:3001
EOF
```

Frontend по-прежнему: `cp .env.example .env.local` (или только `BACKEND_URL`, если файл уже есть).

---

## Локальная разработка

### Быстрый старт (3 команды)
```bash
# Терминал 1: Docker (PostgreSQL + MinIO S3)
cd ~/interview-app/interview-app-backend
docker compose up -d

# Терминал 2: Backend (auto-reload при изменениях)
cd ~/interview-app/interview-app-backend
npm install    # первый раз
npm run start:dev
# Backend: http://localhost:3000

# Терминал 3: Frontend (auto-reload при изменениях)
cd ~/interview-app/interview-app-frontend
npm install    # первый раз
npm run dev
# Frontend: http://localhost:3001
```

### Что запускается в Docker
```
PostgreSQL   localhost:5433   (БД, данные сохраняются в volume)
MinIO (S3)   localhost:9002   (S3 API, совместим с AWS SDK)
MinIO UI     localhost:9003   (Web интерфейс: minioadmin/minioadmin)
```

### Проверить что всё работает
```bash
# Health check
curl http://localhost:3000/health

# Логин
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@interview-app.com","password":"admin123"}'

# MinIO UI (посмотреть загруженные файлы)
open http://localhost:9003
```

### Остановить всё
```bash
cd ~/interview-app/interview-app-backend
docker compose down      # остановить Docker
# Ctrl+C в терминалах 2 и 3
```

---

## Секреты

Все секреты хранятся в **AWS Secrets Manager** (зашифрованы, с аудит-логом):
- `interview-app/terraform-secrets` — DB password, JWT secret, Google OAuth
- `interview-app/github-token` — GitHub token для Amplify
- `interview-app/google-oauth` — Google OAuth credentials

Секреты НИКОГДА не коммитятся в git. Для Terraform используется обёртка:
```bash
cd infra/environments/dev
../../tf.sh plan          # автоматически загружает секреты из AWS
../../tf.sh apply -auto-approve
```

---

## Подключение к AWS (проверка)

```bash
# Проверить авторизацию
aws sts get-caller-identity

# Кластеры ECS
aws ecs list-clusters --region us-east-1

# Статус dev сервиса
aws ecs describe-services --cluster interview-app-dev --services interview-app-dev-backend --region us-east-1 --query "services[0].{status:status,running:runningCount}"

# Расходы за текущий месяц
aws ce get-cost-and-usage --time-period Start=2026-04-01,End=2026-04-30 --granularity MONTHLY --metrics BlendedCost --group-by Type=DIMENSION,Key=SERVICE --region us-east-1
```

---

## CI/CD — как работает

### Backend (GitHub Actions)
```
Push develop → test → Docker build → ECR push → ECS deploy (dev)
Push main    → test → Docker build → ECR push → ECS deploy (prod)
```
Файл: `interview-app-backend/.github/workflows/backend.yml`

### Frontend (GitHub Actions + Amplify)
```
Push develop → GitHub Actions (lint/build тест) + Amplify auto-build (dev deploy)
Push main    → GitHub Actions (lint/build тест) + Amplify auto-build (prod deploy)
```
Файл: `interview-app-frontend/.github/workflows/frontend.yml`
Деплой делает Amplify автоматически (подключён к GitHub).

### Workflows (GitHub Actions)
```
Push develop → package Lambda → deploy → update Step Functions (dev)
Push main    → package Lambda → deploy → update Step Functions (prod)
```
Файл: `interview-app-workflows/.github/workflows/workflows.yml`

---

## Разработка — ежедневный workflow

### Frontend
```bash
cd interview-app-frontend
npm install          # первый раз
npm run dev          # http://localhost:3001

# Готово → push
git add -A && git commit -m "feat: описание" && git push

# Деплой на prod
# Важно: перед push в main для prod backend должен существовать RDS-инстанс
# `interview-app-prod`, иначе prod CI/CD не сможет собрать DATABASE_URL и деплой упадет.
git checkout main && git merge develop && git push origin main
```

### Backend
```bash
cd interview-app-backend
npm install          # первый раз
docker-compose up    # backend + PostgreSQL на localhost:3000

# Или без Docker:
npm run start:dev    # http://localhost:3000

# Готово → push
git add -A && git commit -m "feat: описание" && git push

# Деплой на prod
# Важно: перед push в main для prod backend должен существовать RDS-инстанс
# `interview-app-prod`, иначе prod CI/CD не сможет собрать DATABASE_URL и деплой упадет.
git checkout main && git merge develop && git push origin main
```

### Workflows (Lambda + Step Functions)
```bash
cd interview-app-workflows
cd lambdas/process-interview && npm install && npm run build

# Локальный деплой в dev:
./scripts/deploy.sh process-interview dev

# Через CI/CD — просто push
git push
```

---

## Terraform — инфраструктура

Все Terraform файлы в `interview-app-backend/infra/`.

### Структура
```
infra/
├── bootstrap/           # S3 state + DynamoDB locks (создано один раз)
├── modules/             # Переиспользуемые модули
│   ├── vpc/             # VPC, subnets, security groups
│   ├── iam-oidc/        # GitHub OIDC + IAM roles
│   ├── ecr/             # Docker registry
│   ├── ecs/             # Fargate cluster + service
│   ├── rds/             # PostgreSQL
│   ├── s3/              # Storage bucket
│   ├── amplify/         # Frontend hosting
│   └── stepfunctions/   # State machine + Lambdas
└── environments/
    ├── dev/             # terraform apply → dev ресурсы
    └── prod/            # terraform apply → prod ресурсы
```

### Как работать с Terraform
```bash
cd interview-app-backend/infra/environments/dev

# Посмотреть что изменится (безопасно)
TF_VAR_db_password="TempDevPass123!" terraform plan

# Применить изменения
TF_VAR_db_password="TempDevPass123!" terraform apply

# Посмотреть outputs (IP, ARN, endpoints)
terraform output

# Prod — то же, из environments/prod/
cd ../prod
# Если prod RDS был удален для экономии, перед деплоем main его нужно создать:
# terraform apply поднимет `interview-app-prod`, после чего prod CI/CD сможет подключить БД.
TF_VAR_db_password="TempProdPass456!" terraform apply
```

### Важно: пароли БД
- Dev: `TF_VAR_db_password="TempDevPass123!"`
- Prod: `TF_VAR_db_password="TempProdPass456!"`
- Передаются через env var, НЕ коммитятся

---

## AWS ресурсы

| Ресурс | Dev | Prod |
|--------|-----|------|
| **ECS Cluster** | interview-app-dev | interview-app-prod |
| **ECS Service** | interview-app-dev-backend | interview-app-prod-backend |
| **ECR** | interview-app-backend (shared) | |
| **RDS** | interview-app-dev (db.t4g.micro) | interview-app-prod (db.t4g.small) |
| **S3** | interview-app-storage-289427882196 (shared) | |
| **Amplify** | d1z0clbcev0y8a | d2k50usvcss92k |
| **Step Functions** | interview-app-dev-interview-pipeline | interview-app-prod-interview-pipeline |
| **Lambda** | interview-app-dev-process-interview | interview-app-prod-process-interview |
| | interview-app-dev-generate-report | interview-app-prod-generate-report |
| **VPC** | 10.0.0.0/16 | 10.1.0.0/16 |

### GitHub Secrets (уже настроены)

**Backend repo → Environment dev:**
- `AWS_ROLE_ARN` = `arn:aws:iam::289427882196:role/interview-app-dev-github-backend`

**Backend repo → Environment prod:**
- `AWS_ROLE_ARN` = `arn:aws:iam::289427882196:role/interview-app-prod-github-backend`

**Frontend repo → Environment dev:**
- `AWS_ROLE_ARN` = `arn:aws:iam::289427882196:role/interview-app-dev-github-frontend`
- `AMPLIFY_APP_ID` = `d1z0clbcev0y8a`

**Frontend repo → Environment prod:**
- `AWS_ROLE_ARN` = `arn:aws:iam::289427882196:role/interview-app-prod-github-frontend`
- `AMPLIFY_APP_ID` = `d2k50usvcss92k`

---

## Git — SSH ключи

```
~/.ssh/config:
  github-alex  → alexkochnev1987 (личный, для interview-app)
  github.com   → alexandrkoch-cyw (рабочий)
```

Remote в каждом репо использует `github-alex`:
```
git@github-alex:alexkochnev1987/interview-app-backend.git
```

---

## Budget Alerts

Настроены два алерта на alexkochnev1987@gmail.com:
- **$10/мес** — email при 80% ($8)
- **$20/мес** — email при 80% ($16)

### Проверить текущие расходы:
```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-04-01,End=2026-04-30 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --region us-east-1
```

---

## API Endpoints (Backend)

```
GET    /health                              # healthcheck
GET    /interviews                          # список интервью
POST   /interviews                          # создать интервью
GET    /interviews/:id                      # детали интервью
PATCH  /interviews/:id/complete             # завершить → Step Functions
GET    /interviews/:id/results              # результаты
POST   /upload/presign                      # presigned URL для S3
POST   /upload/complete                     # подтвердить загрузку
```

---

## Управление окружениями (вкл/выкл)

Prod сейчас остановлен для экономии. Dev работает.

### Текущая стоимость
```
Dev:  ~$9/мес  (1 Fargate таск)
Prod: ~$0/мес  (остановлен)
```

### Запустить prod
```bash
# 0. Если prod RDS удаляли для экономии — сначала пересоздать его через Terraform
cd interview-app-backend/infra/environments/prod
TF_VAR_db_password="TempProdPass456!" terraform apply

# 1. Поднять backend
aws ecs update-service --cluster interview-app-prod --service interview-app-prod-backend --desired-count 1 --region us-east-1

# 2. Подождать ~1 мин, узнать новый IP
TASK=$(aws ecs list-tasks --cluster interview-app-prod --service-name interview-app-prod-backend --region us-east-1 --query "taskArns[0]" --output text)
ENI=$(aws ecs describe-tasks --cluster interview-app-prod --tasks "$TASK" --region us-east-1 --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value" --output text)
PROD_IP=$(aws ec2 describe-network-interfaces --network-interface-ids "$ENI" --region us-east-1 --query "NetworkInterfaces[0].Association.PublicIp" --output text)
echo "Prod backend: http://$PROD_IP:3000"

# 3. Обновить BACKEND_URL в Amplify prod
aws amplify update-app --app-id d2k50usvcss92k --environment-variables BACKEND_URL=http://$PROD_IP:3000,NEXT_PUBLIC_ENV=prod --region us-east-1

# 4. Перебилдить фронтенд чтобы подхватил новый IP
aws amplify start-job --app-id d2k50usvcss92k --branch-name main --job-type RELEASE --region us-east-1
```

### Остановить prod
```bash
aws ecs update-service --cluster interview-app-prod --service interview-app-prod-backend --desired-count 0 --region us-east-1
```

### Остановить dev (если не работаешь)
```bash
aws ecs update-service --cluster interview-app-dev --service interview-app-dev-backend --desired-count 0 --region us-east-1
```

### Запустить dev обратно
```bash
# 1. Поднять backend
aws ecs update-service --cluster interview-app-dev --service interview-app-dev-backend --desired-count 1 --region us-east-1

# 2. Узнать новый IP (~1 мин подождать)
TASK=$(aws ecs list-tasks --cluster interview-app-dev --service-name interview-app-dev-backend --region us-east-1 --query "taskArns[0]" --output text)
ENI=$(aws ecs describe-tasks --cluster interview-app-dev --tasks "$TASK" --region us-east-1 --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value" --output text)
DEV_IP=$(aws ec2 describe-network-interfaces --network-interface-ids "$ENI" --region us-east-1 --query "NetworkInterfaces[0].Association.PublicIp" --output text)
echo "Dev backend: http://$DEV_IP:3000"

# 3. Обновить BACKEND_URL в Amplify dev
aws amplify update-app --app-id d1z0clbcev0y8a --environment-variables BACKEND_URL=http://$DEV_IP:3000,NEXT_PUBLIC_ENV=dev --region us-east-1

# 4. Перебилдить фронтенд
aws amplify start-job --app-id d1z0clbcev0y8a --branch-name develop --job-type RELEASE --region us-east-1
```

---

## Экстренные команды

```bash
# Удалить ВСЮ dev инфраструктуру (необратимо!)
cd interview-app-backend/infra/environments/dev
TF_VAR_db_password="x" terraform destroy

# Удалить ВСЮ prod инфраструктуру (необратимо!)
cd interview-app-backend/infra/environments/prod
TF_VAR_db_password="x" terraform destroy
```
