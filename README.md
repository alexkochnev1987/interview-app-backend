# Interview App — Backend

NestJS API. **Docker Compose** in this repo runs PostgreSQL and MinIO for local development.

## Deployments

| Environment | Branch | Frontend | Backend API |
|-------------|--------|----------|-------------|
| Dev | `develop` | https://develop.d1z0clbcev0y8a.amplifyapp.com | https://pjz9l12wad.execute-api.us-east-1.amazonaws.com |
| Prod | `main` | https://main.d2k50usvcss92k.amplifyapp.com | Not public until prod backend is started |

Only public application URLs are documented here. Keep secrets, raw infrastructure IPs, private hostnames, tokens, and environment values out of README files.

## Branch and merge workflow

- Create feature branches from `main`.
- Open a PR into `develop` to deploy and test in dev. Merge requires 1 approving review and passing required checks.
- After dev testing, open a PR from `develop` into `main`. Merge requires 2 approving reviews and passing required checks.
- The repository owner/code-owner approval is not required specifically; any eligible reviewer approvals can satisfy the rule.
- Do not push directly to `develop` or `main`.

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

Backend tests follow a **pyramid**: many fast unit tests at the base, a thin integration layer on top. CI enforces **≥75% unit / ≤25% integration** by test-case count (`test/assert-test-pyramid.js`).

```bash
npm run test                 # unit (default) — rules, guards, DTOs, env, …
docker compose up -d
npm run test:integration     # Nest + Postgres wiring and candidate-feedback happy path
npm run test:pyramid         # unit + integration + budget check
npm run test:pyramid:check   # budget only (after both suites ran)
```

| Layer | Location | Purpose |
|-------|----------|---------|
| **Unit (~80%)** | `src/**/*.spec.ts` | Pure rules: permissions, roles, cookies, JWT, DTOs, interview access/completion, answer validation, guards, AI env, behavior risk |
| **Integration (~20%)** | `test/integration/*.integration.spec.ts` | Wiring: staff auth + guards, recruiter CRUD, HR IDOR, candidate take; candidate-feedback happy path |

### Candidate feedback API contract (HR)

Frontend maps from these shapes (do not change DTOs for UI). Types: `openapi/generated/api.d.ts` (`npm run openapi:types`).

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/interviews/{id}/candidate-feedback` | `CandidateFeedbackResponseDto` (`interviewId`, `overall`, `questions[]`, `updatedAt`) |
| `PATCH` | `/interviews/{id}/candidate-feedback` | `CandidateFeedbackResponseDto` |
| `POST` | `/interviews/{id}/candidate-feedback/generate?scope=all` | `{ feedback, questions, overall }` |
| `POST` | `/interviews/{id}/candidate-feedback/questions/{questionIndex}/generate` | `CandidateFeedbackQuestionBlockDto` |

Block `state`: `not_generated | generating | generated | accepted | edited | failed`. HR PATCH may set `accepted` or `edited` only; regeneration skips locked blocks. Details: [docs/locale-and-api.md](docs/locale-and-api.md).

Specs share one Nest app per integration run (`test/helpers/integration-app.ts`) and `useIntegrationHarness()` to reseed the DB between tests.

**E2E** (browser flows) lives in [interview-app-frontend](https://github.com/alexkochnev1987/interview-app-frontend) (`e2e/*.spec.ts`), not in this repo.

Uses seed users (created on first run):

| Role | Email | Password |
|------|-------|----------|
| super_admin | `admin@test.local` | `TestPass123!` |
| admin | `staff-admin@test.local` | `TestPass123!` |
| hr | `hr@test.local` | `TestPass123!` |

S3/MinIO defaults in `test/integration-env.ts` are for local Docker — CI omits them until upload/presign integration tests add a MinIO service.

PostgreSQL on host **5433**, MinIO S3 API **9002**, MinIO web console **9003** (`minioadmin` / `minioadmin`).

**API:** [Swagger](http://localhost:3000/docs) · [`openapi/openapi.json`](openapi/openapi.json) · [`openapi/generated/api.d.ts`](openapi/generated/api.d.ts) (`npm run openapi:check`) · **Locales:** [docs/locale-and-api.md](docs/locale-and-api.md).

### With the frontend

Clone [interview-app-frontend](https://github.com/alexkochnev1987/interview-app-frontend), run `cp .env.example .env.local`, then `npm install && npm run dev` → http://localhost:3001

---

**Infra / deploy:** [DOCUMENTATION.md](DOCUMENTATION.md).
