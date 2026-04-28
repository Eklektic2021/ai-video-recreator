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

/**
 * Converts any image data URI to a proper PNG File using a canvas.
 * gpt-image-1 /edits requires actual PNG file buffers — passing JPEG or WebP
 * data with a renamed .png filename is rejected with 400.
 */
function toRgbaPng(dataUri: string, maxPx = 1920): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || maxPx;
      const h = img.naturalHeight || maxPx;
      const scale = Math.min(1, maxPx / Math.max(w, h));
      const cw = Math.round(w * scale);
      const ch = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return; }
      ctx.drawImage(img, 0, 0, cw, ch);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('canvas.toBlob returned null')); return; }
          resolve(new File([blob], 'reference.png', { type: 'image/png' }));
        },
        'image/png',
      );
    };
    img.onerror = () => reject(new Error('Failed to load reference image for PNG conversion'));
    img.src = dataUri;
  });
}

async function parseOrThrow(res: Response, label: string): Promise<void> {
  const body = await res.text().catch(() => '(response body unavailable)');
  console.error(`[generateWithDalle] ${label} ${res.status}:`, body);
  let msg = `OpenAI error ${res.status}`;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed?.error?.message) msg = parsed.error.message;
  } catch { /* body wasn't JSON */ }
  throw new Error(msg);
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
    // No reference images — standard generations endpoint (JSON body)
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
    if (!res.ok) await parseOrThrow(res, 'POST /v1/images/generations');
    return parseOpenAIImage(await res.json() as { data: { url?: string; b64_json?: string }[] });
  }

  // Reference images provided — edits endpoint requires multipart/form-data with a
  // real PNG file buffer.  Convert now, regardless of the original upload format.
  const pngFile = await toRgbaPng(refImages[0]);

  const finalPrompt = `Using the reference image as the character identity source (maintain exact face, hair, skin tone, and body — do not alter any physical feature), render only the following scene change: ${prompt}`;

  const form = new FormData();
  form.append('model', 'gpt-image-1');
  // Field name is "image[]" for gpt-image-1 multi-image edits; single image still works
  form.append('image[]', pngFile);
  form.append('prompt', finalPrompt);
  form.append('size', '1024x1024');
  form.append('n', '1');

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      // Do NOT set Content-Type — the browser must set it with the multipart boundary
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });
  if (!res.ok) await parseOrThrow(res, 'POST /v1/images/edits');
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
