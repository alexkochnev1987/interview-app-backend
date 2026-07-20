import './integration-env';
import { getIntegrationApp } from './helpers/integration-app';
import { authCookie, loginAsSuperAdmin } from './helpers/integration-auth';

async function main() {
  const { agent } = await getIntegrationApp();
  const session = await loginAsSuperAdmin(agent);
  const res = await agent
    .get('/interviews')
    .query({ page: 1, limit: 10 })
    .set(authCookie(session));
  console.log(res.status, JSON.stringify(res.body, null, 2));
  process.exit(res.status === 200 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
