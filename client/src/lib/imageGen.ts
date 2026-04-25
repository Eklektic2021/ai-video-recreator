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

// Strips the "data:image/...;base64," prefix to get the raw base64 string
function stripDataPrefix(dataUri: string): string {
  const idx = dataUri.indexOf(',');
  return idx !== -1 ? dataUri.slice(idx + 1) : dataUri;
}

export async function generateWithDalle(
  apiKey: string,
  prompt: string,
  refImages: string[] = []
): Promise<string> {
  const hasRefs = refImages.length > 0;
  const finalPrompt = hasRefs
    ? `Generate this scene maintaining exact consistency with the reference character(s): ${prompt}`
    : prompt;

  const body: Record<string, unknown> = {
    model: 'gpt-image-1',
    prompt: finalPrompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
  };

  if (hasRefs) {
    // Pass reference images as an array of base64 data URIs
    body.image = refImages.map((img) => ({
      type: 'image_url',
      image_url: { url: img },
    }));
  }

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `OpenAI error ${res.status}`);
  }

  const data = await res.json() as { data: { url?: string; b64_json?: string }[] };
  const item = data.data[0];
  if (item.url) return item.url;
  if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
  throw new Error('No image returned from OpenAI');
}

export async function generateWithFlux(
  apiKey: string,
  prompt: string,
  refImages: string[] = []
): Promise<string> {
  const body: Record<string, unknown> = { prompt };

  if (refImages.length > 0) {
    // Send first reference image; server routes to FLUX Redux Dev
    body.referenceImageBase64 = stripDataPrefix(refImages[0]);
  }

  const res = await fetch('/api/replicate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-replicate-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err?.error ?? `Proxy error ${res.status}`);
  }

  const data = await res.json() as { url: string };
  return data.url;
}
