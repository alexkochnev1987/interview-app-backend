import { DatabaseService } from './database.service';
import { DATABASE_MIGRATIONS } from './migrations';

const LEGACY_ONBOARDING_MIGRATION_NAMES = new Set([
  'add_user_onboarding_state',
  'add_user_onboarding_status',
]);

/** Dev DBs that applied onboarding as 0042 before share-link migrations took that slot. */
async function repairRenumberedOnboardingMigration(
  databaseService: DatabaseService,
  appliedMigrations: Map<string, string>,
): Promise<void> {
  const appliedAt0042 = appliedMigrations.get('0042');
  const sourceAt0042 = DATABASE_MIGRATIONS.find(
    (migration) => migration.version === '0042',
  )?.name;
  const renumberedOnboarding = DATABASE_MIGRATIONS.find(
    (migration) => migration.name === 'add_user_onboarding_state',
  );

  if (
    appliedAt0042 === undefined ||
    !LEGACY_ONBOARDING_MIGRATION_NAMES.has(appliedAt0042) ||
    sourceAt0042 !== 'create_candidate_feedback_share_links' ||
    renumberedOnboarding === undefined ||
    appliedMigrations.has(renumberedOnboarding.version)
  ) {
    return;
  }

  await databaseService.query(
    `
      UPDATE schema_migrations
      SET version = $1, name = $2
      WHERE version = '0042'
        AND name = $3
    `,
    [
      renumberedOnboarding.version,
      renumberedOnboarding.name,
      appliedAt0042,
    ],
  );

  appliedMigrations.delete('0042');
  appliedMigrations.set(
    renumberedOnboarding.version,
    renumberedOnboarding.name,
  );
  console.log(
    `Repaired migration history: moved 0042_${appliedAt0042} to ` +
      `${renumberedOnboarding.version}_${renumberedOnboarding.name}`,
  );
}

/** Dev DBs that applied avatar fields as 0047 before recruiter_pending_actions took that slot. */
async function repairRenumberedAvatarMigration(
  databaseService: DatabaseService,
  appliedMigrations: Map<string, string>,
): Promise<void> {
  const appliedAt0047 = appliedMigrations.get('0047');
  const avatarMigration = DATABASE_MIGRATIONS.find(
    (migration) => migration.name === 'add_user_avatar_fields',
  );

  if (
    appliedAt0047 !== 'add_user_avatar_fields' ||
    avatarMigration === undefined
  ) {
    return;
  }

  const targetVersion = avatarMigration.version;
  const appliedAtTarget = appliedMigrations.get(targetVersion);

  if (appliedAtTarget === undefined) {
    await databaseService.query(
      `
        UPDATE schema_migrations
        SET version = $1
        WHERE version = '0047'
          AND name = 'add_user_avatar_fields'
      `,
      [targetVersion],
    );
    appliedMigrations.set(targetVersion, 'add_user_avatar_fields');
  } else {
    await databaseService.query(
      `
        DELETE FROM schema_migrations
        WHERE version = '0047'
          AND name = 'add_user_avatar_fields'
      `,
    );
  }

  appliedMigrations.delete('0047');
  console.log(
    `Repaired migration history: moved 0047_add_user_avatar_fields to ${targetVersion}_add_user_avatar_fields`,
  );
}

/** Dev DBs that applied assign_demo_interviews_to_demo_hr as 0048 before feature-flags renumbered it to 0052. */
async function repairRenumberedDemoInterviewsMigration(
  databaseService: DatabaseService,
  appliedMigrations: Map<string, string>,
): Promise<void> {
  const appliedAt0048 = appliedMigrations.get('0048');
  const demoInterviewsMigration = DATABASE_MIGRATIONS.find(
    (migration) => migration.name === 'assign_demo_interviews_to_demo_hr',
  );

  if (
    appliedAt0048 !== 'assign_demo_interviews_to_demo_hr' ||
    demoInterviewsMigration === undefined
  ) {
    return;
  }

  const targetVersion = demoInterviewsMigration.version;
  const appliedAtTarget = appliedMigrations.get(targetVersion);

  if (appliedAtTarget === undefined) {
    await databaseService.query(
      `
        UPDATE schema_migrations
        SET version = $1
        WHERE version = '0048'
          AND name = 'assign_demo_interviews_to_demo_hr'
      `,
      [targetVersion],
    );
    appliedMigrations.set(targetVersion, 'assign_demo_interviews_to_demo_hr');
  } else {
    await databaseService.query(
      `
        DELETE FROM schema_migrations
        WHERE version = '0048'
          AND name = 'assign_demo_interviews_to_demo_hr'
      `,
    );
  }

  appliedMigrations.delete('0048');
  console.log(
    `Repaired migration history: moved 0048_assign_demo_interviews_to_demo_hr to ${targetVersion}_assign_demo_interviews_to_demo_hr`,
  );
}

export async function runMigrations(
  databaseService: DatabaseService,
): Promise<void> {
  await databaseService.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const appliedResult = await databaseService.query<{
    version: string;
    name: string;
  }>(
    `
      SELECT version, name
      FROM schema_migrations
    `,
  );
  const appliedMigrations = new Map(
    appliedResult.rows.map((row) => [row.version, row.name]),
  );

  const enableDevRepairs =
    process.env.NODE_ENV === 'development' ||
    process.env.ALLOW_DEV_DB_REPAIRS === 'true';

  if (enableDevRepairs) {
    await repairRenumberedOnboardingMigration(databaseService, appliedMigrations);
    await repairRenumberedAvatarMigration(databaseService, appliedMigrations);
    await repairRenumberedDemoInterviewsMigration(databaseService, appliedMigrations);
  }

  for (const migration of DATABASE_MIGRATIONS) {
    const appliedName = appliedMigrations.get(migration.version);
    if (appliedName !== undefined) {
      if (appliedName !== migration.name) {
        throw new Error(
          `Migration version collision for ${migration.version}: ` +
            `database has "${appliedName}", source has "${migration.name}"`,
        );
      }
      continue;
    }

    await databaseService.withClient(async (client) => {
      await client.query('BEGIN');
      try {
        for (const statement of migration.statements) {
          await client.query(statement);
        }

        await client.query(
          `
            INSERT INTO schema_migrations (version, name)
            VALUES ($1, $2)
          `,
          [migration.version, migration.name],
        );
        await client.query('COMMIT');
        console.log(
          `Applied migration ${migration.version}_${migration.name}`,
        );
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }
}
