import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import type { Readable } from 'stream';

export interface WhisperTranscriptionResult {
  text: string;
  language?: string;
}

export const WHISPER_MAX_FILE_BYTES = 26_214_400;
const FFMPEG_EXTRACTION_TIMEOUT_MS = 120_000;

const FFMPEG_AUDIO_ARGS = [
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
] as const;

let cachedS3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (cachedS3Client) {
    return cachedS3Client;
  }

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

  cachedS3Client = new S3Client(config);
  return cachedS3Client;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function downloadInterviewMedia(mediaKey: string): Promise<Buffer> {
  const bucket = process.env.AWS_S3_BUCKET ?? 'interview-media';
  const response = await getS3Client().send(
    new GetObjectCommand({ Bucket: bucket, Key: mediaKey }),
  );

  if (!response.Body) {
    throw new Error(`S3 object "${mediaKey}" returned an empty body.`);
  }

  return streamToBuffer(response.Body as Readable);
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 2000);
  } catch {
    return res.statusText;
  }
}

function toAudioFilename(videoFilename: string): string {
  const dotIndex = videoFilename.lastIndexOf('.');
  const baseName =
    dotIndex > 0 ? videoFilename.slice(0, dotIndex) : videoFilename;
  return `${baseName}.mp3`;
}

export function assertUnderWhisperLimit(audioBuffer: Buffer): void {
  if (audioBuffer.length >= WHISPER_MAX_FILE_BYTES) {
    throw new Error(
      `Extracted audio (${audioBuffer.length} bytes) exceeds the Whisper upload limit (${WHISPER_MAX_FILE_BYTES} bytes).`,
    );
  }
}

export async function extractAudioFromVideo(
  videoBuffer: Buffer,
): Promise<Buffer> {
  if (!videoBuffer.length) {
    throw new Error('Cannot extract audio from an empty video buffer.');
  }

  return new Promise((resolve, reject) => {
    const stderrChunks: Buffer[] = [];
    const stdoutChunks: Buffer[] = [];
    let settled = false;

    const ffmpeg = spawn('ffmpeg', [...FFMPEG_AUDIO_ARGS], {
      stdio: ['pipe', 'pipe', 'pipe'],
    }) as ChildProcessWithoutNullStreams;

    const finish = (handler: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      handler();
    };

    const timeout = setTimeout(() => {
      finish(() => {
        ffmpeg.kill('SIGKILL');
        reject(
          new Error(
            `ffmpeg audio extraction timed out after ${FFMPEG_EXTRACTION_TIMEOUT_MS}ms`,
          ),
        );
      });
    }, FFMPEG_EXTRACTION_TIMEOUT_MS);

    ffmpeg.stdin.on('error', () => {
      // Ignore EPIPE when ffmpeg exits before stdin is fully consumed.
    });

    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    ffmpeg.on('error', (err) => {
      finish(() => {
        reject(
          new Error(
            `Failed to run ffmpeg (is it installed?): ${err.message}`,
          ),
        );
      });
    });

    ffmpeg.on('close', (code) => {
      finish(() => {
        const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
        if (code !== 0) {
          if (
            /does not contain any stream|audio.*not found|no audio/i.test(
              stderr,
            )
          ) {
            reject(
              new Error(
                `No audio track in interview recording${stderr ? `: ${stderr}` : ''}`,
              ),
            );
            return;
          }
          reject(
            new Error(
              `ffmpeg audio extraction failed (exit ${code})${stderr ? `: ${stderr}` : ''}`,
            ),
          );
          return;
        }

        const audioBuffer = Buffer.concat(stdoutChunks);
        if (!audioBuffer.length) {
          reject(
            new Error(
              'ffmpeg produced empty audio output (recording may have no audio track).',
            ),
          );
          return;
        }

        try {
          assertUnderWhisperLimit(audioBuffer);
        } catch (error) {
          reject(error);
          return;
        }

        resolve(audioBuffer);
      });
    });

    ffmpeg.stdin.end(videoBuffer);
  });
}

export async function transcribeInterviewMedia(
  mediaKey: string,
): Promise<WhisperTranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured for Whisper.');
  }

  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() ??
    'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_WHISPER_MODEL?.trim() ?? 'whisper-1';

  const videoBuffer = await downloadInterviewMedia(mediaKey);
  const filename = mediaKey.split('/').pop() ?? 'recording.webm';
  const audioBuffer = await extractAudioFromVideo(videoBuffer);
  const audioFilename = toAudioFilename(filename);

  const form = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], {
    type: 'audio/mpeg',
  });
  form.append('file', blob, audioFilename);
  form.append('model', model);
  form.append('response_format', 'verbose_json');

  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    throw new Error(
      `Whisper error ${res.status}: ${await readErrorBody(res)}`,
    );
  }

  const data = (await res.json()) as {
    text?: string;
    language?: string;
  };

  if (typeof data.text !== 'string' || !data.text.trim()) {
    throw new Error('Whisper returned an empty transcript.');
  }

  return {
    text: data.text.trim(),
    language: data.language?.trim() || undefined,
  };
}
