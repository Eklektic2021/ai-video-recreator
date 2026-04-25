export const OPENAI_KEY_STORAGE = 'maisuite_openai_key';
export const REPLICATE_KEY_STORAGE = 'maisuite_replicate_key';

export function getStoredOpenAIKey(): string {
  return localStorage.getItem(OPENAI_KEY_STORAGE) ?? '';
}
export function saveOpenAIKey(key: string): void {
  localStorage.setItem(OPENAI_KEY_STORAGE, key.trim());
}
export function clearOpenAIKey(): void {
  localStorage.removeItem(OPENAI_KEY_STORAGE);
}

export function getStoredReplicateKey(): string {
  return localStorage.getItem(REPLICATE_KEY_STORAGE) ?? '';
}
export function saveReplicateKey(key: string): void {
  localStorage.setItem(REPLICATE_KEY_STORAGE, key.trim());
}
export function clearReplicateKey(): void {
  localStorage.removeItem(REPLICATE_KEY_STORAGE);
}

export async function generateWithDalle(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `OpenAI error ${res.status}`);
  }
  const data = await res.json() as { data: { url: string }[] };
  return data.data[0].url;
}

export async function generateWithFlux(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(
    'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${apiKey}`,
      },
      body: JSON.stringify({ input: { prompt } }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(err?.detail ?? `Replicate error ${res.status}`);
  }
  const prediction = await res.json() as { id: string; status: string; output?: string[]; error?: string };

  if (prediction.status === 'succeeded' && prediction.output?.[0]) {
    return prediction.output[0];
  }

  const predId = prediction.id;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predId}`, {
      headers: { Authorization: `Token ${apiKey}` },
    });
    if (!pollRes.ok) throw new Error(`Replicate poll error ${pollRes.status}`);
    const poll = await pollRes.json() as { status: string; output?: string[]; error?: string };
    if (poll.status === 'succeeded' && poll.output?.[0]) return poll.output[0];
    if (poll.status === 'failed' || poll.status === 'canceled') {
      throw new Error(poll.error ?? 'Replicate prediction failed');
    }
  }
  throw new Error('Replicate prediction timed out');
}
