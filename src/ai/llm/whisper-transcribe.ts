import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Readable } from 'stream';

export interface WhisperTranscriptionResult {
  text: string;
  language?: string;
}

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

async function downloadInterviewMedia(
  mediaKey: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const bucket = process.env.AWS_S3_BUCKET ?? 'interview-media';
  const response = await getS3Client().send(
    new GetObjectCommand({ Bucket: bucket, Key: mediaKey }),
  );

  if (!response.Body) {
    throw new Error(`S3 object "${mediaKey}" returned an empty body.`);
  }

  const buffer = await streamToBuffer(response.Body as Readable);
  return {
    buffer,
    contentType: response.ContentType ?? 'video/webm',
  };
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 2000);
  } catch {
    return res.statusText;
  }
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

  const { buffer, contentType } = await downloadInterviewMedia(mediaKey);
  const filename = mediaKey.split('/').pop() ?? 'recording.webm';

  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: contentType });
  form.append('file', blob, filename);
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
