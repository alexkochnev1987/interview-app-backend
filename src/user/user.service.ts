import crypto from 'crypto';

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import bcrypt from 'bcrypt';

import { ASSIGNABLE_BY, outranks } from '../auth/role-policy';
import { apiBadRequest, apiConflict } from '../common/errors/api-error';
import { ApiErrorCode } from '../common/errors/api-error.codes';
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
import {
  computeAvatarPictureUrl,
  resolveAvatarSourceOnGoogleLogin,
} from './avatar/avatar-picture-url';
import { AvatarService } from './avatar/avatar.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AvatarSource, User } from './interfaces/user.interface';
import { OnboardingStatus, UserRole } from './interfaces/user.interface';
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
  avatar_source: AvatarSource;
  avatar_key: string | null;
  google_picture_url: string | null;
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
  onboarding_status,
  avatar_source,
  avatar_key,
  google_picture_url
`;

@Injectable()
export class UserService implements OnModuleInit {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => AvatarService))
    private readonly avatarService: AvatarService,
  ) {}

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
      const avatarSource: AvatarSource = dto.googlePictureUrl
        ? 'google'
        : 'none';
      const result = await client.query<UserRow>(
        `
          INSERT INTO users (
            id,
            email,
            name,
            role,
            organization_id,
            password_hash,
            google_picture_url,
            avatar_source
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING ${USER_COLUMNS}
        `,
        [
          crypto.randomUUID(),
          email,
          dto.name,
          dto.role,
          dto.organizationId ?? null,
          passwordHash,
          dto.googlePictureUrl ?? null,
          avatarSource,
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

    return toUserProfileForActor({ id: actor.id, role: actor.role }, target);
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

  async countUsersByRole(
    options: { demo?: boolean } = {},
  ): Promise<Record<UserRole, number>> {
    const demo = options.demo ?? null;
    const result = await this.databaseService.query<{
      role: UserRole;
      count: string;
    }>(
      `
        SELECT role, COUNT(*)::text AS count
        FROM users
        WHERE ($1::boolean IS NULL OR demo = $1)
        GROUP BY role
      `,
      [demo],
    );

    const counts: Record<UserRole, number> = {
      super_admin: 0,
      admin: 0,
      hr: 0,
      candidate: 0,
    };

    for (const row of result.rows) {
      counts[row.role] = Number(row.count);
    }

    return counts;
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

  // Email is identity only; role changes only via assignRole (not SUPER_ADMIN_EMAILS).
  async updateUser(
    actor: { id: string; role: UserRole },
    targetId: string,
    dto: UpdateUserDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    const hasUpdate = dto.name !== undefined || dto.email !== undefined;
    if (!hasUpdate) {
      throw new BadRequestException(
        'At least one of name or email must be provided',
      );
    }

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

      if (target.demo) {
        throw new ForbiddenException('Cannot modify the demo account');
      }

      if (actor.id !== target.id && !outranks(actor.role, target.role)) {
        throw new ForbiddenException(
          'You can only update users whose role is below your own',
        );
      }

      const nextName = dto.name !== undefined ? dto.name : target.name;
      const nextEmail =
        dto.email !== undefined ? this.normalizeEmail(dto.email) : target.email;

      if (nextName === target.name && nextEmail === target.email) {
        throw new BadRequestException('No changes to apply');
      }

      if (nextEmail !== target.email) {
        const conflict = await client.query<{ id: string }>(
          `
            SELECT id
            FROM users
            WHERE email = $1 AND id <> $2
            LIMIT 1
          `,
          [nextEmail, targetId],
        );
        if (conflict.rows[0]) {
          throw apiConflict(
            ApiErrorCode.CONFLICT,
            'A user with this email already exists',
          );
        }
      }

      try {
        const updateResult = await client.query<UserRow>(
          `
            UPDATE users
            SET name = $2,
                email = $3,
                updated_at = NOW()
            WHERE id = $1
            RETURNING ${USER_COLUMNS}
          `,
          [targetId, nextName, nextEmail],
        );
        const updatedRow = updateResult.rows[0];
        if (!updatedRow) {
          throw new NotFoundException(`User ${targetId} not found`);
        }
        return this.toPublicUser(this.mapRow(updatedRow));
      } catch (error) {
        const dbErr = error as { code?: string };
        if (dbErr?.code === '23505') {
          throw apiConflict(
            ApiErrorCode.CONFLICT,
            'A user with this email already exists',
          );
        }
        throw error;
      }
    });
  }

  async deleteUser(
    actor: { id: string; role: UserRole },
    targetId: string,
  ): Promise<void> {
    if (actor.id === targetId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    const avatarKey = await this.databaseService.withTransaction(
      async (client) => {
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

        if (target.demo && actor.role !== 'super_admin') {
          throw new ForbiddenException('Cannot delete the demo account');
        }

        if (!outranks(actor.role, target.role)) {
          throw new ForbiddenException(
            'You can only delete users whose role is below your own',
          );
        }

        await client.query(`DELETE FROM users WHERE id = $1`, [targetId]);
        return target.avatarKey;
      },
    );

    if (avatarKey) {
      await this.avatarService.deleteObjectQuietly(avatarKey);
    }
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
      avatarSource: user.avatarSource,
      hasGoogleAvatar: user.hasGoogleAvatar,
      pictureUrl: user.pictureUrl,
    };
  }

  /**
   * Sets a custom S3-backed avatar for the user, returning the previous
   * avatar_key (if any) so the caller can clean up the now-orphaned S3
   * object after this DB update has committed.
   */
  async setAvatarUpload(
    userId: string,
    avatarKey: string,
  ): Promise<{ previousAvatarKey?: string; user: Omit<User, 'passwordHash'> }> {
    return this.databaseService.withTransaction(async (client) => {
      const previousResult = await client.query<UserRow>(
        `
          SELECT ${USER_COLUMNS}
          FROM users
          WHERE id = $1
          FOR UPDATE
        `,
        [userId],
      );
      const previousRow = previousResult.rows[0];
      if (!previousRow) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      const updateResult = await client.query<UserRow>(
        `
          UPDATE users
          SET avatar_key = $2,
              avatar_source = 'upload',
              updated_at = NOW()
          WHERE id = $1
          RETURNING ${USER_COLUMNS}
        `,
        [userId, avatarKey],
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      return {
        previousAvatarKey: previousRow.avatar_key ?? undefined,
        user: this.toPublicUser(this.mapRow(updatedRow)),
      };
    });
  }

  /**
   * Reverts a user to the initials placeholder for the current session.
   * Deliberately does not fall back to google_picture_url even if one is
   * still stored on the row — the Google photo only re-activates on a
   * subsequent Google login (see UserService.activateGoogleAvatar), not
   * automatically here.
   */
  async clearAvatar(
    userId: string,
  ): Promise<{ previousAvatarKey?: string; user: Omit<User, 'passwordHash'> }> {
    return this.databaseService.withTransaction(async (client) => {
      const previousResult = await client.query<UserRow>(
        `
          SELECT ${USER_COLUMNS}
          FROM users
          WHERE id = $1
          FOR UPDATE
        `,
        [userId],
      );
      const previousRow = previousResult.rows[0];
      if (!previousRow) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      const updateResult = await client.query<UserRow>(
        `
          UPDATE users
          SET avatar_key = NULL,
              avatar_source = 'none',
              updated_at = NOW()
          WHERE id = $1
          RETURNING ${USER_COLUMNS}
        `,
        [userId],
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      return {
        previousAvatarKey: previousRow.avatar_key ?? undefined,
        user: this.toPublicUser(this.mapRow(updatedRow)),
      };
    });
  }

  /**
   * User-triggered restore of the last-known Google photo (e.g. after having
   * uploaded a custom picture, or having previously deleted down to
   * initials). Unlike activateGoogleAvatar, this never touches
   * google_picture_url itself — it only re-activates whatever is already
   * stored. No-op-that-throws if the user never has a Google picture on file.
   */
  async restoreGoogleAvatar(
    userId: string,
  ): Promise<{ previousAvatarKey?: string; user: Omit<User, 'passwordHash'> }> {
    return this.databaseService.withTransaction(async (client) => {
      const previousResult = await client.query<UserRow>(
        `
          SELECT ${USER_COLUMNS}
          FROM users
          WHERE id = $1
          FOR UPDATE
        `,
        [userId],
      );
      const previousRow = previousResult.rows[0];
      if (!previousRow) {
        throw new NotFoundException(`User ${userId} not found`);
      }
      if (!previousRow.google_picture_url) {
        throw apiBadRequest(
          ApiErrorCode.AVATAR_NO_GOOGLE_PICTURE,
          'No Google picture is available to restore',
        );
      }

      const updateResult = await client.query<UserRow>(
        `
          UPDATE users
          SET avatar_key = NULL,
              avatar_source = 'google',
              updated_at = NOW()
          WHERE id = $1
          RETURNING ${USER_COLUMNS}
        `,
        [userId],
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      return {
        previousAvatarKey: previousRow.avatar_key ?? undefined,
        user: this.toPublicUser(this.mapRow(updatedRow)),
      };
    });
  }

  /**
   * Called on every Google login for an existing user. Always refreshes the
   * stored Google photo, but only activates it as the picture source per
   * resolveAvatarSourceOnGoogleLogin: a custom upload is never clobbered, and
   * an explicit delete (avatar_source 'none' with a Google picture already on
   * file) stays 'none' — it only re-activates via the manual "Restore Google
   * picture" action, not automatically on login. A 'none' row with no prior
   * Google picture is a first-ever Google link and does activate 'google'.
   */
  async activateGoogleAvatar(
    userId: string,
    googlePictureUrl: string,
  ): Promise<Omit<User, 'passwordHash'>> {
    return this.databaseService.withTransaction(async (client) => {
      const previousResult = await client.query<UserRow>(
        `
          SELECT ${USER_COLUMNS}
          FROM users
          WHERE id = $1
          FOR UPDATE
        `,
        [userId],
      );
      const previousRow = previousResult.rows[0];
      if (!previousRow) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      const avatarSource = resolveAvatarSourceOnGoogleLogin({
        currentAvatarSource: previousRow.avatar_source,
        hadGooglePictureBefore: previousRow.google_picture_url != null,
      });

      const updateResult = await client.query<UserRow>(
        `
          UPDATE users
          SET google_picture_url = $2,
              avatar_source = $3,
              updated_at = NOW()
          WHERE id = $1
          RETURNING ${USER_COLUMNS}
        `,
        [userId, googlePictureUrl, avatarSource],
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new NotFoundException(`User ${userId} not found`);
      }
      return this.toPublicUser(this.mapRow(updatedRow));
    });
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private mapRow(row: UserRow): User {
    const avatarSource = row.avatar_source ?? 'none';
    const avatarKey = row.avatar_key ?? undefined;
    const googlePictureUrl = row.google_picture_url ?? undefined;
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
      avatarSource,
      hasGoogleAvatar: avatarSource === 'google' && !!googlePictureUrl,
      avatarKey,
      googlePictureUrl,
      pictureUrl: computeAvatarPictureUrl({
        userId: row.id,
        avatarSource,
        avatarKey,
        googlePictureUrl,
      }),
    };
  }
}
