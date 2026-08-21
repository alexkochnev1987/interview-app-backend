import type { DatabaseService } from '../database/database.service';
import { UserService } from './user.service';

function makeService() {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  const databaseService = { query } as unknown as DatabaseService;
  return { service: new UserService(databaseService), query };
}

describe('UserService.searchCandidates', () => {
  it('scopes to the candidate role and the actor demo flag, with no search text by default', async () => {
    const { service, query } = makeService();

    await service.searchCandidates({ demo: false });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("role = 'candidate'");
    expect(sql).toContain('demo = $1');
    expect(sql).toContain('ORDER BY name ASC');
    expect(params[0]).toBe(false);
    expect(params[1]).toBeNull();
    expect(params[2]).toBe(20);
  });

  it('wraps trimmed search text in a LIKE pattern and escapes wildcards', async () => {
    const { service, query } = makeService();

    await service.searchCandidates({ demo: true }, '  ja%ne_doe  ');

    const [, params] = query.mock.calls[0];
    expect(params[0]).toBe(true);
    expect(params[1]).toBe('%ja\\%ne\\_doe%');
  });

  it('clamps limit to the [1, 50] range', async () => {
    const { service, query } = makeService();

    await service.searchCandidates({ demo: false }, undefined, 500);
    expect(query.mock.calls[0][1][2]).toBe(50);

    await service.searchCandidates({ demo: false }, undefined, 0);
    expect(query.mock.calls[1][1][2]).toBe(1);
  });

  it('returns the rows as-is (id/name/email only)', async () => {
    const { service, query } = makeService();
    query.mockResolvedValue({
      rows: [{ id: 'c1', name: 'Alice', email: 'alice@test.local' }],
    });

    const result = await service.searchCandidates({ demo: false }, 'alice');

    expect(result).toEqual([
      { id: 'c1', name: 'Alice', email: 'alice@test.local' },
    ]);
  });
});
