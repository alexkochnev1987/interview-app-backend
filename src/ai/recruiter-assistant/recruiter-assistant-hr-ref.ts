import { UserService } from '../../user/user.service';
import { HrRef } from './recruiter-assistant.types';

export async function resolveHrRef(
  userService: UserService,
  ref: HrRef,
  demo: boolean,
): Promise<{ id: string; name: string } | null> {
  if (ref.id) {
    const user = await userService.findById(ref.id);
    if (!user || user.role !== 'hr' || user.demo !== demo) {
      return null;
    }
    return { id: user.id, name: user.name };
  }

  if (!ref.name) {
    return null;
  }

  const normalizedName = ref.name.trim().toLowerCase();
  const hrUsers = await userService.listAll({ role: 'hr', limit: 50 });
  const matches = hrUsers.filter(
    (user) => user.name.toLowerCase() === normalizedName,
  );

  if (matches.length !== 1) {
    return null;
  }

  return { id: matches[0].id, name: matches[0].name };
}
