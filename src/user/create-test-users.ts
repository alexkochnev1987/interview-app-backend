import '../database/load-env';

import { DatabaseService } from '../database/database.service';
import { UserService } from './user.service';
import { UserRole } from './interfaces/user.interface';

interface SeedUser {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}

const TEST_USERS: SeedUser[] = [
  { email: 'admin@test.com', name: 'Test Admin', password: 'admin123', role: 'admin' },
  { email: 'hr@test.com', name: 'Test HR', password: 'hr123', role: 'hr' },
];

async function main() {
  const databaseService = new DatabaseService();
  const userService = new UserService(databaseService);

  try {
    for (const seed of TEST_USERS) {
      const existing = await userService.findByEmail(seed.email);
      if (existing) {
        console.log(`exists  ${seed.email} (role=${existing.role}) — skipping`);
        continue;
      }
      const created = await userService.create(seed);
      console.log(`created ${created.email} (role=${created.role}, password=${seed.password})`);
    }
  } finally {
    await databaseService.onModuleDestroy();
  }
}

void main().catch((error) => {
  console.error('Failed to seed test users');
  console.error(error);
  process.exit(1);
});
