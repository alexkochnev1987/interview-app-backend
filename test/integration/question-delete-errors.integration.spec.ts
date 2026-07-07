import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import {
  getIntegrationApp,
  type IntegrationAgent,
} from '../helpers/integration-app';
import { authCookie, loginAsStaffAdmin, loginAsSuperAdmin } from '../helpers/integration-auth';
import { buildCreateQuestionPayload } from '../helpers/create-question-payload';
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
    .send(buildCreateQuestionPayload(questionText))
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

describe('Question delete contracts (integration)', () => {
  useIntegrationHarness();

  it('schedules deletion when a question is used by an active interview', async () => {
    const { app, agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);

    const questionId = await createQuestion(
      agent,
      session,
      'Question blocked by active interview.',
    );
    const interviewId = await createInterviewWithQuestion(
      agent,
      session,
      questionId,
    );

    const response = await agent
      .delete(`/questions/${questionId}`)
      .set(authCookie(session))
      .expect(200);

    expect(response.body).toEqual({
      id: questionId,
      scheduled: true,
      blockingInterviews: [
        {
          id: interviewId,
          candidateName: 'Delete Contract Candidate',
          href: `/interviews/${interviewId}`,
        },
      ],
    });

    const databaseService = app.get(DatabaseService);
    const row = await databaseService.query<{ pending_deletion: boolean }>(
      'SELECT pending_deletion FROM questions WHERE id = $1',
      [questionId],
    );
    expect(row.rows[0]?.pending_deletion).toBe(true);
  });

  it('returns blocking interviews when getting a scheduled-deletion question', async () => {
    const { agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);

    const questionId = await createQuestion(
      agent,
      session,
      'Question with blocking interviews on GET.',
    );
    const interviewId = await createInterviewWithQuestion(
      agent,
      session,
      questionId,
    );

    await agent
      .delete(`/questions/${questionId}`)
      .set(authCookie(session))
      .expect(200);

    const response = await agent
      .get(`/questions/${questionId}`)
      .set(authCookie(session))
      .expect(200);

    expect(response.body.pendingDeletion).toBe(true);
    expect(response.body.blockingInterviews).toEqual([
      {
        id: interviewId,
        candidateName: 'Delete Contract Candidate',
        href: `/interviews/${interviewId}`,
      },
    ]);
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
    expect(response.body.scheduled).toEqual([]);

    const staffSession = await loginAsStaffAdmin(agent);
    await agent
      .get(`/questions/${questionId}`)
      .set(authCookie(staffSession))
      .expect(404);
  });

  it('bulk-deletes free questions and schedules questions in active interviews', async () => {
    const { agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);

    const scheduledQuestionId = await createQuestion(
      agent,
      session,
      'Question A in active interview.',
    );
    const freeQuestionId = await createQuestion(
      agent,
      session,
      'Question B not in any interview.',
    );
    const interviewId = await createInterviewWithQuestion(
      agent,
      session,
      scheduledQuestionId,
    );

    const response = await agent
      .post('/questions/bulk-delete')
      .set(authCookie(session))
      .send({ ids: [scheduledQuestionId, freeQuestionId] })
      .expect(201);

    expect(response.body.deleted).toEqual([freeQuestionId]);
    expect(response.body.scheduled).toHaveLength(1);
    expect(response.body.scheduled[0]).toMatchObject({
      id: scheduledQuestionId,
      questionText: 'Question A in active interview.',
      reason: `Question is scheduled for deletion when these active interviews finish: /interviews/${interviewId}`,
      blockingInterviews: [
        {
          id: interviewId,
          candidateName: 'Delete Contract Candidate',
          href: `/interviews/${interviewId}`,
        },
      ],
    });
  });

  it('returns all scheduled when every question is in an active interview', async () => {
    const { agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);

    const questionId = await createQuestion(
      agent,
      session,
      'Question only in active interview.',
    );
    const interviewId = await createInterviewWithQuestion(
      agent,
      session,
      questionId,
    );

    const response = await agent
      .post('/questions/bulk-delete')
      .set(authCookie(session))
      .send({ ids: [questionId] })
      .expect(201);

    expect(response.body.deleted).toEqual([]);
    expect(response.body.scheduled).toHaveLength(1);
    expect(response.body.scheduled[0]).toMatchObject({
      id: questionId,
      questionText: 'Question only in active interview.',
      blockingInterviews: [
        {
          id: interviewId,
          candidateName: 'Delete Contract Candidate',
          href: `/interviews/${interviewId}`,
        },
      ],
    });
    expect(response.body.scheduled[0].reason).toContain(
      `/interviews/${interviewId}`,
    );
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
    expect(response.body.scheduled).toEqual([]);
  });
});
