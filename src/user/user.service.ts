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
import { UserRole } from './interfaces/user.interface';
import { DatabaseService } from '../database/database.service';
import {
  isDemoSeedAllowed,
  seedDemoData,
  type DemoSeedCounts,
} from '../database/demo-seed-core';
import { ASSIGNABLE_BY, outranks } from '../auth/role-policy';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organization_id: string | null;
  password_hash: string;
  demo: boolean;
  created_at: Date;
}

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
    const result = await this.databaseService.query<UserRow>(
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
        RETURNING id, email, name, role, organization_id, password_hash, demo, created_at
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

    return this.toPublicUser(this.mapRow(result.rows[0]));
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const normalizedEmail = this.normalizeEmail(email);
    const result = await this.databaseService.query<UserRow>(
      `
        SELECT id, email, name, role, organization_id, password_hash, demo, created_at
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
        SELECT id, email, name, role, organization_id, password_hash, demo, created_at
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
        SELECT id, email, name, role, organization_id, password_hash, demo, created_at
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : undefined;
  }

  async listAll(
    options: { limit?: number; offset?: number } = {},
  ): Promise<Omit<User, 'passwordHash'>[]> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const result = await this.databaseService.query<UserRow>(
      `
        SELECT id, email, name, role, organization_id, password_hash, demo, created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `,
      [limit, offset],
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
          SELECT id, email, name, role, organization_id, password_hash, demo, created_at
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
          RETURNING id, email, name, role, organization_id, password_hash, demo, created_at
        `,
        [targetId, newRole],
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) {
        throw new NotFoundException(`User ${targetId} not found`);
      }
      return this.toPublicUser(this.mapRow(updatedRow));
    });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  toPublicUser(user: User): Omit<User, 'passwordHash'> {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      demo: user.demo,
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
      createdAt: new Date(row.created_at),
    };
  }
}
