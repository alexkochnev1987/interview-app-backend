import { BadRequestException } from '@nestjs/common';
import { AppConfigController, PublicConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import { User } from '../user/interfaces/user.interface';

describe('AppConfigController & PublicConfigController', () => {
  const getPublicVariables = vi.fn();
  const getAllVariables = vi.fn();
  const getVariableRecord = vi.fn();
  const setVariable = vi.fn();
  const deleteVariable = vi.fn();

  const appConfigService = {
    getPublicVariables,
    getAllVariables,
    getVariableRecord,
    setVariable,
    deleteVariable,
  } as unknown as AppConfigService;

  let publicController: PublicConfigController;
  let adminController: AppConfigController;

  beforeEach(() => {
    vi.clearAllMocks();
    publicController = new PublicConfigController(appConfigService);
    adminController = new AppConfigController(appConfigService);
  });

  describe('GET /api/config/public', () => {
    it('should return public variables', async () => {
      getPublicVariables.mockResolvedValueOnce({
        APP_THEME: 'innowise',
        DEFAULT_THEME_MODE: 'system',
        MAX_ANSWER_DURATION_SECONDS: 240,
      });

      const res = await publicController.getPublicConfig();
      expect(res).toEqual({
        APP_THEME: 'innowise',
        DEFAULT_THEME_MODE: 'system',
        MAX_ANSWER_DURATION_SECONDS: 240,
      });
    });
  });

  describe('GET /api/config', () => {
    it('should return list of all variables with masked secrets', async () => {
      getAllVariables.mockResolvedValueOnce([
        {
          id: '1',
          key: 'SECRET_KEY',
          value: 'super-secret',
          valueType: 'secret',
          isPublic: false,
          isSecret: true,
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          updatedBy: null,
          isOverridden: true,
        },
      ]);

      const res = await adminController.listAll();
      expect(res[0].value).toBe('********');
    });
  });

  describe('PUT /api/config/:key', () => {
    it('should update configuration variable when allowed', async () => {
      getVariableRecord.mockResolvedValueOnce(null);
      setVariable.mockResolvedValueOnce({
        id: '1',
        key: 'APP_THEME',
        value: 'purple',
        valueType: 'enum',
        options: ['innowise', 'red', 'blue', 'purple'],
        isPublic: true,
        isSecret: false,
        description: 'Theme',
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy: 'admin@example.com',
        isOverridden: true,
      });

      const res = await adminController.upsert(
        'APP_THEME',
        { value: 'purple' },
        { email: 'admin@example.com' } as unknown as User,
      );

      expect(res.value).toBe('purple');
      expect(setVariable).toHaveBeenCalledWith(
        'APP_THEME',
        'purple',
        expect.objectContaining({ updatedBy: 'admin@example.com' }),
      );
    });

    it('should throw 400 INVALID_CONFIG_VALUE when value is not in allowed options', async () => {
      getVariableRecord.mockResolvedValueOnce({
        id: '1',
        key: 'APP_THEME',
        value: 'innowise',
        valueType: 'enum',
        options: ['innowise', 'red', 'blue', 'purple'],
        isPublic: true,
        isSecret: false,
        description: 'Theme',
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy: null,
        isOverridden: true,
      });

      try {
        await adminController.upsert(
          'APP_THEME',
          { value: 'yellow' },
          { email: 'admin@example.com' } as unknown as User,
        );
        expect.unreachable('Should have thrown BadRequestException');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(BadRequestException);
        const response = (err as BadRequestException).getResponse() as {
          code: string;
          message: string;
        };
        expect(response.code).toBe(ApiErrorCode.INVALID_CONFIG_VALUE);
        expect(response.message).toBe(
          'Value "yellow" is not allowed for key APP_THEME. Allowed values: innowise, red, blue, purple.',
        );
      }
    });
  });
});
