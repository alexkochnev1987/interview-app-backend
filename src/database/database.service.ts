import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    const poolConfig: PoolConfig = {
      connectionString,
      max: 10,
    };

    if (this.shouldUseSsl(connectionString)) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    this.pool = new Pool(poolConfig);
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private shouldUseSsl(connectionString: string): boolean {
    try {
      const url = new URL(connectionString);
      return !['localhost', '127.0.0.1', 'db'].includes(url.hostname);
    } catch {
      return false;
    }
  }
}
