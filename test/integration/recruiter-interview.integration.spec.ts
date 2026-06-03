import { getIntegrationApp } from '../helpers/integration-app';
import { loginAsSuperAdmin, authCookie } from '../helpers/integration-auth';
import { useIntegrationHarness } from '../helpers/integration-harness';
import {
  createTakeInterview,
  submitCandidateAnswer,
} from '../helpers/take-flow';

describe('Recruiter interview APIs (integration)', () => {
  let seedQuestionId = '';

  useIntegrationHarness({
    onFixtures: (fixtures) => {
      seedQuestionId = fixtures.seedQuestionId;
    },
  });

  it('lists interviews and covers complete, validate, and results endpoints', async () => {
    const { agent } = await getIntegrationApp();
    const staffSession = await loginAsSuperAdmin(agent);
    const { interviewId, token } = await createTakeInterview(
      agent,
      staffSession,
      seedQuestionId,
    );

    const list = await agent
      .get('/interviews')
      .set(authCookie(staffSession))
      .expect(200);

    expect(
      list.body.some(
        (interview: { id: string }) => interview.id === interviewId,
      ),
    ).toBe(true);

    await agent
      .patch(`/interviews/${interviewId}/complete`)
      .set(authCookie(staffSession))
      .expect(400);

    await agent
      .get(`/interviews/${interviewId}/results`)
      .set(authCookie(staffSession))
      .expect(404);

    await agent
      .post(`/interviews/${interviewId}/validate`)
      .set(authCookie(staffSession))
      .expect(503);

    await agent
      .post(`/interviews/${interviewId}/questions/0/validate`)
      .set(authCookie(staffSession))
      .expect(503);

    await submitCandidateAnswer(agent, interviewId, token);

    const completed = await agent
      .patch(`/interviews/${interviewId}/complete`)
      .set(authCookie(staffSession))
      .expect(200);

    expect(completed.body.id).toBe(interviewId);
    expect(completed.body.answers).toHaveLength(1);
    expect(completed.body.answers[0]?.status).toBe('submitted');

    await agent
      .post(`/interviews/${interviewId}/validate`)
      .set(authCookie(staffSession))
      .expect(503);

    await agent
      .get(`/interviews/${interviewId}/results`)
      .set(authCookie(staffSession))
      .expect(404);
  });
});
