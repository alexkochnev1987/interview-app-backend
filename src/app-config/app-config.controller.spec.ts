import { BadRequestException } from '@nestjs/common';
import { AppConfigController, PublicConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';
import { ApiErrorCode } from '../common/errors/api-error.codes';
import { User } from '../user/interfaces/user.interface';

describe('AppConfigController & PublicConfigController', () => {
  let appConfigService: jest.Mocked<AppConfigService>;
  let publicController: PublicConfigController;
  let adminController: AppConfigController;

  beforeEach(() => {
    appConfigService = {
      getPublicVariables: jest.fn(),
      getAllVariables: jest.fn(),
      getVariableRecord: jest.fn(),
      setVariable: jest.fn(),
      deleteVariable: jest.fn(),
    } as unknown as jest.Mocked<AppConfigService>;

    publicController = new PublicConfigController(appConfigService);
    adminController = new AppConfigController(appConfigService);
  });

  describe('GET /api/config/public', () => {
    it('should return public variables', async () => {
      appConfigService.getPublicVariables.mockResolvedValueOnce({
        APP_THEME: 'innowise',
        DEFAULT_THEME_MODE: 'system',
        MAX_ANSWER_DURATION_SECONDS: 300,
      });

      const res = await publicController.getPublicConfig();
      expect(res).toEqual({
        APP_THEME: 'innowise',
        DEFAULT_THEME_MODE: 'system',
        MAX_ANSWER_DURATION_SECONDS: 300,
      });
    });
  });

  describe('GET /api/config', () => {
    it('should return list of all variables with masked secrets', async () => {
      appConfigService.getAllVariables.mockResolvedValueOnce([
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
        },
      ]);

      const res = await adminController.listAll();
      expect(res[0].value).toBe('********');
    });
  });

  describe('PUT /api/config/:key', () => {
    it('should update configuration variable when allowed', async () => {
      appConfigService.getVariableRecord.mockResolvedValueOnce(null);
      appConfigService.setVariable.mockResolvedValueOnce({
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
      });

      const res = await adminController.upsert(
        'APP_THEME',
        { value: 'purple' },
        { email: 'admin@example.com' } as unknown as User,
      );

      expect(res.value).toBe('purple');
      expect(appConfigService.setVariable).toHaveBeenCalledWith(
        'APP_THEME',
        'purple',
        expect.objectContaining({ updatedBy: 'admin@example.com' }),
      );
    });

    it('should throw 400 INVALID_CONFIG_VALUE when value is not in allowed options', async () => {
      appConfigService.getVariableRecord.mockResolvedValueOnce({
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
      });

      try {
        await adminController.upsert(
          'APP_THEME',
          { value: 'yellow' },
          { email: 'admin@example.com' } as unknown as User,
        );
        fail('Should have thrown BadRequestException');
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
