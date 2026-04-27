export const KIE_KEY_STORAGE = 'kie_api_key';

export function getStoredKieKey(): string { return localStorage.getItem(KIE_KEY_STORAGE) ?? ''; }
export function saveKieKey(k: string): void { localStorage.setItem(KIE_KEY_STORAGE, k.trim()); }
export function clearKieKey(): void { localStorage.removeItem(KIE_KEY_STORAGE); }

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

async function throwOnError(res: Response, label: string): Promise<void> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `${label} error ${res.status}`);
  }
}

export async function generateWithRunway(
  imageSource: string,
  prompt: string,
  kieKey: string,
  duration = 5,
  aspectRatio = '16:9'
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/runway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-kie-key': kieKey },
    body: JSON.stringify({ prompt, imageBase64: base64, duration, aspectRatio }),
  });
  await throwOnError(res, 'Runway');
  return (await res.json() as { url: string }).url;
}

export async function generateWithKling(
  imageSource: string,
  prompt: string,
  kieKey: string,
  duration = 5,
  audioEnabled = false,
  aspectRatio = '16:9'
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/kling', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-kie-key': kieKey },
    body: JSON.stringify({ prompt, imageBase64: base64, duration, audioEnabled, aspectRatio }),
  });
  await throwOnError(res, 'Kling');
  return (await res.json() as { url: string }).url;
}

export async function generateWithVidu(
  imageSource: string,
  prompt: string,
  kieKey: string,
  duration = 4,
  aspectRatio = '16:9'
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/vidu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-kie-key': kieKey },
    body: JSON.stringify({ prompt, imageBase64: base64, duration, aspectRatio }),
  });
  await throwOnError(res, 'Vidu');
  return (await res.json() as { url: string }).url;
}

export async function generateWithVeo(
  imageSource: string,
  prompt: string,
  kieKey: string,
  duration = 8,
  enableAudio = false,
  aspectRatio = '16:9'
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/veo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-kie-key': kieKey },
    body: JSON.stringify({ prompt, imageBase64: base64, duration, enableAudio, aspectRatio }),
  });
  await throwOnError(res, 'Veo');
  return (await res.json() as { url: string }).url;
}
