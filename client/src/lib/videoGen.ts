export const RUNWAY_KEY_STORAGE  = 'runway_api_key';
export const FAL_KEY_STORAGE     = 'fal_api_key';
export const VIDU_KEY_STORAGE    = 'vidu_api_key';
export const GEMINI_KEY_STORAGE  = 'gemini_api_key';

export function getStoredRunwayKey(): string { return localStorage.getItem(RUNWAY_KEY_STORAGE) ?? ''; }
export function saveRunwayKey(k: string): void { localStorage.setItem(RUNWAY_KEY_STORAGE, k.trim()); }
export function clearRunwayKey(): void { localStorage.removeItem(RUNWAY_KEY_STORAGE); }

export function getStoredFalKey(): string { return localStorage.getItem(FAL_KEY_STORAGE) ?? ''; }
export function saveFalKey(k: string): void { localStorage.setItem(FAL_KEY_STORAGE, k.trim()); }
export function clearFalKey(): void { localStorage.removeItem(FAL_KEY_STORAGE); }

export function getStoredViduKey(): string { return localStorage.getItem(VIDU_KEY_STORAGE) ?? ''; }
export function saveViduKey(k: string): void { localStorage.setItem(VIDU_KEY_STORAGE, k.trim()); }
export function clearViduKey(): void { localStorage.removeItem(VIDU_KEY_STORAGE); }

export function getStoredGeminiKey(): string { return localStorage.getItem(GEMINI_KEY_STORAGE) ?? ''; }
export function saveGeminiKey(k: string): void { localStorage.setItem(GEMINI_KEY_STORAGE, k.trim()); }
export function clearGeminiKey(): void { localStorage.removeItem(GEMINI_KEY_STORAGE); }

// Converts a URL or data URI to a base64 data URI
export async function ensureBase64(imageSource: string): Promise<string> {
  if (imageSource.startsWith('data:')) return imageSource;
  const res = await fetch(imageSource);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function stripPrefix(dataUri: string): string {
  const idx = dataUri.indexOf(',');
  return idx !== -1 ? dataUri.slice(idx + 1) : dataUri;
}

async function throwOnError(res: Response, label: string): Promise<void> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `${label} error ${res.status}`);
  }
}

export async function generateWithRunway(
  imageSource: string,
  prompt: string,
  apiKey: string,
  duration = 5
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/runway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-runway-key': apiKey },
    body: JSON.stringify({ prompt, imageBase64: base64, duration }),
  });
  await throwOnError(res, 'Runway');
  const data = await res.json() as { url: string };
  return data.url;
}

export async function generateWithKling(
  imageSource: string,
  prompt: string,
  falKey: string,
  duration = 5,
  audioEnabled = false
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/kling', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-fal-key': falKey },
    // send full data URI — fal.ai accepts data: URIs in image_url
    body: JSON.stringify({ prompt, imageBase64: base64, duration, audioEnabled }),
  });
  await throwOnError(res, 'Kling');
  const data = await res.json() as { url: string };
  return data.url;
}

export async function generateWithVidu(
  imageSource: string,
  prompt: string,
  apiKey: string,
  duration = 4
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/vidu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-vidu-key': apiKey },
    body: JSON.stringify({ prompt, imageBase64: base64, duration }),
  });
  await throwOnError(res, 'Vidu');
  const data = await res.json() as { url: string };
  return data.url;
}

export async function generateWithVeo(
  imageSource: string,
  prompt: string,
  apiKey: string,
  duration = 8
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/veo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-gemini-key': apiKey },
    body: JSON.stringify({ prompt, imageBase64: stripPrefix(base64), duration }),
  });
  await throwOnError(res, 'Veo');
  const data = await res.json() as { url: string };
  return data.url;
}
