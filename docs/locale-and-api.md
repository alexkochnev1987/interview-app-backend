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
- Invalid value: `400`, `code: "INVALID_LOCALE"` (except `/take/*` and `/health`: invalid header ignored)

Controls locale resolution for question text on read/write responses. Rubric fields fall back to `primaryLocale` when they are missing in the resolved text locale.

`GET /questions?q=` searches denormalized `search_text` (all locale question titles), plus role/category/tags.

**Not the same as** `GET /questions?locale=pl` — that query **filters** to questions with Polish (`primaryLocale === pl` or non-empty `translations.pl.questionText`) and **resolves** each item's rubric for `pl`. Without `?locale=`, list items follow `X-Locale` only.

---

## Resolved fields

**Localized** (from `translations` via `resolveQuestion`):

`questionText`, `followUpQuestions`, `expectedConcepts`, `redFlags`, `sampleGoodAnswer` — on question CRUD/list/similar, interview `questions[]`, take `currentQuestion`.

**Metadata:** `resolvedLocale`, `availableLocales`; on take, `fallbackFromLocale` when fallback was used.

**Non-localized:** `id`, `category`, `role`, `difficulty`, `tags`, `primaryLocale`, scores, media, workflow. Deprecated: `outputLanguage` (use `primaryLocale`).

**questionText fallback** for requested locale `L`: `translations[L]` → `primaryLocale` → any available locale with non-empty `questionText`.
Rubric fields (`followUpQuestions`, `expectedConcepts`, `redFlags`, `sampleGoodAnswer`) use the resolved text locale first, then fallback to `primaryLocale` when missing there.

---

## `interviewLocale` vs `X-Locale`

| | `interviewLocale` | `X-Locale` |
|--|-------------------|------------|
| Set on | `POST /interviews` (default `en`) | Every request (default `en`) |
| Used for | Take default language, AI evaluation & summaries, feedback text | HR/candidate **display** of rubric from snapshots or question bank |
| Feedback API | Yes — `generalFeedback`, `improvements` | **No** (v1 single-locale) |

Interview responses include `questionsDisplayLocale` (always `interviewLocale`) and `interviewLocale` (AI/feedback language). `result` summaries always use `interviewLocale`.

`GET /interviews` — by default a **JSON array** with full `questions[]` (legacy). With `?paginated=true`: `{ items, total, page, limit }` where each item has `questionCount` and `questionsPreview` only.

---

## Endpoints

| Endpoint | `X-Locale` |
|----------|------------|
| `GET/POST/PUT/PATCH` `/questions…`, `POST /questions/similar`, `POST /questions/bulk-delete` | yes |
| `GET /questions/facets` | yes (filters only; no rubric text) |
| `GET/POST/PATCH` `/interviews…` (incl. `questions[]` in body) | no (resolved by `interviewLocale`) |
| `GET /take/:id` | optional `?contentLocale=` for `currentQuestion` (fallback: `interviewLocale` → `primaryLocale` → any); `X-Locale` ignored |
| `POST /questions/ai/draft` | `body.locale` → header → `en`; `mode=translate|generate`. **Translate** requires body `locale`, `question.primaryLocale`, and full primary rubric; returns target-locale content block with 1:1 concept/red-flag ids. **Generate** returns identity fields (`externalId`, `role`, `focus`, `category`, `subcategory`, `difficulty`, `weight`, `minimumPassScore`, `tags`) plus full rubric content; seed metadata is LLM context, not echoed. Auto: locale mismatch + full primary content → translate. |
| `POST /ai/question-draft` | same as above, **deprecated compatibility endpoint** |
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

# Interview — questions are always in interviewLocale
curl -s "http://localhost:3000/interviews/INTERVIEW_ID" \
  -H "Cookie: session=SESSION"

# Take — X-Locale is ignored; uses interviewLocale
curl -s "http://localhost:3000/take/INTERVIEW_ID?token=TOKEN"

# Take — UI language override (falls back to interviewLocale when translation missing)
curl -s "http://localhost:3000/take/INTERVIEW_ID?token=TOKEN&contentLocale=ru"

# Feedback — no X-Locale
curl -s "http://localhost:3000/feedback/INTERVIEW_ID?token=FEEDBACK_TOKEN"

# Question draft — canonical endpoint; body locale wins
curl -s -X POST "http://localhost:3000/questions/ai/draft" \
  -H "Cookie: session=SESSION" -H "Content-Type: application/json" \
  -d '{"locale":"pl","question":{"questionText":"Wyjaśnij hooki w React."}}'

# Translate only (ru -> pl): full primary block → Polish content with same ids
curl -s -X POST "http://localhost:3000/questions/ai/draft" \
  -H "Cookie: session=SESSION" -H "Content-Type: application/json" \
  -d '{"mode":"translate","locale":"pl","question":{"primaryLocale":"ru","questionText":"Объясните замыкания в JavaScript.","followUpQuestions":["Можете привести пример?","Какую ошибку избегаете?"],"expectedConcepts":[{"id":"scope_chain","label":"цепочка областей видимости","weight":0.34,"description":"явно раскрыта"},{"id":"lexical_env","label":"лексическое окружение","weight":0.33,"description":"привязка переменных"},{"id":"practical_use","label":"практика","weight":0.33,"description":"реальный пример"}],"redFlags":[{"id":"confuses_scope","label":"Путает scope","severity":"medium"},{"id":"no_example","label":"Нет примера","severity":"high"}],"sampleGoodAnswer":"Замыкание — функция с доступом к внешним переменным."}}'

# Translate only (be -> en): full primary block required
curl -s -X POST "http://localhost:3000/questions/ai/draft" \
  -H "Cookie: session=SESSION" -H "Content-Type: application/json" \
  -d '{"mode":"translate","locale":"en","question":{"primaryLocale":"be","questionText":"Растлумачце, як працуе віртуальны DOM у React.","followUpQuestions":["Можа прыклад?","Якую памылку збягаеце?"],"expectedConcepts":[{"id":"virtual_dom","label":"віртуальны DOM","weight":0.34,"description":"мадэль"},{"id":"reconciliation","label":"рэкансіліяцыя","weight":0.33,"description":"diff"},{"id":"practical_use","label":"практыка","weight":0.33,"description":"прыклад"}],"redFlags":[{"id":"confuses_dom","label":"Путае DOM","severity":"medium"},{"id":"no_example","label":"Без прыкладу","severity":"high"}],"sampleGoodAnswer":"Канкрэтны прыклад з React."}}'
```

---

## Implementation (backend)

| Area | Module |
|------|--------|
| Header middleware | `src/locale/` |
| Resolve + fallback | `src/question/resolve-question.ts` |
| Interview snapshots | `src/interview/resolve-interview-question.ts`, `present-interview.ts` |
| Take | `src/take/take.controller.ts`, `take-question-view.ts` |
| UI strings / AI labels | `src/locale/locale-ui-text.ts` |
| Resolve input helper | `src/question/to-resolve-question-input.ts` |
| AI eval | `src/interview/prepare-evaluation-question.ts` |
| Feedback | `src/feedback/feedback-text.ts` |
