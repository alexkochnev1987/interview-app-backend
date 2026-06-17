import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  Pool,
  PoolClient,
  PoolConfig,
  QueryResult,
  QueryResultRow,
} from 'pg';

const DEFAULT_POOL_MAX = 10;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly poolMax: number;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    this.poolMax = DEFAULT_POOL_MAX;

    const poolConfig: PoolConfig = {
      connectionString,
      max: this.poolMax,
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

  async withClient<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      return await callback(client);
    } finally {
      client.release();
    }
  }

  async withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return this.withClient(async (client) => {
      await client.query('BEGIN');
      try {
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  async withAdvisoryLock<T>(
    key: string,
    callback: () => Promise<T>,
  ): Promise<T> {
    return this.withTransaction(async (client) => {
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [key],
      );
      return callback();
    });
  }

  getPoolMax(): number {
    return this.poolMax;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private shouldUseSsl(connectionString: string): boolean {
    try {
      const url = new URL(connectionString);
      return !['localhost', '127.0.0.1', 'db', 'postgres'].includes(
        url.hostname,
      );
    } catch {
      return false;
    }
  }
}
