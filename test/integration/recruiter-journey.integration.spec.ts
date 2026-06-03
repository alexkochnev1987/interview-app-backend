import {
  getIntegrationApp,
  parseCandidateToken,
  unauthenticatedRequest,
} from '../helpers/integration-app';
import { authCookie, loginAsSuperAdmin } from '../helpers/integration-auth';
import { useIntegrationHarness } from '../helpers/integration-harness';

describe('Recruiter journey (integration)', () => {
  useIntegrationHarness();

  it('login → question CRUD → interview with questions → candidate take link', async () => {
    const { app, agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);

    const created = await agent
      .post('/questions')
      .set(authCookie(session))
      .send({
        questionText: 'Explain idempotency in REST APIs.',
        difficulty: 'medium',
        weight: 1,
        tags: ['integration-journey'],
      })
      .expect(201);

    const questionId = created.body.id as string;
    expect(created.body.questionText).toContain('idempotency');

    await agent
      .patch(`/questions/${questionId}`)
      .set(authCookie(session))
      .send({
        questionText: 'Explain idempotency and safe retries in REST APIs.',
        tags: ['integration-journey', 'updated'],
      })
      .expect(200);

    const fetchedQuestion = await agent
      .get(`/questions/${questionId}`)
      .set(authCookie(session))
      .expect(200);

    expect(fetchedQuestion.body.questionText).toContain('safe retries');
    expect(fetchedQuestion.body.tags).toContain('updated');

    const list = await agent
      .get('/questions')
      .set(authCookie(session))
      .query({ page: 1, limit: 20, status: 'active', q: 'idempotency' })
      .expect(200);

    expect(list.body.total).toBeGreaterThanOrEqual(1);
    expect(list.body.items.some((q: { id: string }) => q.id === questionId)).toBe(
      true,
    );

    const facets = await agent
      .get('/questions/facets')
      .set(authCookie(session))
      .query({ status: 'active' })
      .expect(200);

    expect(facets.body.tags).toEqual(expect.any(Array));

    const interview = await agent
      .post('/interviews')
      .set(authCookie(session))
      .send({
        candidateName: 'Journey Candidate',
        candidateEmail: 'journey-candidate@test.local',
        position: 'Platform Engineer',
        questionIds: [questionId],
      })
      .expect(201);

    const interviewId = interview.body.id as string;
    expect(interview.body.candidateLink).toContain('/take/');
    expect(interview.body.questions).toHaveLength(1);

    const interviewDetail = await agent
      .get(`/interviews/${interviewId}`)
      .set(authCookie(session))
      .expect(200);

    expect(interviewDetail.body.candidateName).toBe('Journey Candidate');
    expect(interviewDetail.body.questions[0]?.id).toBe(questionId);

    const linkResponse = await agent
      .post(`/interviews/${interviewId}/candidate-link`)
      .set(authCookie(session))
      .expect(201);

    expect(linkResponse.body.candidateLink).toContain(`/take/${interviewId}`);

    const token = parseCandidateToken(linkResponse.body.candidateLink);

    const take = await agent
      .get(`/take/${interviewId}`)
      .query({ token })
      .expect(200);

    expect(take.body.position).toBe('Platform Engineer');
    expect(take.body.totalQuestions).toBe(1);
    expect(take.body.completed).toBe(false);

    const disposable = await agent
      .post('/questions')
      .set(authCookie(session))
      .send({
        questionText: 'Temporary question for delete flow.',
        difficulty: 'easy',
        weight: 1,
      })
      .expect(201);

    await agent
      .delete(`/questions/${disposable.body.id}`)
      .set(authCookie(session))
      .expect(200);

    const deletedQuestion = await agent
      .get(`/questions/${disposable.body.id}`)
      .set(authCookie(session))
      .expect(200);

    expect(deletedQuestion.body.deleted).toBe(true);

    await unauthenticatedRequest(app).get('/auth/me').expect(401);
  });
});
