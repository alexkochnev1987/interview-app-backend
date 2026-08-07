import { BadRequestException } from '@nestjs/common';
import { AppConfigController, PublicConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';
import { ApiErrorCode } from '../common/errors/api-error.codes';

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

  describe('PUT /api/config/:key validation', () => {
    it('should allow updating value when value is in allowed options', async () => {
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
        { email: 'admin@example.com' } as any,
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
          { email: 'admin@example.com' } as any,
        );
        fail('Should have thrown BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const response = err.getResponse();
        expect(response.code).toBe(ApiErrorCode.INVALID_CONFIG_VALUE);
        expect(response.message).toBe(
          'Value "yellow" is not allowed for key APP_THEME. Allowed values: innowise, red, blue, purple.',
        );
      }
    });
  });
});
