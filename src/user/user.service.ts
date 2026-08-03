import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from './interfaces/user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { OnboardingStatus, UserRole } from './interfaces/user.interface';
import { DatabaseService } from '../database/database.service';
import {
  isDemoSeedAllowed,
  seedDemoData,
  type DemoSeedCounts,
} from '../database/demo-seed-core';
import {
  seedOnboardingLitePack,
  shouldSeedOnboardingLitePack,
} from '../database/onboarding-lite-seed';
import { ASSIGNABLE_BY, outranks } from '../auth/role-policy';
import { canReadUserProfile } from './user-access-rules';
import { toUserProfileForActor, UserProfile } from './user-profile';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organization_id: string | null;
  password_hash: string;
  demo: boolean;
  created_at: Date;
  onboarding_completed_at: Date | null;
  onboarding_status: OnboardingStatus | null;
}

const USER_COLUMNS = `
  id,
  email,
  name,
  role,
  organization_id,
  password_hash,
  demo,
  created_at,
  onboarding_completed_at,
  onboarding_status
`;

@Injectable()
export class UserService implements OnModuleInit {
  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    const existing = await this.findByEmail('admin@interview-app.com');
    if (!existing) {
      await this.create({
        email: 'admin@interview-app.com',
        name: 'Super Admin',
        password: 'admin123',
        role: 'super_admin',
      });
    }
  }

  async create(dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const email = this.normalizeEmail(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<UserRow>(
        `
          INSERT INTO users (
            id,
            email,
            name,
            role,
            organization_id,
            password_hash
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING ${USER_COLUMNS}
        `,
        [
          crypto.randomUUID(),
          email,
          dto.name,
          dto.role,
          dto.organizationId ?? null,
          passwordHash,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new NotFoundException('Failed to create user');
      }

      if (shouldSeedOnboardingLitePack(dto.role, row.demo)) {
        await seedOnboardingLitePack(client, row.id);
      }

      return this.toPublicUser(this.mapRow(row));
    });
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const normalizedEmail = this.normalizeEmail(email);
    const result = await this.databaseService.query<UserRow>(
      `
        SELECT ${USER_COLUMNS}
        FROM users
        WHERE email = $1
        LIMIT 1
      `,
      [normalizedEmail],
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : undefined;
  }

  async findDemoUser(): Promise<User | undefined> {
    const result = await this.databaseService.query<UserRow>(
      `
        SELECT ${USER_COLUMNS}
        FROM users
        WHERE demo = TRUE
        ORDER BY created_at ASC
        LIMIT 1
      `,
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : undefined;
  }

  /**
   * Idempotently provisions the read-only demo account and demo content so the
   * demo login works on an environment without direct database access. Gated by
   * isDemoSeedAllowed so it can never seed production data by accident. Returns
   * the public demo user (never the password hash).
   */
  async provisionDemo(): Promise<{
    user: Omit<User, 'passwordHash'>;
    counts: DemoSeedCounts;
  }> {
    if (!isDemoSeedAllowed()) {
      throw new ForbiddenException(
        'Demo provisioning is disabled in this environment. Set ' +
          'ALLOW_DEMO_SEED=true on the backend to enable it (never on production).',
      );
    }
    const counts = await seedDemoData(this.databaseService);
    const user = await this.findDemoUser();
    if (!user) {
      throw new BadRequestException(
        'Demo provisioning ran but no demo user was found.',
      );
    }
    return { user: this.toPublicUser(user), counts };
  }

  async findById(id: string): Promise<User | undefined> {
    const result = await this.databaseService.query<UserRow>(
      `
        SELECT ${USER_COLUMNS}
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : undefined;
  }

  async findOneForActor(
    actor: Omit<User, 'passwordHash'>,
    targetId: string,
  ): Promise<UserProfile> {
    const target = await this.findById(targetId);

    if (
      !target ||
      !canReadUserProfile(
        { id: target.id, role: target.role },
        { id: actor.id, role: actor.role },
      )
    ) {
      throw new NotFoundException(`User ${targetId} not found`);
    }

    return toUserProfileForActor(
      { id: actor.id, role: actor.role },
      target,
    );
  }

  async listAll(
    options: {
      limit?: number;
      offset?: number;
      role?: UserRole;
      demo?: boolean;
      nameContains?: string;
    } = {},
  ): Promise<Omit<User, 'passwordHash'>[]> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const role = options.role ?? null;
    const demo = options.demo ?? null;
    const nameContains = options.nameContains?.trim() || null;
    const orderBy = role ? 'name ASC, created_at DESC' : 'created_at DESC';
    const result = await this.databaseService.query<UserRow>(
      `
        SELECT ${USER_COLUMNS}
        FROM users
        WHERE ($3::text IS NULL OR role = $3)
          AND ($4::boolean IS NULL OR demo = $4)
          AND ($5::text IS NULL OR name ILIKE '%' || $5 || '%')
        ORDER BY ${orderBy}
        LIMIT $1 OFFSET $2
      `,
      [limit, offset, role, demo, nameContains],
    );
    return result.rows.map((row) => this.toPublicUser(this.mapRow(row)));
  }

  async assignRole(
    actor: { id: string; role: UserRole },
    targetId: string,
    newRole: UserRole,
  ): Promise<Omit<User, 'passwordHash'>> {
    if (actor.id === targetId) {
      throw new ForbiddenException('You cannot change your own role');
    }

    const allowedNewRoles = ASSIGNABLE_BY[actor.role];
    if (allowedNewRoles.length === 0) {
      throw new ForbiddenException('You are not allowed to assign roles');
    }
    if (!allowedNewRoles.includes(newRole)) {
      throw new ForbiddenException(
        `Role "${newRole}" cannot be assigned by ${actor.role}`,
      );
    }

    // SELECT … FOR UPDATE serializes concurrent assignRole calls on the same
    // target so the rank check cannot be bypassed by interleaving (e.g. two
    // admins simultaneously promoting the same hr through their bound).
    return this.databaseService.withTransaction(async (client) => {
      const targetResult = await client.query<UserRow>(
        `
          SELECT ${USER_COLUMNS}
          FROM users
          WHERE id = $1
          FOR UPDATE
        `,
        [targetId],
      );
      const targetRow = targetResult.rows[0];
      if (!targetRow) {
        throw new NotFoundException(`User ${targetId} not found`);
      }
      const target = this.mapRow(targetRow);

      if (!outranks(actor.role, target.role)) {
        throw new ForbiddenException(
          'You can only change users whose role is below your own',
        );
      }

      if (target.role === newRole) {
        throw new BadRequestException('User already has the requested role');
      }

      const updateResult = await client.query<UserRow>(
        `
          UPDATE users
          SET role = $2,
              updated_at = NOW()
          WHERE id = $1
          RETURNING ${USER_COLUMNS}
        `,
        [targetId, newRole],
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new NotFoundException(`User ${targetId} not found`);
      }

      if (shouldSeedOnboardingLitePack(newRole, updatedRow.demo)) {
        await seedOnboardingLitePack(client, targetId);
      }

      return this.toPublicUser(this.mapRow(updatedRow));
    });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async completeOnboarding(
    userId: string,
    status: OnboardingStatus,
  ): Promise<Omit<User, 'passwordHash'>> {
    const result = await this.databaseService.query<UserRow>(
      `
        UPDATE users
        SET onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()),
            onboarding_status = $2,
            updated_at = CASE
              WHEN onboarding_completed_at IS NULL THEN NOW()
              ELSE updated_at
            END
        WHERE id = $1
        RETURNING ${USER_COLUMNS}
      `,
      [userId, status],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    return this.toPublicUser(this.mapRow(row));
  }

  toPublicUser(user: User): Omit<User, 'passwordHash'> {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      demo: user.demo,
      onboardingCompletedAt: user.onboardingCompletedAt,
      onboardingStatus: user.onboardingStatus,
      createdAt: user.createdAt,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private mapRow(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      organizationId: row.organization_id ?? undefined,
      passwordHash: row.password_hash,
      demo: row.demo ?? false,
      onboardingCompletedAt: row.onboarding_completed_at
        ? new Date(row.onboarding_completed_at)
        : undefined,
      onboardingStatus: row.onboarding_status ?? undefined,
      createdAt: new Date(row.created_at),
    };
  }
}
