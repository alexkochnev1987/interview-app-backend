import {
  getIntegrationApp,
  type IntegrationAgent,
} from '../helpers/integration-app';
import {
  authCookie,
  loginAsHr,
  loginAsSuperAdmin,
  registerAsCandidate,
} from '../helpers/integration-auth';
import { useIntegrationHarness } from '../helpers/integration-harness';

describe('Candidate search API (integration)', () => {
  useIntegrationHarness();

  it('lets HR (not just admin) search candidates by name/email, scoped to the candidate role', async () => {
    const { agent } = await getIntegrationApp();
    const unique = Date.now();

    await registerAsCandidate(agent, {
      email: `alice-${unique}@test.local`,
      name: `Alice Search ${unique}`,
    });
    await registerAsCandidate(agent, {
      email: `bob-${unique}@test.local`,
      name: `Bob Search ${unique}`,
    });

    const hrSession = await loginAsHr(agent);

    const all = await agent
      .get('/users/candidates')
      .query({ q: `Search ${unique}` })
      .set(authCookie(hrSession))
      .expect(200);

    expect(all.body).toHaveLength(2);
    expect(all.body.map((c: { name: string }) => c.name).sort()).toEqual([
      `Alice Search ${unique}`,
      `Bob Search ${unique}`,
    ]);
    expect(all.body[0]).toEqual({
      id: expect.any(String),
      name: expect.any(String),
      email: expect.any(String),
    });

    const filtered = await agent
      .get('/users/candidates')
      .query({ q: `Alice Search ${unique}` })
      .set(authCookie(hrSession))
      .expect(200);

    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].name).toBe(`Alice Search ${unique}`);
  });

  it('excludes staff accounts from candidate search results even when their name matches', async () => {
    const { agent } = await getIntegrationApp();
    const session = await loginAsSuperAdmin(agent);

    // Fixture staff users are all named "Integration <Role>" (see
    // INTEGRATION_USERS in integration-app.ts) — a query matching that
    // pattern must not surface any of them, only role='candidate' rows.
    const response = await agent
      .get('/users/candidates')
      .query({ q: 'Integration' })
      .set(authCookie(session))
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('denies an unauthenticated caller', async () => {
    const { agent } = await getIntegrationApp();
    await (agent as IntegrationAgent).get('/users/candidates').expect(401);
  });
});
