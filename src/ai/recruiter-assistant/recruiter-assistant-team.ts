import { RecruiterAssistantConfigService } from '../../app-config/recruiter-assistant-config.service';
import { AuthUserResponseDto } from '../../auth/dto/auth-user.response.dto';
import { User, UserRole } from '../../user/interfaces/user.interface';
import { RecruiterAssistantTeamSummaryDto } from './dto/recruiter-assistant.dto';

export function buildTeamSummaryFromRoleCounts(
  counts: Record<UserRole, number>,
): RecruiterAssistantTeamSummaryDto {
  return {
    superAdmin: counts.super_admin,
    admin: counts.admin,
    hr: counts.hr,
    candidate: counts.candidate,
    total:
      counts.super_admin + counts.admin + counts.hr + counts.candidate,
  };
}

export async function mapUsersToAuthUserResponseDtos(
  users: Omit<User, 'passwordHash'>[],
  config: RecruiterAssistantConfigService,
): Promise<AuthUserResponseDto[]> {
  const roles = [...new Set(users.map((user) => user.role))];
  const enabledByRole = new Map<UserRole, boolean>();

  await Promise.all(
    roles.map(async (role) => {
      enabledByRole.set(
        role,
        await config.isRecruiterAssistantEnabledForRole(role),
      );
    }),
  );

  return users.map((user) => ({
    ...user,
    recruiterAssistantEnabled: enabledByRole.get(user.role) ?? false,
  }));
}
