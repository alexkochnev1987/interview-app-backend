import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import {
  getIntegrationApp,
  type IntegrationAgent,
} from '../helpers/integration-app';
import { authCookie, loginAsStaffAdmin, loginAsSuperAdmin } from '../helpers/integration-auth';
import { updateInterviewStatus } from '../helpers/integration-db';
import { useIntegrationHarness } from '../helpers/integration-harness';

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

async function createInterviewWithQuestion(
  agent: IntegrationAgent,
  session: string,
  questionId: string,
): Promise<string> {
  const response = await agent
    .post('/interviews')
    .set(authCookie(session))
    .send({
      candidateName: 'Delete Contract Candidate',
      position: 'Engineer',
      questionIds: [questionId],
    })
    .expect(201);

  return response.body.id as string;
}

async function completeInterviewWithQuestion(
  agent: IntegrationAgent,
  session: string,
  questionId: string,
  app: INestApplication,
): Promise<string> {
  const interviewId = await createInterviewWithQuestion(
    agent,
    session,
    questionId,
  );

  const databaseService = app.get(DatabaseService);
  await updateInterviewStatus(databaseService, interviewId, 'completed');

  const interview = await agent
    .get(`/interviews/${interviewId}`)
    .set(authCookie(session))
    .expect(200);

  expect(interview.body.status).toBe('completed');

  return interviewId;
}

describe('Question delete error contracts (integration)', () => {
  useIntegrationHarness();

  it('returns 409 when deleting a question used by an active interview', async () => {
    const { agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);

    const questionId = await createQuestion(
      agent,
      session,
      'Question blocked by active interview.',
    );
    await createInterviewWithQuestion(agent, session, questionId);

    const response = await agent
      .delete(`/questions/${questionId}`)
      .set(authCookie(session))
      .expect(409);

    expect(response.body.statusCode).toBe(409);
    expect(response.body.message).toMatch(/active interview/i);
    expect(response.body.message).toMatch(/Wait for it to finish/i);
  });

  it('deletes a question used only in a completed interview', async () => {
    const { app, agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);

    const questionId = await createQuestion(
      agent,
      session,
      'Question in completed interview.',
    );
    await completeInterviewWithQuestion(agent, session, questionId, app);

    const deleteResponse = await agent
      .delete(`/questions/${questionId}`)
      .set(authCookie(session))
      .expect(200);

    expect(deleteResponse.body).toEqual({ id: questionId, deleted: true });

    const staffSession = await loginAsStaffAdmin(agent);
    await agent
      .get(`/questions/${questionId}`)
      .set(authCookie(staffSession))
      .expect(404);
  });

  it('bulk-deletes a question used only in a completed interview', async () => {
    const { app, agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);

    const questionId = await createQuestion(
      agent,
      session,
      'Question in completed interview for bulk delete.',
    );
    await completeInterviewWithQuestion(agent, session, questionId, app);

    const response = await agent
      .post('/questions/bulk-delete')
      .set(authCookie(session))
      .send({ ids: [questionId] })
      .expect(201);

    expect(response.body.deleted).toEqual([questionId]);
    expect(response.body.blocked).toEqual([]);

    const staffSession = await loginAsStaffAdmin(agent);
    await agent
      .get(`/questions/${questionId}`)
      .set(authCookie(staffSession))
      .expect(404);
  });

  it('bulk-deletes free questions and blocks questions in active interviews', async () => {
    const { agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);

    const blockedQuestionId = await createQuestion(
      agent,
      session,
      'Question A in active interview.',
    );
    const freeQuestionId = await createQuestion(
      agent,
      session,
      'Question B not in any interview.',
    );
    await createInterviewWithQuestion(agent, session, blockedQuestionId);

    const response = await agent
      .post('/questions/bulk-delete')
      .set(authCookie(session))
      .send({ ids: [blockedQuestionId, freeQuestionId] })
      .expect(201);

    expect(response.body.deleted).toEqual([freeQuestionId]);
    expect(response.body.blocked).toHaveLength(1);
    expect(response.body.blocked[0]).toMatchObject({
      id: blockedQuestionId,
      questionText: 'Question A in active interview.',
    });
    expect(response.body.blocked[0].reason).toMatch(/active interview/i);
  });

  it('returns all blocked when every question is in an active interview', async () => {
    const { agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);

    const questionId = await createQuestion(
      agent,
      session,
      'Question only in active interview.',
    );
    await createInterviewWithQuestion(agent, session, questionId);

    const response = await agent
      .post('/questions/bulk-delete')
      .set(authCookie(session))
      .send({ ids: [questionId] })
      .expect(201);

    expect(response.body.deleted).toEqual([]);
    expect(response.body.blocked).toHaveLength(1);
    expect(response.body.blocked[0].id).toBe(questionId);
    expect(response.body.blocked[0].questionText).toBe(
      'Question only in active interview.',
    );
    expect(response.body.blocked[0].reason).toMatch(/active interview/i);
  });

  it('bulk-deletes questions that are not in any active interview', async () => {
    const { agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);

    const questionId = await createQuestion(
      agent,
      session,
      'Question free to delete.',
    );

    const response = await agent
      .post('/questions/bulk-delete')
      .set(authCookie(session))
      .send({ ids: [questionId] })
      .expect(201);

    expect(response.body.deleted).toEqual([questionId]);
    expect(response.body.blocked).toEqual([]);
  });
});
