import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import ffmpegPath from 'ffmpeg-static';

import { MediaRemediationMeta } from '../interview/interfaces/interview.interface';
import { InterviewService } from '../interview/interview.service';

export const FFMPEG_REMEDIATION_TIMEOUT_MS = 60_000;

export interface RemediationParams {
  interviewId?: string;
  questionIndex?: number;
  mediaType?: 'camera' | 'screen';
  mediaKey: string;
  bucket: string;
  versionNumber?: number;
  timeoutMs?: number;
}

@Injectable()
export class MediaRemediationService {
  private readonly logger = new Logger(MediaRemediationService.name);

  constructor(
    @Optional()
    @Inject(forwardRef(() => InterviewService))
    private readonly interviewService?: InterviewService,
  ) {}

  async remediateWebm(
    s3Client: S3Client,
    params: RemediationParams,
  ): Promise<void> {
    const {
      interviewId,
      questionIndex,
      mediaType,
      mediaKey,
      bucket,
      versionNumber,
    } = params;

    if (
      !mediaKey.endsWith('.webm') &&
      !mediaKey.includes('camera') &&
      !mediaKey.includes('screen')
    ) {
      return;
    }

    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `raw-${uniqueId}.webm`);
    const outputPath = path.join(tempDir, `fixed-${uniqueId}.webm`);

    await this.updateStatus(
      interviewId,
      questionIndex,
      mediaType,
      {
        status: 'processing',
        startedAt: new Date(),
      },
      versionNumber,
    );

    let fileStream: fs.ReadStream | undefined;

    try {
      // 1. Download from S3 to temp file
      const getRes = await s3Client.send(
        new GetObjectCommand({ Bucket: bucket, Key: mediaKey }),
      );

      if (!getRes.Body || !(getRes.Body instanceof Readable)) {
        throw new Error(
          `S3 object "${mediaKey}" returned empty or non-readable body.`,
        );
      }

      await pipeline(getRes.Body, fs.createWriteStream(inputPath));

      // 2. FFmpeg remuxing with timeout and SIGKILL
      await this.runFfmpegWithTimeout(
        inputPath,
        outputPath,
        params.timeoutMs ?? FFMPEG_REMEDIATION_TIMEOUT_MS,
      );

      // 3. Upload back to S3
      const stats = await fs.promises.stat(outputPath);
      fileStream = fs.createReadStream(outputPath);
      fileStream.on('error', () => {
        // Handled stream close / destruction
      });

      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: mediaKey,
          Body: fileStream,
          ContentType: 'video/webm',
          ContentLength: stats.size,
        }),
      );

      // 4. Update status in DB to 'completed'
      await this.updateStatus(
        interviewId,
        questionIndex,
        mediaType,
        {
          status: 'completed',
          completedAt: new Date(),
          fileSizeBytes: stats.size,
        },
        versionNumber,
      );

      this.logger.log(
        `[MediaRemediation] Fixed WebM duration for: ${mediaKey} (${stats.size} bytes)${interviewId ? ` in interview ${interviewId}` : ''}`,
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[MediaRemediation] Failed for ${mediaKey}: ${errorMsg}`,
        error instanceof Error ? error.stack : undefined,
      );

      // 5. Update status in DB to 'failed'
      await this.updateStatus(
        interviewId,
        questionIndex,
        mediaType,
        {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: errorMsg,
        },
        versionNumber,
      );
    } finally {
      // 6. Close read stream and clean up temp files
      fileStream?.destroy();
      await Promise.all([
        fs.promises.unlink(inputPath).catch(() => undefined),
        fs.promises.unlink(outputPath).catch(() => undefined),
      ]);
    }
  }

  private runFfmpegWithTimeout(
    inputPath: string,
    outputPath: string,
    timeoutMs: number = FFMPEG_REMEDIATION_TIMEOUT_MS,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const executable = ffmpegPath ?? 'ffmpeg';
      const ffmpeg = spawn(executable, [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        inputPath,
        '-c',
        'copy',
        outputPath,
      ]) as ChildProcessWithoutNullStreams;

      const finish = (handler: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        handler();
      };

      const timeoutId = setTimeout(() => {
        finish(() => {
          ffmpeg.kill('SIGKILL');
          reject(
            new Error(`ffmpeg remediation timed out after ${timeoutMs}ms`),
          );
        });
      }, timeoutMs);

      let stderr = '';
      ffmpeg.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      ffmpeg.on('close', (code) => {
        finish(() => {
          if (code === 0) {
            resolve();
          } else {
            reject(
              new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`),
            );
          }
        });
      });

      ffmpeg.on('error', (err) => {
        finish(() => reject(err));
      });
    });
  }

  private async updateStatus(
    interviewId: string | undefined,
    questionIndex: number | undefined,
    mediaType: 'camera' | 'screen' | undefined,
    meta: MediaRemediationMeta & { fileSizeBytes?: number },
    versionNumber?: number,
  ): Promise<void> {
    if (
      !this.interviewService ||
      !interviewId ||
      questionIndex === undefined ||
      !mediaType
    ) {
      return;
    }

    try {
      await this.interviewService.updateAnswerMediaRemediation(interviewId, {
        questionIndex,
        mediaType,
        status: meta.status,
        startedAt: meta.startedAt,
        completedAt: meta.completedAt,
        errorMessage: meta.errorMessage,
        fileSizeBytes: meta.fileSizeBytes,
        versionNumber,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to update media remediation status in DB for interview ${interviewId}: ${err}`,
      );
    }
  }
}
