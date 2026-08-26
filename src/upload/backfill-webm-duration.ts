import '../database/load-env';
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

import { MediaRemediationService } from './media-remediation.service';

interface ScriptOptions {
  dryRun: boolean;
  limit?: number;
  prefix?: string;
}

function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const prefixArg = args.find((arg) => arg.startsWith('--prefix='));
  const prefix = prefixArg ? prefixArg.split('=')[1] : undefined;

  return { dryRun, limit, prefix };
}

function createS3Client(): S3Client {
  const config: ConstructorParameters<typeof S3Client>[0] = {
    region: process.env.AWS_REGION ?? 'us-east-1',
  };

  if (process.env.S3_ENDPOINT) {
    config.endpoint = process.env.S3_ENDPOINT;
    config.forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'minioadmin',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'minioadmin',
    };
  }

  return new S3Client(config);
}

async function main(): Promise<void> {
  const options = parseArgs();
  const bucket = process.env.AWS_S3_BUCKET ?? 'interview-media';
  const rootPrefix = options.prefix ?? process.env.S3_PREFIX ?? 'uploads';

  const s3Client = createS3Client();
  const remediationService = new MediaRemediationService();

  console.log(`====================================================`);
  console.log(`[Backfill] Starting WebM Duration Backfill`);
  console.log(`  Bucket:  ${bucket}`);
  console.log(`  Prefix:  ${rootPrefix}`);
  console.log(
    `  Dry Run: ${options.dryRun ? 'YES (No changes will be written)' : 'NO (Live update)'}`,
  );
  if (options.limit) console.log(`  Limit:   ${options.limit} files`);
  console.log(`====================================================\n`);

  const startTime = Date.now();
  let continuationToken: string | undefined;
  const candidateKeys: string[] = [];

  // 1. Collect all matching S3 object keys
  process.stdout.write('Listing S3 objects...');
  do {
    const listRes = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: rootPrefix,
        ContinuationToken: continuationToken,
      }),
    );

    const keys = (listRes.Contents ?? [])
      .map((item) => item.Key)
      .filter((key): key is string =>
        Boolean(
          key &&
          key.endsWith('.webm') &&
          (key.includes('camera') || key.includes('screen')),
        ),
      );

    candidateKeys.push(...keys);
    process.stdout.write(` found ${candidateKeys.length}...`);

    if (options.limit && candidateKeys.length >= options.limit) {
      candidateKeys.length = options.limit;
      break;
    }

    continuationToken = listRes.IsTruncated
      ? listRes.NextContinuationToken
      : undefined;
  } while (continuationToken);

  console.log(`\nTotal WebM files to process: ${candidateKeys.length}\n`);

  if (candidateKeys.length === 0) {
    console.log('No WebM files found matching prefix.');
    return;
  }

  if (options.dryRun) {
    console.log('Files that would be processed:');
    candidateKeys.forEach((key, idx) => console.log(`  [${idx + 1}] ${key}`));
    console.log(
      '\n[Dry Run] Completed. Run without --dry-run to apply changes.',
    );
    return;
  }

  // 2. Process files
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < candidateKeys.length; i++) {
    const key = candidateKeys[i];
    const indexStr = `[${i + 1}/${candidateKeys.length}]`;

    try {
      const itemStart = Date.now();
      await remediationService.remediateWebm(s3Client, {
        mediaKey: key,
        bucket,
      });
      const elapsedMs = Date.now() - itemStart;
      succeeded++;
      console.log(`  ok   ${indexStr} ${key} (${elapsedMs}ms)`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  fail ${indexStr} ${key}: ${msg}`);
    }
  }

  const totalTimeSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n====================================================`);
  console.log(`[Backfill] Finished in ${totalTimeSec}s`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`====================================================`);
}

main().catch((err) => {
  console.error('Fatal error during backfill:', err);
  process.exit(1);
});
