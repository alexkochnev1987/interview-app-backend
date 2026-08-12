import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { SYSTEM_CONFIG_DEFAULTS } from './app-config-defaults';

export type VariableType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'json'
  | 'secret';

export interface AppVariableRecord {
  id: string;
  key: string;
  value: string;
  valueType: VariableType;
  options?: string[] | null;
  isPublic: boolean;
  isSecret: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string | null;
  isOverridden: boolean;
}

interface CacheEntry {
  record: AppVariableRecord;
  expiresAt: number;
}

const CACHE_TTL_MS = 15_000; // 15 seconds

/**
 * Centralised runtime configuration service (AWS SSM / Vercel Environment style).
 *
 * Resolution cascade for every key:
 *   1. In-memory cache (backed by PostgreSQL `app_variables` table)
 *   2. `process.env` (OS / Docker / ECS Task Definition)
 *   3. Code-level default supplied by the caller
 *
 * Writes go straight to the database and invalidate the local cache entry
 * immediately. Other Fargate instances converge within the 15-second TTL.
 */
@Injectable()
export class AppConfigService implements OnModuleInit {
  private static readonly logger = new Logger(AppConfigService.name);

  /** Per-key cache with independent TTL tracking. */
  private readonly cache = new Map<string, CacheEntry>();

