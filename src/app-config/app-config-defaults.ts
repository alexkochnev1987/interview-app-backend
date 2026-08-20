export type VariableType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'json'
  | 'secret';

export interface SystemConfigDefaultEntry {
  key: string;
  value: string;
  valueType: VariableType;
  options?: string[];
  description?: string;
  isPublic: boolean;
  isSecret: boolean;
}

export const SYSTEM_CONFIG_DEFAULTS: Record<string, SystemConfigDefaultEntry> =
  {
    MAX_ANSWER_DURATION_SECONDS: {
      key: 'MAX_ANSWER_DURATION_SECONDS',
      value: '240',
      valueType: 'number',
      description: 'Maximum answer recording duration in seconds',
      isPublic: true,
      isSecret: false,
    },
    MAX_ANSWER_ATTEMPTS_PER_QUESTION: {
      key: 'MAX_ANSWER_ATTEMPTS_PER_QUESTION',
      value: '3',
      valueType: 'number',
      description: 'Maximum recording attempts per question',
      isPublic: true,
      isSecret: false,
    },
    ENABLE_GOOGLE_OAUTH: {
      key: 'ENABLE_GOOGLE_OAUTH',
      value: 'true',
      valueType: 'boolean',
      description: 'Whether Google OAuth sign-in button is shown',
      isPublic: true,
      isSecret: false,
    },
    ENABLE_FEEDBACK_SHARE_LINKS: {
      key: 'ENABLE_FEEDBACK_SHARE_LINKS',
      value: 'true',
      valueType: 'boolean',
      description: 'Whether candidate-feedback share links are available',
      isPublic: true,
      isSecret: false,
    },
    DEFAULT_THEME_MODE: {
      key: 'DEFAULT_THEME_MODE',
      value: 'system',
      valueType: 'enum',
      options: ['system', 'light', 'dark'],
      description: 'Default UI theme mode',
      isPublic: true,
      isSecret: false,
    },
    APP_THEME: {
      key: 'APP_THEME',
      value: 'innowise',
      valueType: 'enum',
      options: ['innowise', 'red', 'blue', 'purple'],
      description: 'Active UI color theme preset',
      isPublic: true,
      isSecret: false,
    },
    RECRUITER_ASSISTANT_ENABLED: {
      key: 'RECRUITER_ASSISTANT_ENABLED',
      value: 'true',
      valueType: 'boolean',
      description:
        'Whether Herman (recruiter AI assistant) is enabled org-wide',
      isPublic: true,
      isSecret: false,
    },
    RECRUITER_ASSISTANT_ENABLED_SUPER_ADMIN: {
      key: 'RECRUITER_ASSISTANT_ENABLED_SUPER_ADMIN',
      value: 'true',
      valueType: 'boolean',
      description: 'Whether Herman is enabled for super_admin users',
      isPublic: false,
      isSecret: false,
    },
    RECRUITER_ASSISTANT_ENABLED_ADMIN: {
      key: 'RECRUITER_ASSISTANT_ENABLED_ADMIN',
      value: 'true',
      valueType: 'boolean',
      description: 'Whether Herman is enabled for admin users',
      isPublic: false,
      isSecret: false,
    },
    RECRUITER_ASSISTANT_ENABLED_HR: {
      key: 'RECRUITER_ASSISTANT_ENABLED_HR',
      value: 'true',
      valueType: 'boolean',
      description: 'Whether Herman is enabled for hr users',
      isPublic: false,
      isSecret: false,
    },
    RECRUITER_ASSISTANT_ENABLED_CANDIDATE: {
      key: 'RECRUITER_ASSISTANT_ENABLED_CANDIDATE',
      value: 'true',
      valueType: 'boolean',
      description: 'Whether Herman is enabled for candidate users',
      isPublic: false,
      isSecret: false,
    },
    RECRUITER_ASSISTANT_ENABLED_ROLES: {
      key: 'RECRUITER_ASSISTANT_ENABLED_ROLES',
      value: '',
      valueType: 'string',
      description:
        'Optional comma-separated roles allowed to use Herman (super_admin, admin, hr, candidate). Empty = all roles when no per-role override is set.',
      isPublic: false,
      isSecret: false,
    },
    ENABLE_AI_ASSISTANT: {
      key: 'ENABLE_AI_ASSISTANT',
      value: 'true',
      valueType: 'boolean',
      description: 'Deprecated alias for RECRUITER_ASSISTANT_ENABLED',
      isPublic: true,
      isSecret: false,
    },
  };
