import { AppConfigService } from '../app-config/app-config.service';
import { apiBadRequest } from '../common/errors/api-error';
import { ApiErrorCode } from '../common/errors/api-error.codes';

export async function assertMediaFileSizeBytesWithinLimit(
  appConfig: Pick<AppConfigService, 'getNumber'>,
  fileSizeBytes?: number,
): Promise<void> {
  if (typeof fileSizeBytes === 'number' && fileSizeBytes > 0) {
    const maxMb = await appConfig.getNumber('MAX_MEDIA_FILE_SIZE_MB', 100);
    const maxBytes = maxMb * 1024 * 1024;
    if (fileSizeBytes > maxBytes) {
      throw apiBadRequest(
        ApiErrorCode.UPLOAD_NOT_ALLOWED,
        `Media file size (${(fileSizeBytes / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed limit of ${maxMb}MB.`,
        { maxMb, fileSizeBytes },
      );
    }
  }
}
