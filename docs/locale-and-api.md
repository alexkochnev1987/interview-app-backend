# Locale & API integration

## OpenAPI

| What | Where |
|------|--------|
| Committed spec | [`openapi/openapi.json`](../openapi/openapi.json) |
| Live | `GET /openapi.json`, Swagger `GET /docs` |
| Regenerate | `npm run openapi:check` |
| Error codes | `src/common/errors/api-error.registry.ts` |

---

## `X-Locale`

- Header: `X-Locale: en | be | ru | pl`
- Default: `en` if omitted
- Invalid value: `400`, `code: "INVALID_LOCALE"` (except `/take/*` and `/health`: invalid header ignored; take uses `resolveTakeLocale` → `interviewLocale`)

Controls **which translation** is returned in question rubric fields on read/write responses. Send the locale the UI is showing.

`GET /questions?q=` searches denormalized `search_text` (all locale question titles), plus role/category/tags.

**Not the same as** `GET /questions?locale=pl` — that query only **filters** the list to questions with a Polish block; you still need `X-Locale` for resolved text in items.

---

## Resolved fields

**Localized** (from `translations` via `resolveQuestion`, one locale per response):

`questionText`, `followUpQuestions`, `expectedConcepts`, `redFlags`, `sampleGoodAnswer` — on question CRUD/list/similar, interview `questions[]`, take `currentQuestion`.

**Metadata:** `resolvedLocale`, `availableLocales`; on take, `fallbackFromLocale` when fallback was used.

**Non-localized:** `id`, `category`, `role`, `difficulty`, `tags`, `primaryLocale`, scores, media, workflow. Deprecated: `outputLanguage` (use `primaryLocale`).

**Fallback order** for requested locale `L`: `translations[L]` → `primaryLocale` → `en` → any available.

---

## `interviewLocale` vs `X-Locale`

| | `interviewLocale` | `X-Locale` |
|--|-------------------|------------|
| Set on | `POST /interviews` (default `en`) | Every request (default `en`) |
| Used for | Take default language, AI evaluation & summaries, feedback text | HR/candidate **display** of rubric from snapshots or question bank |
| Feedback API | Yes — `generalFeedback`, `improvements` | **No** (v1 single-locale) |

Interview responses include `questionsDisplayLocale` (from `X-Locale`) and `interviewLocale` (AI/feedback language). `result` summaries always use `interviewLocale`.

`GET /interviews` — by default a **JSON array** with full `questions[]` (legacy). With `?paginated=true`: `{ items, total, page, limit }` where each item has `questionCount` and `questionsPreview` only.

---

## Endpoints

| Endpoint | `X-Locale` |
|----------|------------|
| `GET/POST/PUT/PATCH` `/questions…`, `POST /questions/similar`, `POST /questions/bulk-delete` | yes |
| `GET /questions/facets` | yes (filters only; no rubric text) |
| `GET/POST/PATCH` `/interviews…` (incl. `questions[]` in body) | yes |
| `GET /take/:id` | optional (`X-Locale` or `interviewLocale`) |
| `POST /ai/question-draft` | `body.locale` → header → `en` |
| `GET /feedback/:id` | exempt — use `interviewLocale` in response |
| `POST /ai/chat`, `POST /ai/greet` | exempt |
| auth, upload, health | n/a |

---

## Examples

`SESSION` = cookie from `POST /auth/login`. Base: `http://localhost:3000`.

```bash
# List — resolved Polish text
curl -s "http://localhost:3000/questions?limit=5" \
  -H "Cookie: session=SESSION" -H "X-Locale: pl"

# Interview — HR preview locale (AI language is interviewLocale)
curl -s "http://localhost:3000/interviews/INTERVIEW_ID" \
  -H "Cookie: session=SESSION" -H "X-Locale: pl"

# Take — header overrides interview default
curl -s "http://localhost:3000/take/INTERVIEW_ID?token=TOKEN" -H "X-Locale: pl"

# Feedback — no X-Locale
curl -s "http://localhost:3000/feedback/INTERVIEW_ID?token=FEEDBACK_TOKEN"

# Question draft — body locale wins
curl -s -X POST "http://localhost:3000/ai/question-draft" \
  -H "Cookie: session=SESSION" -H "Content-Type: application/json" \
  -d '{"locale":"pl","question":{"questionText":"Wyjaśnij hooki w React."}}'
```

---

## Implementation (backend)

| Area | Module |
|------|--------|
| Header middleware | `src/locale/` |
| Resolve + fallback | `src/question/resolve-question.ts` |
| Interview snapshots | `src/interview/resolve-interview-question.ts`, `present-interview.ts` |
| Take | `src/take/take-locale.ts`, `take-question-view.ts` |
| UI strings / AI labels | `src/locale/locale-ui-text.ts` |
| Resolve input helper | `src/question/to-resolve-question-input.ts` |
| AI eval | `src/interview/prepare-evaluation-question.ts` |
| Feedback | `src/feedback/feedback-text.ts` |
