import { UserService } from '../../user/user.service';
import { pickUniqueByPersonName } from './recruiter-assistant-name-match';
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

  const hrUsers = await userService.listAll({
    role: 'hr',
    demo,
    nameContains: ref.name,
    limit: 100,
  });
  const match = pickUniqueByPersonName(hrUsers, ref.name, (user) => user.name);
  if (!match) {
    return null;
  }

  return { id: match.id, name: match.name };
}
