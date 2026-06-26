import { isDemoSeedAllowed } from './demo-seed-core';

describe('isDemoSeedAllowed (production safety boundary)', () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    ALLOW_DEMO_SEED: process.env.ALLOW_DEMO_SEED,
  };

  afterEach(() => {
    process.env.NODE_ENV = original.NODE_ENV;
    process.env.ALLOW_DEMO_SEED = original.ALLOW_DEMO_SEED;
  });

  it('allows seeding outside production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOW_DEMO_SEED;
    expect(isDemoSeedAllowed()).toBe(true);
  });

  it('REFUSES on production by default (protects prod from demo data)', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEMO_SEED;
    expect(isDemoSeedAllowed()).toBe(false);
  });

  it('allows on production only with explicit ALLOW_DEMO_SEED opt-in', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_DEMO_SEED = 'true';
    expect(isDemoSeedAllowed()).toBe(true);
    process.env.ALLOW_DEMO_SEED = 'yes';
    expect(isDemoSeedAllowed()).toBe(true);
  });

  it('stays refused on production for any non-opt-in value', () => {
    process.env.NODE_ENV = 'production';
    for (const value of ['', 'false', 'no', '1', 'TRUE_ISH']) {
      process.env.ALLOW_DEMO_SEED = value;
      expect(isDemoSeedAllowed()).toBe(false);
    }
  });
});
