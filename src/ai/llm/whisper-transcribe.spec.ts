import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { spawn } from 'child_process';
import { extractAudioFromVideo } from './whisper-transcribe';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

function createMockFfmpegProcess(options: {
  stdout?: Buffer;
  stderr?: string;
  exitCode?: number;
  spawnError?: Error;
}) {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const proc = new EventEmitter() as ReturnType<typeof spawn>;
  Object.assign(proc, { stdin, stdout, stderr, kill: jest.fn() });

  if (options.spawnError) {
    setImmediate(() => proc.emit('error', options.spawnError));
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
  });

  it('returns mp3 buffer produced by ffmpeg', async () => {
    const mp3 = Buffer.from('fake-mp3-audio');
    mockSpawn.mockReturnValue(createMockFfmpegProcess({ stdout: mp3 }));

    const result = await extractAudioFromVideo(Buffer.from('video-webm'));

    expect(result).toEqual(mp3);
    expect(mockSpawn).toHaveBeenCalledWith(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'webm',
        '-i',
        'pipe:0',
        '-vn',
        '-acodec',
        'libmp3lame',
        '-q:a',
        '4',
        '-f',
        'mp3',
        'pipe:1',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
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

  it('throws for an empty video buffer', async () => {
    await expect(extractAudioFromVideo(Buffer.alloc(0))).rejects.toThrow(
      'Cannot extract audio from an empty video buffer.',
    );
    expect(mockSpawn).not.toHaveBeenCalled();
  });
});
