import { DatabaseService } from '../../src/database/database.service';
import { getIntegrationApp, type IntegrationAgent } from '../helpers/integration-app';
import { authCookie, loginAsSuperAdmin } from '../helpers/integration-auth';
import { updateInterviewStatus } from '../helpers/integration-db';
import { useIntegrationHarness } from '../helpers/integration-harness';
import {
  buildSubmitAnswerPayload,
  createTakeInterview,
  openCandidateTakeSession,
} from '../helpers/take-flow';

async function createQuestion(
  agent: IntegrationAgent,
  session: string,
  questionText: string,
): Promise<string> {
  const response = await agent
    .post('/questions')
    .set(authCookie(session))
    .send({
      questionText,
      difficulty: 'medium',
      weight: 1,
    })
    .expect(201);

  return response.body.id as string;
}

async function createPendingInterview(
  agent: IntegrationAgent,
  session: string,
  questionId: string,
): Promise<string> {
  const response = await agent
    .post('/interviews')
    .set(authCookie(session))
    .send({
      candidateName: 'Management Candidate',
      position: 'Engineer',
      questionIds: [questionId],
    })
    .expect(201);

  return response.body.id as string;
}

describe('Interview management (integration)', () => {
  useIntegrationHarness();

  it('cancels a pending interview', async () => {
    const { agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);
    const questionId = await createQuestion(
      agent,
      session,
      'Question for cancel wiring.',
    );
    const interviewId = await createPendingInterview(
      agent,
      session,
      questionId,
    );

    const response = await agent
      .patch(`/interviews/${interviewId}/cancel`)
      .set(authCookie(session))
      .expect(200);

    expect(response.body).toEqual({ id: interviewId, canceled: true });

    await agent
      .get(`/interviews/${interviewId}`)
      .set(authCookie(session))
      .expect(404);
  });

  it('rejects cancel when interview no longer exists', async () => {
    const { agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);
    const questionId = await createQuestion(
      agent,
      session,
      'Question for cancel conflict.',
    );
    const interviewId = await createPendingInterview(
      agent,
      session,
      questionId,
    );

    await agent
      .patch(`/interviews/${interviewId}/cancel`)
      .set(authCookie(session))
      .expect(200);

    await agent
      .patch(`/interviews/${interviewId}/cancel`)
      .set(authCookie(session))
      .expect(404);
  });

  it('updates a pending interview', async () => {
    const { agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);
    const questionA = await createQuestion(agent, session, 'Question A.');
    const questionB = await createQuestion(agent, session, 'Question B.');
    const interviewId = await createPendingInterview(
      agent,
      session,
      questionA,
    );

    const response = await agent
      .patch(`/interviews/${interviewId}`)
      .set(authCookie(session))
      .send({
        candidateName: 'Updated Candidate',
        position: 'Senior Engineer',
        questionIds: [questionB],
      })
      .expect(200);

    expect(response.body.candidateName).toBe('Updated Candidate');
    expect(response.body.position).toBe('Senior Engineer');
    expect(response.body.questions).toHaveLength(1);
    expect(response.body.questions[0].id).toBe(questionB);
  });

  it('rejects update when interview is not pending', async () => {
    const { app, agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);
    const questionId = await createQuestion(
      agent,
      session,
      'Question for update conflict.',
    );
    const interviewId = await createPendingInterview(
      agent,
      session,
      questionId,
    );

    const databaseService = app.get(DatabaseService);
    await updateInterviewStatus(databaseService, interviewId, 'in_progress');

    await agent
      .patch(`/interviews/${interviewId}`)
      .set(authCookie(session))
      .send({ candidateName: 'Too Late' })
      .expect(409);
  });

  it('flushes pending question deletions when a pending interview is canceled', async () => {
    const { app, agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);
    const questionId = await createQuestion(
      agent,
      session,
      'Question pending deletion on cancel.',
    );
    const interviewId = await createPendingInterview(
      agent,
      session,
      questionId,
    );

    await agent
      .delete(`/questions/${questionId}`)
      .set(authCookie(session))
      .expect(200);

    await agent
      .patch(`/interviews/${interviewId}/cancel`)
      .set(authCookie(session))
      .expect(200);

    const databaseService = app.get(DatabaseService);
    const row = await databaseService.query<{ deleted: boolean; pending_deletion: boolean }>(
      'SELECT deleted, pending_deletion FROM questions WHERE id = $1',
      [questionId],
    );

    expect(row.rows[0]?.deleted).toBe(true);
    expect(row.rows[0]?.pending_deletion).toBe(false);
  });

  it('blocks candidate take endpoints after interview is canceled', async () => {
    const { agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);
    const questionId = await createQuestion(
      agent,
      session,
      'Question for canceled take block.',
    );
    const { interviewId, token } = await createTakeInterview(
      agent,
      session,
      questionId,
    );

    await openCandidateTakeSession(agent, interviewId, token);

    await agent
      .patch(`/interviews/${interviewId}/cancel`)
      .set(authCookie(session))
      .expect(200);

    await agent
      .get(`/take/${interviewId}`)
      .query({ token })
      .expect(404);

    await agent
      .post(`/take/${interviewId}/answer`)
      .send(buildSubmitAnswerPayload(interviewId, 0, 1))
      .expect(404);
  });
});
