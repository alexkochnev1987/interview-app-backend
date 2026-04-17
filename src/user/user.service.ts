import { Injectable, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from './interfaces/user.interface';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService implements OnModuleInit {
  private users: User[] = [];

  async onModuleInit(): Promise<void> {
    const existing = this.findByEmail('admin@interview-app.com');
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
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user: User = {
      id: crypto.randomUUID(),
      email: dto.email,
      name: dto.name,
      role: dto.role,
      organizationId: dto.organizationId,
      passwordHash,
      createdAt: new Date(),
    };
    this.users.push(user);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      createdAt: user.createdAt,
    };
  }

  findByEmail(email: string): User | undefined {
    return this.users.find((u) => u.email === email);
  }

  findById(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }
}
