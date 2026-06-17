# Lightsail migration runbook

This runbook moves the current AWS dev database to a single Lightsail
production server. The server runs Postgres with pgvector, the backend
container, and Caddy. Interview media stays in S3.

## Target shape

- Lightsail Linux instance, `$12/mo`, `2 GB RAM`, `2 vCPU`, `60 GB SSD`
- Static IPv4 attached to the instance
- `api.example.com` points to the Lightsail static IP
- Backend runs behind Caddy HTTPS
- Postgres data lives in the Docker `postgres_data` volume
- Database backups are uploaded to S3

## 1. Create the Lightsail instance

Create an Ubuntu Lightsail instance and attach a Static IP.

Open inbound ports:

- `22/tcp` from your IP only
- `80/tcp` from `0.0.0.0/0`
- `443/tcp` from `0.0.0.0/0`

Do not expose Postgres publicly.

## 2. Install runtime packages on the instance

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin awscli postgresql-client git
sudo usermod -aG docker ubuntu
```

Log out and back in so the `docker` group is applied.

## 3. Copy or clone the backend repo

```bash
git clone https://github.com/alexkochnev1987/interview-app-backend.git
cd interview-app-backend
```

If the repo is private, use SSH deploy keys or copy the project over `scp`.

## 4. Configure production env

```bash
cp .env.lightsail.example .env.lightsail
nano .env.lightsail
```

Required values:

- `API_DOMAIN`
- `FRONTEND_URL`
- `GOOGLE_CALLBACK_URL`
- `JWT_SECRET`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `BACKUP_S3_URI`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- AI/OpenAI values if AI flows are enabled

Keep `POSTGRES_PASSWORD` and the password inside `DATABASE_URL` identical.

## 5. Prepare DNS

Before the final switch, create a temporary test DNS record:

```text
api-staging.example.com A LIGHTSAIL_STATIC_IP
```

Set `API_DOMAIN=api-staging.example.com` for the first verification pass. After
verification, change it to the production API domain and point that record to the
same static IP.

## 6. Find the current AWS database

The current source database is expected to be an AWS RDS Postgres instance.
First refresh AWS SSO if needed:

```bash
aws sso login
```

Then list RDS instances:

```bash
aws rds describe-db-instances \
  --region us-east-1 \
  --query 'DBInstances[].{id:DBInstanceIdentifier,engine:Engine,status:DBInstanceStatus,endpoint:Endpoint.Address,port:Endpoint.Port,db:DBName,class:DBInstanceClass}' \
  --output table
```

Build the source connection string:

```text
postgresql://USER:PASSWORD@RDS_ENDPOINT:5432/DB_NAME
```

Use the real database username/password from the current dev secrets.

## 7. Dump the current AWS dev database

The dev RDS instance is private, so the preferred dump path is a one-off ECS
Fargate task in the same VPC/security group. It reads the existing backend task
definition, uses its `DATABASE_URL`, and uploads the dump to S3:

```bash
./scripts/lightsail/dump-aws-dev-rds-to-s3.sh
```

The script prints the S3 object URI after a successful run. Example:

```text
s3://interview-app-storage-289427882196/dev/db-backups/aws-dev-before-lightsail-YYYYMMDDTHHMMSSZ.dump
```

Alternative path, only if your machine can reach the RDS endpoint:

```bash
export SOURCE_DATABASE_URL='postgresql://USER:PASSWORD@RDS_ENDPOINT:5432/DB_NAME'
./scripts/lightsail/dump-source-db.sh backups/aws-dev-before-lightsail.dump
```

## 8. Move the dump to Lightsail

Download the S3 dump on the Lightsail instance:

```bash
aws s3 cp s3://interview-app-storage-289427882196/dev/db-backups/aws-dev-before-lightsail-YYYYMMDDTHHMMSSZ.dump backups/aws-dev-before-lightsail.dump
```

Or copy it through your local machine:

```bash
aws s3 cp s3://interview-app-storage-289427882196/dev/db-backups/aws-dev-before-lightsail-YYYYMMDDTHHMMSSZ.dump backups/aws-dev-before-lightsail.dump
scp backups/aws-dev-before-lightsail.dump ubuntu@LIGHTSAIL_STATIC_IP:/home/ubuntu/interview-app-backend/backups/
```

## 9. Start Postgres and restore

On the Lightsail instance:

```bash
docker compose -f docker-compose.lightsail.yml up -d postgres
CONFIRM_RESTORE=yes ./scripts/lightsail/restore-to-lightsail-db.sh backups/aws-dev-before-lightsail.dump
```

The restore script uses `pg_restore --clean --if-exists` against the target
database configured in `.env.lightsail`.

## 10. Run migrations and start backend

```bash
docker compose -f docker-compose.lightsail.yml run --rm migrate
docker compose -f docker-compose.lightsail.yml up -d --build backend caddy
```

Check status:

```bash
docker compose -f docker-compose.lightsail.yml ps
docker compose -f docker-compose.lightsail.yml logs --tail=100 backend
```

## 11. Verify before switching production traffic

Check:

```bash
curl -f https://api-staging.example.com/health
curl -f https://api-staging.example.com/openapi.json
```

Then verify in the app:

- login with an existing migrated user
- list users/interviews/questions
- create a test interview
- request an upload URL
- upload/read media through S3
- run the AI flow if it is enabled

If Google OAuth is used, add this callback in Google Cloud Console during the
staging check:

```text
https://api-staging.example.com/auth/google/callback
```

## 12. Final cutover

When staging is verified:

1. Stop writes on the old AWS dev environment or enable maintenance mode.
2. Take a fresh dump:

   ```bash
   ./scripts/lightsail/dump-aws-dev-rds-to-s3.sh
   ```

3. Copy the new S3 object to Lightsail.
4. Restore it:

   ```bash
   CONFIRM_RESTORE=yes ./scripts/lightsail/restore-to-lightsail-db.sh backups/final-aws-dev-before-cutover.dump
   docker compose -f docker-compose.lightsail.yml run --rm migrate
   docker compose -f docker-compose.lightsail.yml restart backend
   ```

5. Change `.env.lightsail` from staging API domain to production API domain.
6. Restart Caddy:

   ```bash
   docker compose -f docker-compose.lightsail.yml up -d caddy
   ```

7. Point production DNS to the Lightsail static IP.

## 13. Enable daily backups

On the Lightsail instance:

```bash
crontab -e
```

Add:

```cron
15 2 * * * cd /home/ubuntu/interview-app-backend && ./scripts/lightsail/backup-lightsail-db.sh >> backups/backup.log 2>&1
```

Run one backup manually:

```bash
./scripts/lightsail/backup-lightsail-db.sh
```

Confirm the file appears under `BACKUP_S3_URI`.

## 14. Turn off old AWS resources

Do this only after the Lightsail app works with production DNS and a fresh backup
exists in S3.

For the current Terraform setup, the expensive resources to check are:

- old ECS service
- old RDS instance, only after final backup and restore verification
- API Gateway / VPC Link
- Amplify app if frontend also moves away
- old public IPv4 addresses
- CloudWatch log groups

Keep the final S3 dump for rollback.
