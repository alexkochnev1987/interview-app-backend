import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import { PassThrough, Readable } from 'stream';

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { MockedFunction } from 'vitest';

import type { InterviewService } from '../interview/interview.service';
import { MediaRemediationService } from './media-remediation.service';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

const mockSpawn = spawn as MockedFunction<typeof spawn>;

function createMockFfmpegProcess(options: {
  stderr?: string;
  exitCode?: number;
  spawnError?: Error;
  hang?: boolean;
}) {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const proc = new EventEmitter() as ReturnType<typeof spawn>;
  const kill = vi.fn();
  Object.assign(proc, { stdin, stdout, stderr, kill });

  if (options.spawnError) {
    setImmediate(() => proc.emit('error', options.spawnError));
    return proc;
  }

  if (options.hang) {
    return proc;
  }

  setImmediate(() => {
    stdout.end();
    if (options.stderr) {
      stderr.end(Buffer.from(options.stderr));
    } else {
      stderr.end();
    }
    proc.emit('close', options.exitCode ?? 0);
  });

  return proc;
}

describe('MediaRemediationService', () => {
  let mockS3Client: { send: ReturnType<typeof vi.fn> };
  let mockInterviewService: {
    updateAnswerMediaRemediation: ReturnType<typeof vi.fn>;
  };
  let service: MediaRemediationService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    mockS3Client = {
      send: vi.fn(),
    };

    mockInterviewService = {
      updateAnswerMediaRemediation: vi.fn().mockResolvedValue({}),
    };

    service = new MediaRemediationService(
      mockInterviewService as unknown as InterviewService,
    );
  });

  it('skips remediation for non-video keys', async () => {
    await service.remediateWebm(mockS3Client as unknown as S3Client, {
      mediaKey: 'uploads/interview-1/avatar.jpg',
      bucket: 'test-bucket',
    });

    expect(mockS3Client.send).not.toHaveBeenCalled();
    expect(
      mockInterviewService.updateAnswerMediaRemediation,
    ).not.toHaveBeenCalled();
  });

  it('successfully remediates a webm file and updates DB status to completed', async () => {
    mockS3Client.send.mockImplementation((command) => {
      if (command instanceof GetObjectCommand) {
        return Promise.resolve({
          Body: Readable.from([Buffer.from('fake-webm-data')]),
        });
      }
      if (command instanceof PutObjectCommand) {
        return new Promise<object>((resolve) => {
          if (command.input.Body instanceof Readable) {
            command.input.Body.resume();
            command.input.Body.on('end', () => resolve({}));
          } else {
            resolve({});
          }
        });
      }
      return Promise.resolve({});
    });

    mockSpawn.mockImplementation((_cmd, args) => {
      const outputPath = args[args.length - 1] as string;
      fs.writeFileSync(outputPath, Buffer.from('fixed-webm-data'));
      return createMockFfmpegProcess({ exitCode: 0 });
    });

    await service.remediateWebm(mockS3Client as unknown as S3Client, {
      interviewId: 'interview-1',
      questionIndex: 0,
      mediaType: 'camera',
      mediaKey: 'uploads/interview-1/q0-camera.webm',
      bucket: 'test-bucket',
      versionNumber: 1,
    });

    expect(
      mockInterviewService.updateAnswerMediaRemediation,
    ).toHaveBeenCalledWith(
      'interview-1',
      expect.objectContaining({
        questionIndex: 0,
        mediaType: 'camera',
        status: 'processing',
      }),
    );

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.stringMatching(/ffmpeg(\.exe)?$/),
      expect.arrayContaining([
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-c',
        'copy',
      ]),
    );

    expect(mockS3Client.send).toHaveBeenCalledWith(
      expect.any(PutObjectCommand),
    );

    expect(
      mockInterviewService.updateAnswerMediaRemediation,
    ).toHaveBeenCalledWith(
      'interview-1',
      expect.objectContaining({
        questionIndex: 0,
        mediaType: 'camera',
        status: 'completed',
        fileSizeBytes: 15,
      }),
    );
  });

  it('handles ffmpeg error and updates DB status to failed, then rethrows', async () => {
    mockS3Client.send.mockImplementation((command) => {
      if (command instanceof GetObjectCommand) {
        return Promise.resolve({
          Body: Readable.from([Buffer.from('corrupt-webm-data')]),
        });
      }
      return Promise.resolve({});
    });

    mockSpawn.mockImplementation(() =>
      createMockFfmpegProcess({
        exitCode: 1,
        stderr: 'Invalid data found when processing input',
      }),
    );

    await expect(
      service.remediateWebm(mockS3Client as unknown as S3Client, {
        interviewId: 'interview-1',
        questionIndex: 1,
        mediaType: 'screen',
        mediaKey: 'uploads/interview-1/q1-screen.webm',
        bucket: 'test-bucket',
      }),
    ).rejects.toThrow('ffmpeg exited with code 1');

    expect(
      mockInterviewService.updateAnswerMediaRemediation,
    ).toHaveBeenCalledWith(
      'interview-1',
      expect.objectContaining({
        questionIndex: 1,
        mediaType: 'screen',
        status: 'failed',
        errorMessage: expect.stringContaining('Invalid data found'),
      }),
    );
  });

  it('handles ffmpeg timeout, sends SIGKILL and updates DB status to failed, then rethrows', async () => {
    let hangingProc: ReturnType<typeof createMockFfmpegProcess>;

    mockS3Client.send.mockImplementation((command) => {
      if (command instanceof GetObjectCommand) {
        return Promise.resolve({
          Body: Readable.from([Buffer.from('webm-data')]),
        });
      }
      return Promise.resolve({});
    });

    mockSpawn.mockImplementation(() => {
      hangingProc = createMockFfmpegProcess({ hang: true });
      return hangingProc;
    });

    await expect(
      service.remediateWebm(mockS3Client as unknown as S3Client, {
        interviewId: 'interview-1',
        questionIndex: 0,
        mediaType: 'camera',
        mediaKey: 'uploads/interview-1/q0-camera.webm',
        bucket: 'test-bucket',
        timeoutMs: 50,
      }),
    ).rejects.toThrow('timed out after 50ms');

    expect(hangingProc!.kill).toHaveBeenCalledWith('SIGKILL');
    expect(
      mockInterviewService.updateAnswerMediaRemediation,
    ).toHaveBeenCalledWith(
      'interview-1',
      expect.objectContaining({
        status: 'failed',
        errorMessage: expect.stringContaining('timed out after 50ms'),
      }),
    );
  });

  it('deduplicates parallel remediation calls for the same mediaKey', async () => {
    mockS3Client.send.mockImplementation((command) => {
      if (command instanceof GetObjectCommand) {
        return Promise.resolve({
          Body: Readable.from([Buffer.from('fake-webm-data')]),
        });
      }
      if (command instanceof PutObjectCommand) {
        return new Promise<object>((resolve) => {
          if (command.input.Body instanceof Readable) {
            command.input.Body.resume();
            command.input.Body.on('end', () => resolve({}));
          } else {
            resolve({});
          }
        });
      }
      return Promise.resolve({});
    });

    mockSpawn.mockImplementation((_cmd, args) => {
      const outputPath = args[args.length - 1] as string;
      fs.writeFileSync(outputPath, Buffer.from('fixed-webm-data'));
      return createMockFfmpegProcess({ exitCode: 0 });
    });

    const params: RemediationParams = {
      interviewId: 'interview-1',
      questionIndex: 0,
      mediaType: 'camera',
      mediaKey: 'uploads/interview-1/q0-camera.webm',
      bucket: 'test-bucket',
    };

    // Run 2 parallel remediations for the same key
    await Promise.all([
      service.remediateWebm(mockS3Client as unknown as S3Client, params),
      service.remediateWebm(mockS3Client as unknown as S3Client, params),
    ]);

    // mockSpawn should only be called once because the second call reused the in-flight Promise
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });
});
