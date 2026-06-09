import {
  extractSessionCookie,
  INTEGRATION_USERS,
  type IntegrationAgent,
} from './integration-app';

type StaffUser = (typeof INTEGRATION_USERS)[keyof typeof INTEGRATION_USERS];

async function loginAs(
  agent: IntegrationAgent,
  user: StaffUser,
): Promise<string> {
  const response = await agent
    .post('/auth/login')
    .send({ email: user.email, password: user.password })
    .expect(200);

  return extractSessionCookie(response.headers['set-cookie']);
}

export async function loginAsSuperAdmin(agent: IntegrationAgent): Promise<string> {
  return loginAs(agent, INTEGRATION_USERS.superAdmin);
}

/** @deprecated use loginAsSuperAdmin */
export async function loginAsIntegrationAdmin(
  agent: IntegrationAgent,
): Promise<string> {
  return loginAsSuperAdmin(agent);
}

export async function loginAsStaffAdmin(agent: IntegrationAgent): Promise<string> {
  return loginAs(agent, INTEGRATION_USERS.admin);
}

export async function loginAsHr(agent: IntegrationAgent): Promise<string> {
  return loginAs(agent, INTEGRATION_USERS.hr);
}

export function authCookie(sessionCookie: string) {
  return { Cookie: sessionCookie };
}
