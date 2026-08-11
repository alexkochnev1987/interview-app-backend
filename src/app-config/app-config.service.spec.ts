import { AppConfigService } from './app-config.service';
import { DatabaseService } from '../database/database.service';

describe('AppConfigService', () => {
  let service: AppConfigService;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      onModuleDestroy: jest.fn(),
    } as unknown as jest.Mocked<DatabaseService>;

    service = new AppConfigService(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.TEST_CONFIG_KEY;
  });

  describe('Cascade Resolution (getString / getNumber / getBoolean)', () => {
    it('should return value from DB when present in database', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            key: 'TEST_CONFIG_KEY',
            value: 'db_override_value',
            value_type: 'string',
            is_public: false,
            is_secret: false,
            description: 'Test var',
            created_at: new Date(),
            updated_at: new Date(),
            updated_by: 'admin@example.com',
          },
        ],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      process.env.TEST_CONFIG_KEY = 'env_value';

      const result = await service.getString('TEST_CONFIG_KEY', 'default');
      expect(result).toBe('db_override_value');
    });

    it('should fallback to process.env when key is not in DB', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      process.env.TEST_CONFIG_KEY = 'env_value';

      const result = await service.getString('TEST_CONFIG_KEY', 'default');
      expect(result).toBe('env_value');
    });

    it('should fallback to code default when key is neither in DB nor process.env', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await service.getString('TEST_CONFIG_KEY', 'code_default');
      expect(result).toBe('code_default');
    });

    it('should parse getNumber correctly from DB text value', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            key: 'MAX_ANSWER_DURATION_SECONDS',
            value: '600',
            value_type: 'number',
            is_public: true,
            is_secret: false,
            description: null,
            created_at: new Date(),
            updated_at: new Date(),
            updated_by: null,
          },
        ],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const num = await service.getNumber('MAX_ANSWER_DURATION_SECONDS', 240);
      expect(num).toBe(600);
    });

    it('should parse getBoolean correctly for "true", "1", "yes"', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: '123',
            key: 'ENABLE_FEATURE',
            value: 'true',
            value_type: 'boolean',
            is_public: true,
            is_secret: false,
            description: null,
            created_at: new Date(),
            updated_at: new Date(),
            updated_by: null,
          },
        ],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const boolVal = await service.getBoolean('ENABLE_FEATURE', false);
      expect(boolVal).toBe(true);
    });
  });

  describe('Public & Secret Filter (getPublicVariables)', () => {
    it('should return only public, non-secret variables formatted by valueType', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            key: 'PUBLIC_LIMIT',
            value: '50',
            value_type: 'number',
            is_public: true,
            is_secret: false,
            description: null,
            created_at: new Date(),
            updated_at: new Date(),
            updated_by: null,
          },
          {
            id: '2',
            key: 'PRIVATE_SETTING',
            value: 'secret_internal',
            value_type: 'string',
            is_public: false,
            is_secret: false,
            description: null,
            created_at: new Date(),
            updated_at: new Date(),
            updated_by: null,
          },
          {
            id: '3',
            key: 'PUBLIC_SECRET_KEY',
            value: 'my-api-key',
            value_type: 'secret',
            is_public: true,
            is_secret: true,
            description: null,
            created_at: new Date(),
            updated_at: new Date(),
            updated_by: null,
          },
        ],
        rowCount: 3,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const publicVars = await service.getPublicVariables();

      expect(publicVars).toEqual({
        PUBLIC_LIMIT: 50,
        MAX_ANSWER_DURATION_SECONDS: 240,
        MAX_ANSWER_ATTEMPTS_PER_QUESTION: 3,
        ENABLE_GOOGLE_OAUTH: true,
        ENABLE_FEEDBACK_SHARE_LINKS: true,
        APP_THEME: 'innowise',
        DEFAULT_THEME_MODE: 'system',
        ENABLE_AI_ASSISTANT: true,
      });
      expect(publicVars.PRIVATE_SETTING).toBeUndefined();
      expect(publicVars.PUBLIC_SECRET_KEY).toBeUndefined();
    });
  });

  describe('getAllVariables & System Defaults', () => {
    it('should return system defaults with isOverridden=false when no DB overrides exist', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const all = await service.getAllVariables();
      const themeEntry = all.find((e) => e.key === 'APP_THEME');
      expect(themeEntry).toBeDefined();
      expect(themeEntry?.value).toBe('innowise');
      expect(themeEntry?.isOverridden).toBe(false);
    });

    it('should mark DB overrides with isOverridden=true', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'override-1',
            key: 'APP_THEME',
            value: 'purple',
            value_type: 'enum',
            options: ['innowise', 'red', 'blue', 'purple'],
            is_public: true,
            is_secret: false,
            description: null,
            created_at: new Date(),
            updated_at: new Date(),
            updated_by: 'admin@example.com',
          },
        ],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const all = await service.getAllVariables();
      const themeEntry = all.find((e) => e.key === 'APP_THEME');
      expect(themeEntry?.value).toBe('purple');
      expect(themeEntry?.isOverridden).toBe(true);
    });
  });

  describe('Cache Invalidation (setVariable / deleteVariable)', () => {
    it('should immediately update cache on setVariable', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'uuid-1',
            key: 'NEW_KEY',
            value: 'updated_val',
            value_type: 'string',
            is_public: false,
            is_secret: false,
            description: 'desc',
            created_at: new Date(),
            updated_at: new Date(),
            updated_by: 'super@admin.com',
          },
        ],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      await service.setVariable('NEW_KEY', 'updated_val', {
        valueType: 'string',
        description: 'desc',
        updatedBy: 'super@admin.com',
      });

      // Subsequent read should hit local cache without querying DB
      const result = await service.getString('NEW_KEY');
      expect(result).toBe('updated_val');
      // mockDb.query was called only once for INSERT
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should clear local cache on deleteVariable', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: 'DELETE',
        oid: 0,
        fields: [],
      });

      const deleted = await service.deleteVariable('NEW_KEY');
      expect(deleted).toBe(true);
    });

    it('should return false when deleting a default key if no DB row was deleted', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'DELETE',
        oid: 0,
        fields: [],
      });

      const deleted = await service.deleteVariable('MAX_ANSWER_DURATION_SECONDS');
      expect(deleted).toBe(false);
    });
  });
});
