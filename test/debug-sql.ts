import { Pool } from 'pg';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://interview_app:localpass@localhost:5433/interview_app_test',
});

const sql = `
  SELECT
  i.id,
  i.candidate_name,
  i.candidate_email,
  i.position,
  i.status,
  i.created_at,
  i.updated_at,
  COALESCE(jsonb_array_length(i.questions_json), 0) AS question_count,
  (
    SELECT COUNT(*)::int
    FROM jsonb_array_elements(COALESCE(i.answers_json, '[]'::jsonb)) AS answer(value)
    WHERE answer.value->>'status' = 'submitted'
  ) AS submitted_answer_count,
  CASE
    WHEN i.result_json IS NULL THEN NULL
    ELSE COALESCE((i.result_json->>'overallScore')::double precision, 0)
  END AS overall_score,
  i.result_json->>'decision' AS decision,
  i.assigned_hr_id,
  ah.name AS assigned_hr_name,
  ah.email AS assigned_hr_email
  FROM interviews i
  LEFT JOIN users ah ON ah.id = i.assigned_hr_id
  WHERE i.demo = $1
  ORDER BY i.updated_at DESC, i.id ASC
  LIMIT $2 OFFSET $3
`;

pool
  .query(sql, [false, 10, 0])
  .then((r) => {
    console.log('ok', r.rowCount);
    pool.end();
  })
  .catch((e) => {
    console.error('ERROR:', e.message);
    pool.end();
    process.exit(1);
  });
