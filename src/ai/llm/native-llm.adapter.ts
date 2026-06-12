import type { NativeProviderConfig } from './ai-env';

async function readErrorBody(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t.slice(0, 2000);
  } catch {
    return res.statusText;
  }
}

export async function completeJson(
  config: NativeProviderConfig,
  system: string,
  user: string,
): Promise<string> {
  const text = await completeTextInner(config, system, user, 'json');
  return text;
}

export async function completeText(
  config: NativeProviderConfig,
  system: string,
  user: string,
): Promise<string> {
  return completeTextInner(config, system, user, 'text');
}

async function completeTextInner(
  config: NativeProviderConfig,
  system: string,
  user: string,
  mode: 'json' | 'text',
): Promise<string> {
  if (config.kind === 'openai') {
    return completeOpenAi(config, system, user, mode);
  }
  if (config.kind === 'anthropic') {
    return completeAnthropic(config, system, user, mode);
  }
  return completeGoogle(config, system, user, mode);
}

async function completeOpenAi(
  config: NativeProviderConfig,
  system: string,
  user: string,
  mode: 'json' | 'text',
): Promise<string> {
  const baseUrl =
    process.env.OPENAI_BASE_URL?.trim() ?? 'https://api.openai.com/v1';
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: mode === 'json' ? 0.25 : 0.5,
  };
  if (mode === 'json') {
    body.response_format = { type: 'json_object' };
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`OpenAI error ${res.status}: ${await readErrorBody(res)}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const choices = data.choices as Array<Record<string, unknown>> | undefined;
  const message = choices?.[0]?.message as
    | Record<string, unknown>
    | undefined;
  const content = message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('OpenAI returned an empty response.');
  }
  return content;
}

async function completeAnthropic(
  config: NativeProviderConfig,
  system: string,
  user: string,
  mode: 'json' | 'text',
): Promise<string> {
  const url = 'https://api.anthropic.com/v1/messages';
  const userPayload =
    mode === 'json'
      ? `${user}\n\nReply with a single JSON object only, no markdown or explanation.`
      : user;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 8192,
      temperature: mode === 'json' ? 0.25 : 0.5,
      system,
      messages: [{ role: 'user', content: userPayload }],
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Anthropic error ${res.status}: ${await readErrorBody(res)}`,
    );
  }
  const data = (await res.json()) as Record<string, unknown>;
  const content = data.content as Array<Record<string, unknown>> | undefined;
  const first = content?.[0];
  const text =
    first?.type === 'text' && typeof first.text === 'string'
      ? first.text
      : undefined;
  if (!text?.trim()) {
    throw new Error('Anthropic returned an empty response.');
  }
  return text;
}

export function buildGoogleGenerateContentRequest(
  model: string,
  apiKey: string,
): { url: string; headers: Record<string, string> } {
  const base = 'https://generativelanguage.googleapis.com/v1beta';
  const encodedModel = encodeURIComponent(model);
  const url = `${base}/models/${encodedModel}:generateContent`;
  return {
    url,
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
  };
}

async function completeGoogle(
  config: NativeProviderConfig,
  system: string,
  user: string,
  mode: 'json' | 'text',
): Promise<string> {
  const { url, headers } = buildGoogleGenerateContentRequest(
    config.model,
    config.apiKey,
  );
  const generationConfig: Record<string, unknown> = {
    temperature: mode === 'json' ? 0.25 : 0.5,
  };
  if (mode === 'json') {
    generationConfig.responseMimeType = 'application/json';
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig,
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini error ${res.status}: ${await readErrorBody(res)}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
  const parts = candidates?.[0]?.content as Record<string, unknown> | undefined;
  const partsList = parts?.parts as Array<Record<string, unknown>> | undefined;
  const text = (partsList ?? [])
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }
  return text;
}
