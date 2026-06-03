import {
  closeIntegrationApp,
  getIntegrationApp,
  resetIntegrationFixtures,
  type IntegrationFixtures,
} from './integration-app';

export function useIntegrationHarness(options?: {
  onFixtures?: (fixtures: IntegrationFixtures) => void;
}) {
  beforeAll(async () => {
    await getIntegrationApp();
  });

  beforeEach(async () => {
    const fixtures = await resetIntegrationFixtures();
    options?.onFixtures?.(fixtures);
  });

  afterAll(async () => {
    await closeIntegrationApp();
  });
}