  /**
   * Full-table snapshot used by `getAllVariables()` and `getPublicVariables()`.
   * Refreshed at most once per TTL window.
   */
  private allCache: { records: AppVariableRecord[]; expiresAt: number } | null =
    null;

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.warmCache();
      AppConfigService.logger.log(
        `Cache warmed – ${this.cache.size} variable(s) loaded from app_variables`,
      );
    } catch (err) {
      // Non-fatal: table may not exist yet (migrations haven't run).
      AppConfigService.logger.warn(
        `Could not warm app_variables cache (table may not exist yet): ${(err as Error).message}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Cascade getters
  // ---------------------------------------------------------------------------

  /**
   * Core cascade resolver:
   *   DB override → process.env → SYSTEM_CONFIG_DEFAULTS → caller default.
   */
  async getString(
    key: string,
    defaultValue?: string,
  ): Promise<string | undefined> {
    // 1. DB / cache
    const dbRecord = await this.getFromCacheOrDb(key);
    if (dbRecord) {
      return dbRecord.value;
    }

    // 2. process.env
    const envValue = process.env[key];
    if (envValue !== undefined && envValue.trim() !== '') {
      return envValue;
    }

    // 3. Centralised system defaults
    const systemDefault = SYSTEM_CONFIG_DEFAULTS[key]?.value;
    if (systemDefault !== undefined && systemDefault.trim() !== '') {
      return systemDefault;
    }

    // 4. Code default
    return defaultValue;
  }

  async getNumber(key: string, defaultValue: number): Promise<number> {
    const raw = await this.getString(key);
    if (raw === undefined || raw === null) {
      return defaultValue;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }

  async getBoolean(key: string, defaultValue: boolean): Promise<boolean> {
    const raw = await this.getString(key);
    if (raw === undefined || raw === null) {
      return defaultValue;
    }
    const lower = raw.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') {
      return true;
    }
    if (lower === 'false' || lower === '0' || lower === 'no') {
      return false;
    }
    return defaultValue;
  }

  async getJson<T>(key: string, defaultValue: T): Promise<T> {
    const raw = await this.getString(key);
    if (raw === undefined || raw === null) {
      return defaultValue;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  }

  // ---------------------------------------------------------------------------
  // CRUD for Super Admin
  // ---------------------------------------------------------------------------

  /** Get a single variable record by key (or null if absent). */
  async getVariableRecord(key: string): Promise<AppVariableRecord | null> {
    return this.getFromCacheOrDb(key);
  }

  /** Return all variables from the DB merged with system defaults. */
  async getAllVariables(): Promise<AppVariableRecord[]> {
    if (this.allCache && Date.now() < this.allCache.expiresAt) {
      return this.allCache.records;
    }

    const { rows } = await this.db.query<AppVariableRow>(
      `SELECT id, key, value, value_type, options, is_public, is_secret,
              description, created_at, updated_at, updated_by
       FROM app_variables
       ORDER BY key`,
    );

    const dbEntries = rows.map(mapRow);
    const dbMap = new Map(dbEntries.map((e) => [e.key, e]));
    const result: AppVariableRecord[] = [];
    const processedKeys = new Set<string>();

    for (const [key, defaultEntry] of Object.entries(SYSTEM_CONFIG_DEFAULTS)) {
      processedKeys.add(key);
      const dbOverride = dbMap.get(key);

      if (dbOverride) {
        result.push({
          ...dbOverride,
          options: dbOverride.options ?? defaultEntry.options,
          description:
            dbOverride.description ?? defaultEntry.description ?? null,
          isOverridden: true,
        });
      } else {
        result.push({
          id: `default-${key}`,
          key: defaultEntry.key,
          value: defaultEntry.value,
          valueType: defaultEntry.valueType,
          options: defaultEntry.options,
          isPublic: defaultEntry.isPublic,
          isSecret: defaultEntry.isSecret,
          description: defaultEntry.description ?? null,
          createdAt: new Date(0),
          updatedAt: new Date(0),
          updatedBy: null,
          isOverridden: false,
        });
      }
    }

    for (const dbEntry of dbEntries) {
      if (!processedKeys.has(dbEntry.key)) {
        result.push({
          ...dbEntry,
          isOverridden: true,
        });
      }
    }

    this.allCache = { records: result, expiresAt: Date.now() + CACHE_TTL_MS };
    return result;
  }

  /**
   * Return public variables as a parsed key→value dictionary for the frontend.
   * Secret values are never included regardless of is_public flag.
   */
  async getPublicVariables(): Promise<Record<string, unknown>> {
    const all = await this.getAllVariables();
    const result: Record<string, unknown> = {};

    for (const rec of all) {
      if (!rec.isPublic || rec.isSecret) continue;
      result[rec.key] = parseTypedValue(rec.value, rec.valueType);
    }

    return result;
  }

  /**
   * Create or update (upsert) a variable.
   * Immediately invalidates local cache.
   */
  async setVariable(
    key: string,
    value: string,
    opts: {
      valueType?: VariableType;
      options?: string[];
      isPublic?: boolean;
      isSecret?: boolean;
      description?: string;
      updatedBy?: string;
    },
  ): Promise<AppVariableRecord> {
    const defaultEntry = SYSTEM_CONFIG_DEFAULTS[key];
    const { rows } = await this.db.query<AppVariableRow>(
      `INSERT INTO app_variables (key, value, value_type, options, is_public, is_secret, description, updated_by)
       VALUES ($1, $2, COALESCE($3, $9::varchar), $4, COALESCE($5, $10::boolean), COALESCE($6, $11::boolean), COALESCE($7, $12::text), $8)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         value_type = COALESCE($3, app_variables.value_type),
         options = COALESCE($4, app_variables.options),
         is_public = COALESCE($5, app_variables.is_public),
         is_secret = COALESCE($6, app_variables.is_secret),
         description = COALESCE($7, app_variables.description),
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING id, key, value, value_type, options, is_public, is_secret,
                 description, created_at, updated_at, updated_by`,
      [
        key,
        value,
        opts.valueType ?? null,
        opts.options ?? null,
        opts.isPublic ?? null,
        opts.isSecret ?? null,
        opts.description ?? null,
        opts.updatedBy ?? null,
        defaultEntry?.valueType ?? 'string',
        defaultEntry?.isPublic ?? false,
        defaultEntry?.isSecret ?? false,
        defaultEntry?.description ?? null,
      ],
    );

    const record = mapRow(rows[0]);
    this.cache.set(key, { record, expiresAt: Date.now() + CACHE_TTL_MS });
    this.allCache = null; // Invalidate full-table cache
    return record;
  }

  /**
   * Delete a variable override → system falls back to process.env / code default.
   */
  async deleteVariable(key: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `DELETE FROM app_variables WHERE key = $1`,
      [key],
    );
    this.cache.delete(key);
    this.allCache = null;
    return (rowCount ?? 0) > 0;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async getFromCacheOrDb(
    key: string,
  ): Promise<AppVariableRecord | null> {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.record;
    }

    try {
      const { rows } = await this.db.query<AppVariableRow>(
        `SELECT id, key, value, value_type, options, is_public, is_secret,
                description, created_at, updated_at, updated_by
         FROM app_variables WHERE key = $1`,
        [key],
      );

      if (rows.length === 0) {
        // Negative cache: remember that this key is absent in DB for TTL
        this.cache.delete(key);
        return null;
      }

      const record = mapRow(rows[0]);
      this.cache.set(key, { record, expiresAt: Date.now() + CACHE_TTL_MS });
      return record;
    } catch {
      // If the table doesn't exist yet, fall through silently.
      return null;
    }
  }

  private async warmCache(): Promise<void> {
    const { rows } = await this.db.query<AppVariableRow>(
      `SELECT id, key, value, value_type, options, is_public, is_secret,
              description, created_at, updated_at, updated_by
       FROM app_variables`,
    );
    const now = Date.now();
    for (const row of rows) {
      const record = mapRow(row);
      this.cache.set(record.key, {
        record,
        expiresAt: now + CACHE_TTL_MS,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Row mapping & value parsing utilities
// ---------------------------------------------------------------------------

interface AppVariableRow {
  id: string;
  key: string;
  value: string;
  value_type: string;
  options: string[] | null;
  is_public: boolean;
  is_secret: boolean;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  updated_by: string | null;
}

function mapRow(row: AppVariableRow): AppVariableRecord {
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    valueType: row.value_type as VariableType,
    options: row.options ?? undefined,
    isPublic: row.is_public,
    isSecret: row.is_secret,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    isOverridden: true,
  };
}

function parseTypedValue(value: string, valueType: VariableType): unknown {
  switch (valueType) {
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? n : value;
    }
    case 'boolean':
      return (
        value.trim().toLowerCase() === 'true' ||
        value.trim() === '1' ||
        value.trim().toLowerCase() === 'yes'
      );
    case 'json':
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}
