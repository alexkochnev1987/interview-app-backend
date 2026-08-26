import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';

import { DatabaseService } from '../../src/database/database.service';
import {
  getIntegrationApp,
  type IntegrationAgent,
} from '../helpers/integration-app';
import {
  authCookie,
  loginAsSuperAdmin,
  registerAsCandidate,
} from '../helpers/integration-auth';
import { updateInterviewStatus } from '../helpers/integration-db';
import { useIntegrationHarness } from '../helpers/integration-harness';

async function createInterviewForCandidate(
  agent: IntegrationAgent,
  staffSession: string,
  questionId: string,
  overrides: { candidateEmail: string; position: string },
): Promise<string> {
  const response = await agent
    .post('/interviews')
    .set(authCookie(staffSession))
    .send({
      candidateName: 'Assistant Candidate',
      candidateEmail: overrides.candidateEmail,
      position: overrides.position,
      questionIds: [questionId],
    })
    .expect(201);

  return response.body.id as string;
}

async function candidateChat(
  agent: IntegrationAgent,
  session: string,
  message: string,
) {
  return agent
    .post('/ai/chat')
    .set(authCookie(session))
    .send({ message })
    .expect(201);
}

describe('Candidate assistant chat API (integration)', () => {
  let seedQuestionId = '';

  useIntegrationHarness({
    onFixtures: (fixtures) => {
      seedQuestionId = fixtures.seedQuestionId;
    },
  });

  it('answers latest status, position status, active list, and review queries for a candidate', async () => {
    const { app, agent } = await getIntegrationApp();
    const staffSession = await loginAsSuperAdmin(agent);
    const databaseService = app.get(DatabaseService);
    const candidateEmail = `assistant-chat-${Date.now()}@test.local`;

    const completedBackendId = await createInterviewForCandidate(
      agent,
      staffSession,
      seedQuestionId,
      { candidateEmail, position: 'Backend Developer' },
    );
    await updateInterviewStatus(
      databaseService,
      completedBackendId,
      'completed',
    );

    const pendingReactId = await createInterviewForCandidate(
      agent,
      staffSession,
      seedQuestionId,
      { candidateEmail, position: 'React Developer' },
    );

    const candidateAgent = supertest.agent(app.getHttpServer());
    const candidateSession = await registerAsCandidate(candidateAgent, {
      email: candidateEmail,
    });

    const latestStatus = await candidateChat(
      candidateAgent,
      candidateSession,
      'what is the status of my latest interview',
    );
    expect(latestStatus.body).toMatchObject({
      status: 'answered',
      response: expect.stringContaining('React Developer'),
      interview: {
        id: pendingReactId,
        position: 'React Developer',
        status: 'pending',
      },
      redirect: { path: `/portal/interviews/${pendingReactId}` },
    });
    expect(latestStatus.body.interview.candidateLink).toMatch(
      new RegExp(`^/take/${pendingReactId}\\?token=`),
    );

    const positionStatus = await candidateChat(
      candidateAgent,
      candidateSession,
      'what is the status of my Backend Developer interview',
    );
    expect(positionStatus.body).toMatchObject({
      status: 'answered',
      response: expect.stringContaining('Backend Developer'),
      interview: {
        id: completedBackendId,
        position: 'Backend Developer',
        status: 'completed',
      },
    });
    expect(positionStatus.body.response).toContain(
      'submitted, waiting for feedback',
    );

    const activeList = await candidateChat(
      candidateAgent,
      candidateSession,
      'do I have any new interviews',
    );
    expect(activeList.body).toMatchObject({
      status: 'answered',
      response: expect.stringContaining('React Developer'),
      redirect: { path: '/portal' },
    });
    expect(activeList.body.interviews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: pendingReactId,
          position: 'React Developer',
          status: 'pending',
        }),
      ]),
    );
    expect(activeList.body.interviews).toHaveLength(1);

    const reviewStatus = await candidateChat(
      candidateAgent,
      candidateSession,
      'did my Backend Developer interview get reviewed',
    );
    expect(reviewStatus.body).toMatchObject({
      status: 'answered',
      response: expect.stringContaining('Backend Developer'),
      interview: {
        id: completedBackendId,
        reviewState: {
          reviewed: false,
          resultsReady: false,
        },
      },
    });
    expect(reviewStatus.body.response).toContain('not been reviewed');
  });
});
