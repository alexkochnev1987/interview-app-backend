import { Injectable, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from './interfaces/user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from './interfaces/user.interface';
import { DatabaseService } from '../database/database.service';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organization_id: string | null;
  password_hash: string;
  created_at: Date;
}

@Injectable()
export class UserService implements OnModuleInit {
  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'hr')),
        organization_id TEXT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

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
        RETURNING id, email, name, role, organization_id, password_hash, created_at
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
        SELECT id, email, name, role, organization_id, password_hash, created_at
        FROM users
        WHERE email = $1
        LIMIT 1
      `,
      [normalizedEmail],
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : undefined;
  }

  async findById(id: string): Promise<User | undefined> {
    const result = await this.databaseService.query<UserRow>(
      `
        SELECT id, email, name, role, organization_id, password_hash, created_at
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : undefined;
  }

  async updateRole(id: string, role: UserRole): Promise<User | undefined> {
    const result = await this.databaseService.query<UserRow>(
      `
        UPDATE users
        SET role = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, name, role, organization_id, password_hash, created_at
      `,
      [id, role],
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : undefined;
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
      createdAt: new Date(row.created_at),
    };
  }
}
