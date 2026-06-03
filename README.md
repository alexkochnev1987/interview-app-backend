# Interview App — Backend

NestJS API. **Docker Compose** in this repo runs PostgreSQL and MinIO for local development.

## Local setup

**Requirements:** Node.js 22, Docker.

```bash
git clone https://github.com/alexkochnev1987/interview-app-backend.git
cd interview-app-backend

cp .env.example .env
# Set JWT_SECRET; you can leave Google OAuth empty and use email/password sign-in.

docker compose up -d
npm install
npm run start:dev
```

- API: http://localhost:3000  
- Check: `curl http://localhost:3000/health`

## Tests

Unit test: behavior risk scoring (`answer-behavior-risk.spec.ts`). Everything else is integration.

```bash
docker compose up -d
npm run test:integration
npm run test
```

Uses seed users (created on first run):

| Role | Email | Password |
|------|-------|----------|
| super_admin | `admin@test.local` | `TestPass123!` |
| admin | `staff-admin@test.local` | `TestPass123!` |
| hr | `hr@test.local` | `TestPass123!` |

**Coverage:** auth session, permissions by role, recruiter journey (question CRUD → interview → candidate link), candidate take flow (`take-flow.integration.spec.ts`), interview APIs, API contract negatives (400/401/403).

Integration specs share one Nest app per Jest run (`test/helpers/integration-app.ts`). Each test calls `useIntegrationHarness()` to truncate/reseed the DB and reset the Supertest agent so state does not leak between tests.

Integration covers role/permission rules; the only unit spec today is behavior risk scoring (`answer-behavior-risk.spec.ts`). S3/MinIO defaults in `test/integration-env.ts` are for local Docker — CI omits them until upload/presign integration tests add a MinIO service.

PostgreSQL on host **5433**, MinIO S3 API **9002**, MinIO web console **9003** (`minioadmin` / `minioadmin`).

## API Documentation

- **Swagger UI**: [http://localhost:3000/docs](http://localhost:3000/docs) — Interactive API exploration.
- **OpenAPI Spec**: [http://localhost:3000/openapi.json](http://localhost:3000/openapi.json) — Raw machine-readable contract.

## API Contract Maintenance

We use OpenAPI (Swagger) as the single source of truth for our API contract. This ensures frontend and backend stay in sync and enables automatic type generation.

### Scripts

- `npm run openapi:generate`: Generates a fresh `openapi/openapi.json` from the current code.
- `npm run openapi:validate`: Validates the generated spec for correctness.
- `npm run openapi:check`: Runs both generate and validate, then checks if there are any uncommitted changes to `openapi/openapi.json`.

### CI Integration

The `openapi:check` command is part of the CI pipeline (`backend.yml`). It ensures that:
1. The `openapi/openapi.json` file is always up-to-date with the code.
2. Any API changes are explicitly visible in the PR as changes to the JSON spec.
3. The spec remains valid.

### Consuming the Spec (Frontend)

The frontend can consume the machine-readable spec at `openapi/openapi.json` (or via the `/openapi.json` endpoint) to generate TypeScript types using tools like `openapi-typescript`.

### With the frontend

Clone [interview-app-frontend](https://github.com/alexkochnev1987/interview-app-frontend), run `cp .env.example .env.local`, then `npm install && npm run dev` → http://localhost:3001

---

**Full documentation** (repos, Terraform, AWS, CI/CD): [DOCUMENTATION.md](DOCUMENTATION.md)
