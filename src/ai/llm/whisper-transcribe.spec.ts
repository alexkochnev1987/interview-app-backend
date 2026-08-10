import type { MockedFunction } from 'vitest';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { spawn } from 'child_process';
import {
  assertUnderWhisperLimit,
  extractAudioFromVideo,
  WHISPER_MAX_FILE_BYTES,
} from './whisper-transcribe';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

const mockSpawn = spawn as MockedFunction<typeof spawn>;

const EXPECTED_FFMPEG_ARGS = [
  '-hide_banner',
  '-loglevel',
  'error',
  '-i',
  'pipe:0',
  '-vn',
  '-ac',
  '1',
  '-ar',
  '16000',
  '-acodec',
  'libmp3lame',
  '-b:a',
  '32k',
  '-f',
  'mp3',
  'pipe:1',
];

function createMockFfmpegProcess(options: {
  stdout?: Buffer;
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
    if (options.stdout) {
      stdout.end(options.stdout);
    } else {
      stdout.end();
    }
    if (options.stderr) {
      stderr.end(Buffer.from(options.stderr));
    } else {
      stderr.end();
    }
    proc.emit('close', options.exitCode ?? 0);
  });

  return proc;
}

describe('extractAudioFromVideo', () => {
  beforeEach(() => {
    mockSpawn.mockReset();
    vi.useRealTimers();
  });

  it('returns mp3 buffer produced by ffmpeg', async () => {
    const mp3 = Buffer.from('fake-mp3-audio');
    mockSpawn.mockReturnValue(createMockFfmpegProcess({ stdout: mp3 }));

    const result = await extractAudioFromVideo(Buffer.from('video-webm'));

    expect(result).toEqual(mp3);
    expect(mockSpawn).toHaveBeenCalledWith('ffmpeg', EXPECTED_FFMPEG_ARGS, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  });

  it('throws when ffmpeg exits with an error', async () => {
    mockSpawn.mockReturnValue(
      createMockFfmpegProcess({
        exitCode: 1,
        stderr: 'decode error',
      }),
    );

    await expect(extractAudioFromVideo(Buffer.from('video'))).rejects.toThrow(
      'ffmpeg audio extraction failed (exit 1): decode error',
    );
  });

  it('throws when the recording has no audio track', async () => {
    mockSpawn.mockReturnValue(
      createMockFfmpegProcess({
        exitCode: 1,
        stderr: 'Output file #0 does not contain any stream',
      }),
    );

    await expect(extractAudioFromVideo(Buffer.from('video'))).rejects.toThrow(
      'No audio track in interview recording',
    );
  });

  it('throws when ffmpeg returns empty audio output', async () => {
    mockSpawn.mockReturnValue(
      createMockFfmpegProcess({ exitCode: 0, stdout: Buffer.alloc(0) }),
    );

    await expect(extractAudioFromVideo(Buffer.from('video'))).rejects.toThrow(
      'ffmpeg produced empty audio output',
    );
  });

  it('throws when extracted audio exceeds the Whisper upload limit', async () => {
    mockSpawn.mockReturnValue(
      createMockFfmpegProcess({
        exitCode: 0,
        stdout: Buffer.alloc(WHISPER_MAX_FILE_BYTES),
      }),
    );

    await expect(extractAudioFromVideo(Buffer.from('video'))).rejects.toThrow(
      'exceeds the Whisper upload limit',
    );
  });

  it('throws when ffmpeg is not available', async () => {
    mockSpawn.mockReturnValue(
      createMockFfmpegProcess({
        spawnError: new Error('ENOENT'),
      }),
    );

    await expect(extractAudioFromVideo(Buffer.from('video'))).rejects.toThrow(
      'Failed to run ffmpeg (is it installed?): ENOENT',
    );
  });

  it('kills ffmpeg when extraction hangs', async () => {
    vi.useFakeTimers();
    const proc = createMockFfmpegProcess({ hang: true });
    mockSpawn.mockReturnValue(proc);

    const promise = extractAudioFromVideo(Buffer.from('video'));
    vi.advanceTimersByTime(120_001);

    await expect(promise).rejects.toThrow(
      'ffmpeg audio extraction timed out after 120000ms',
    );
    expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('throws for an empty video buffer', async () => {
    await expect(extractAudioFromVideo(Buffer.alloc(0))).rejects.toThrow(
      'Cannot extract audio from an empty video buffer.',
    );
    expect(mockSpawn).not.toHaveBeenCalled();
  });
});

describe('assertUnderWhisperLimit', () => {
  it('allows audio below the Whisper limit', () => {
    expect(() =>
      assertUnderWhisperLimit(Buffer.alloc(WHISPER_MAX_FILE_BYTES - 1)),
    ).not.toThrow();
  });

  it('rejects audio at or above the Whisper limit', () => {
    expect(() =>
      assertUnderWhisperLimit(Buffer.alloc(WHISPER_MAX_FILE_BYTES)),
    ).toThrow('exceeds the Whisper upload limit');
  });
});
