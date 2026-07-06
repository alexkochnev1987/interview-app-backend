import { HttpStatus } from '@nestjs/common';
import { ApiErrorCode } from './api-error.codes';

export interface ApiErrorCodeDefinition {
  readonly code: ApiErrorCode;
  readonly httpStatus: number;
  readonly defaultMessage: string;
  readonly whenUsed: string;
}

export const API_ERROR_CODE_REGISTRY: readonly ApiErrorCodeDefinition[] = [
  {
    code: ApiErrorCode.BAD_REQUEST,
    httpStatus: HttpStatus.BAD_REQUEST,
    defaultMessage: 'Bad request',
    whenUsed: 'Generic 400 when no specific code was set on the exception.',
  },
  {
    code: ApiErrorCode.VALIDATION_ERROR,
    httpStatus: HttpStatus.BAD_REQUEST,
    defaultMessage: 'Validation failed',
    whenUsed:
      'Request body/query fails class-validator (ValidationPipe). Details in `params.errors`.',
  },
  {
    code: ApiErrorCode.INVALID_LOCALE,
    httpStatus: HttpStatus.BAD_REQUEST,
    defaultMessage: 'Invalid X-Locale header. Supported values: en, be, ru, pl',
    whenUsed: 'Header `X-Locale` is present but not one of en|be|ru|pl.',
  },
  {
    code: ApiErrorCode.REGISTRATION_FAILED,
    httpStatus: HttpStatus.BAD_REQUEST,
    defaultMessage: 'Unable to complete registration',
    whenUsed:
      'POST /auth/register when email is taken or reserved (intentionally generic 400).',
  },
  {
    code: ApiErrorCode.UPLOAD_FAILED,
    httpStatus: HttpStatus.BAD_REQUEST,
    defaultMessage: 'Failed to initialize multipart upload',
    whenUsed: 'S3 multipart session could not be created (missing UploadId).',
  },
  {
    code: ApiErrorCode.UPLOAD_NOT_ALLOWED,
    httpStatus: HttpStatus.BAD_REQUEST,
    defaultMessage: 'Uploads are only allowed for the current question',
    whenUsed:
      'Candidate/recruiter upload targets a question index other than the interview current step.',
  },
  {
    code: ApiErrorCode.UNAUTHORIZED,
    httpStatus: HttpStatus.UNAUTHORIZED,
    defaultMessage: 'Unauthorized',
    whenUsed: 'Generic 401 when no specific code was set on the exception.',
  },
  {
    code: ApiErrorCode.INVALID_CREDENTIALS,
    httpStatus: HttpStatus.UNAUTHORIZED,
    defaultMessage: 'Invalid credentials',
    whenUsed: 'POST /auth/login — unknown email or wrong password.',
  },
  {
    code: ApiErrorCode.AUTHENTICATION_REQUIRED,
    httpStatus: HttpStatus.UNAUTHORIZED,
    defaultMessage: 'Authentication required',
    whenUsed:
      'Staff route protected by PermissionsGuard but JWT/session user is missing.',
  },
  {
    code: ApiErrorCode.CANDIDATE_SESSION_REQUIRED,
    httpStatus: HttpStatus.UNAUTHORIZED,
    defaultMessage: 'Candidate session required',
    whenUsed: 'Candidate cookie session missing on upload/take routes.',
  },
  {
    code: ApiErrorCode.INVALID_CANDIDATE_SESSION,
    httpStatus: HttpStatus.UNAUTHORIZED,
    defaultMessage: 'Invalid or expired candidate session',
    whenUsed: 'Candidate session cookie present but JWT invalid or expired.',
  },
  {
    code: ApiErrorCode.INTERVIEW_TOKEN_REQUIRED,
    httpStatus: HttpStatus.UNAUTHORIZED,
    defaultMessage: 'Interview token required',
    whenUsed: 'Take/interview link accessed without token query param or cookie.',
  },
  {
    code: ApiErrorCode.INVALID_INTERVIEW_TOKEN,
    httpStatus: HttpStatus.UNAUTHORIZED,
    defaultMessage: 'Invalid or expired interview token',
    whenUsed: 'Interview/candidate token present but JWT invalid or expired.',
  },
  {
    code: ApiErrorCode.FORBIDDEN,
    httpStatus: HttpStatus.FORBIDDEN,
    defaultMessage: 'Forbidden',
    whenUsed: 'Generic 403 when no specific code was set on the exception.',
  },
  {
    code: ApiErrorCode.INSUFFICIENT_PERMISSIONS,
    httpStatus: HttpStatus.FORBIDDEN,
    defaultMessage: 'Insufficient permissions',
    whenUsed:
      'Authenticated staff user lacks one or more @RequirePermissions on the route.',
  },
  {
    code: ApiErrorCode.ACCESS_DENIED,
    httpStatus: HttpStatus.FORBIDDEN,
    defaultMessage: 'You do not have access to this resource',
    whenUsed:
      'Role-based access to interviews, users, or feedback (e.g. HR viewing another HR interview).',
  },
  {
    code: ApiErrorCode.NOT_FOUND,
    httpStatus: HttpStatus.NOT_FOUND,
    defaultMessage: 'Not found',
    whenUsed: 'Generic 404 when no specific code was set on the exception.',
  },
  {
    code: ApiErrorCode.QUESTION_NOT_FOUND,
    httpStatus: HttpStatus.NOT_FOUND,
    defaultMessage: 'Question not found',
    whenUsed: 'Question id does not exist or is not visible to the caller.',
  },
  {
    code: ApiErrorCode.INTERVIEW_NOT_FOUND,
    httpStatus: HttpStatus.NOT_FOUND,
    defaultMessage: 'Interview not found',
    whenUsed: 'Interview id does not exist.',
  },
  {
    code: ApiErrorCode.USER_NOT_FOUND,
    httpStatus: HttpStatus.NOT_FOUND,
    defaultMessage: 'User not found',
    whenUsed: 'Target user id does not exist (e.g. role assignment).',
  },
  {
    code: ApiErrorCode.FEEDBACK_NOT_FOUND,
    httpStatus: HttpStatus.NOT_FOUND,
    defaultMessage: 'Feedback not found',
    whenUsed: 'Invalid/expired feedback link or feedback not yet available.',
  },
  {
    code: ApiErrorCode.CONFLICT,
    httpStatus: HttpStatus.CONFLICT,
    defaultMessage: 'Conflict',
    whenUsed: 'Generic 409 when no specific code was set on the exception.',
  },
  {
    code: ApiErrorCode.QUESTION_IN_USE,
    httpStatus: HttpStatus.CONFLICT,
    defaultMessage: 'Question is used by an active interview',
    whenUsed:
      'Soft-delete or destructive change blocked while question is on an in-progress interview.',
  },
  {
    code: ApiErrorCode.VALIDATION_RUNNING,
    httpStatus: HttpStatus.CONFLICT,
    defaultMessage: 'Answer validation is already running',
    whenUsed:
      'Start/re-run AI answer validation while another run is queued or processing.',
  },
  {
    code: ApiErrorCode.QUESTION_DUPLICATE,
    httpStatus: HttpStatus.CONFLICT,
    defaultMessage: 'An active question with the same identity already exists',
    whenUsed: 'Create/update violates unique index on external_id or question text.',
  },
  {
    code: ApiErrorCode.SERVICE_UNAVAILABLE,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
    defaultMessage: 'Service unavailable',
    whenUsed: 'Generic 503 when no specific code was set on the exception.',
  },
  {
    code: ApiErrorCode.AI_PROVIDER_NOT_CONFIGURED,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
    defaultMessage: 'AI provider is not configured',
    whenUsed:
      'Answer validation or AI features invoked without AI_PROVIDER and API keys.',
  },
  {
    code: ApiErrorCode.EMBEDDING_PROVIDER_NOT_CONFIGURED,
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
    defaultMessage: 'Similarity search is not available in this environment',
    whenUsed:
      'POST /questions/similar when EMBEDDING_PROVIDER is none or credentials missing.',
  },
  {
    code: ApiErrorCode.INTERNAL_SERVER_ERROR,
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    defaultMessage: 'Internal server error',
    whenUsed: 'Unhandled exception; no sensitive details exposed.',
  },
] as const;

export const API_ERROR_CODE_BY_CODE: Record<ApiErrorCode, ApiErrorCodeDefinition> =
  API_ERROR_CODE_REGISTRY.reduce(
    (acc, entry) => {
      acc[entry.code] = entry;
      return acc;
    },
    {} as Record<ApiErrorCode, ApiErrorCodeDefinition>,
  );

const _assertRegistryComplete: Record<ApiErrorCode, ApiErrorCodeDefinition> =
  API_ERROR_CODE_BY_CODE;
void _assertRegistryComplete;
