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

// Converts a base64 data URI to a File object for FormData
function base64ToFile(dataUri: string, filename: string): File {
  const comma = dataUri.indexOf(',');
  const header = dataUri.slice(0, comma);
  const b64 = dataUri.slice(comma + 1);
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}

function parseOpenAIImage(data: { data: { url?: string; b64_json?: string }[] }): string {
  const item = data.data[0];
  if (item?.url) return item.url;
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
  throw new Error('No image returned from OpenAI');
}

export async function generateWithDalle(
  apiKey: string,
  prompt: string,
  refImages: string[] = []
): Promise<string> {
  const hasRefs = refImages.length > 0;

  if (!hasRefs) {
    // No reference images — standard generations endpoint
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
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
    return parseOpenAIImage(await res.json() as { data: { url?: string; b64_json?: string }[] });
  }

  // Reference images provided — use edits endpoint with multipart FormData
  const finalPrompt = `STRICT IDENTITY LOCK — ABSOLUTE REQUIREMENT: Reproduce the character from the reference image with exact accuracy. The face must be a perfect replica: identical bone structure, eye shape and color, nose, lips, skin tone, and jawline. Hair must match exactly: same color, style, length, and texture. Clothing and accessories must match the reference precisely. Do NOT reinterpret, stylize, or approximate any facial feature. Now render this scene with that exact character: ${prompt}`;
  const form = new FormData();
  form.append('model', 'gpt-image-1');
  form.append('image', base64ToFile(refImages[0], 'reference.png'));
  form.append('prompt', finalPrompt);
  form.append('size', '1024x1024');
  form.append('n', '1');

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      // No Content-Type — browser sets it automatically with the correct multipart boundary
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `OpenAI error ${res.status}`);
  }
  return parseOpenAIImage(await res.json() as { data: { url?: string; b64_json?: string }[] });
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
