const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

const MIGRATIONS_PATH = 'src/database/migrations.ts';

function parseMigrations(source, label) {
  const migrations = [];
  const pattern = /version:\s*'([^']+)'\s*,\s*name:\s*'([^']+)'/g;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    migrations.push({ version: match[1], name: match[2] });
  }

  if (migrations.length === 0) {
    throw new Error(`No migrations found in ${label}`);
  }

  return migrations;
}

function validateCurrent(migrations) {
  const versions = new Map();
  const names = new Map();

  for (const migration of migrations) {
    const existingName = versions.get(migration.version);
    if (existingName !== undefined) {
      throw new Error(
        `Duplicate migration version ${migration.version}: ` +
          `"${existingName}" and "${migration.name}"`,
      );
    }
    versions.set(migration.version, migration.name);

    const existingVersion = names.get(migration.name);
    if (existingVersion !== undefined) {
      throw new Error(
        `Duplicate migration name "${migration.name}": ` +
          `${existingVersion} and ${migration.version}`,
      );
    }
    names.set(migration.name, migration.version);
  }

  for (let index = 1; index < migrations.length; index += 1) {
    if (migrations[index - 1].version >= migrations[index].version) {
      throw new Error(
        `Migration versions are not strictly increasing: ` +
          `${migrations[index - 1].version} before ${migrations[index].version}`,
      );
    }
  }
}

function getArgument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function validateAgainstBase(current, base) {
  const currentByVersion = new Map(
    current.map((migration) => [migration.version, migration.name]),
  );
  const currentByName = new Map(
    current.map((migration) => [migration.name, migration.version]),
  );

  for (const migration of base) {
    const currentName = currentByVersion.get(migration.version);
    if (currentName !== undefined && currentName !== migration.name) {
      throw new Error(
        `Migration ${migration.version} changed relative to the target branch: ` +
          `"${migration.name}" became "${currentName}". ` +
          'Assign a new version instead.',
      );
    }

    if (currentName === undefined && !currentByName.has(migration.name)) {
      throw new Error(
        `Migration ${migration.version} "${migration.name}" from the target ` +
          'branch was removed.',
      );
    }
  }
}

try {
  const current = parseMigrations(
    readFileSync(MIGRATIONS_PATH, 'utf8'),
    MIGRATIONS_PATH,
  );
  validateCurrent(current);

  const baseRef = getArgument('--base-ref');
  if (baseRef) {
    const baseSource = execFileSync(
      'git',
      ['show', `${baseRef}:${MIGRATIONS_PATH}`],
      { encoding: 'utf8' },
    );
    validateAgainstBase(current, parseMigrations(baseSource, baseRef));
  }

  console.log(
    `Migration validation passed (${current.length} migrations` +
      `${baseRef ? `, compared with ${baseRef}` : ''})`,
  );
} catch (error) {
  console.error(`Migration validation failed: ${error.message}`);
  process.exit(1);
}
