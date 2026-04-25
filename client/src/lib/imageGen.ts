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
  const res = await fetch('/api/replicate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-replicate-key': apiKey,
    },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err?.error ?? `Proxy error ${res.status}`);
  }
  const data = await res.json() as { url: string };
  return data.url;
}
