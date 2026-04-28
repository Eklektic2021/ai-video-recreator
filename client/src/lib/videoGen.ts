// ── Key storage ───────────────────────────────────────────────────────────────
export const KIE_KEY_STORAGE            = 'kie_api_key';
export const FAL_KEY_STORAGE            = 'fal_api_key';
export const GEMINI_KEY_STORAGE         = 'gemini_api_key';
export const REPLICATE_KEY_STORAGE      = 'replicate_api_key';
export const KLING_ACCESS_KEY_STORAGE   = 'kling_access_key';
export const KLING_SECRET_KEY_STORAGE   = 'kling_secret_key';

export function getStoredKieKey(): string           { return localStorage.getItem(KIE_KEY_STORAGE) ?? ''; }
export function saveKieKey(k: string): void         { localStorage.setItem(KIE_KEY_STORAGE, k.trim()); }
export function clearKieKey(): void                 { localStorage.removeItem(KIE_KEY_STORAGE); }

export function getStoredFalKey(): string           { return localStorage.getItem(FAL_KEY_STORAGE) ?? ''; }
export function saveFalKey(k: string): void         { localStorage.setItem(FAL_KEY_STORAGE, k.trim()); }
export function clearFalKey(): void                 { localStorage.removeItem(FAL_KEY_STORAGE); }

export function getStoredGeminiKey(): string        { return localStorage.getItem(GEMINI_KEY_STORAGE) ?? ''; }
export function saveGeminiKey(k: string): void      { localStorage.setItem(GEMINI_KEY_STORAGE, k.trim()); }
export function clearGeminiKey(): void              { localStorage.removeItem(GEMINI_KEY_STORAGE); }

export function getStoredVideoReplicateKey(): string     { return localStorage.getItem(REPLICATE_KEY_STORAGE) ?? ''; }
export function saveVideoReplicateKey(k: string): void   { localStorage.setItem(REPLICATE_KEY_STORAGE, k.trim()); }
export function clearVideoReplicateKey(): void           { localStorage.removeItem(REPLICATE_KEY_STORAGE); }

export function getStoredKlingAccessKey(): string  { return localStorage.getItem(KLING_ACCESS_KEY_STORAGE) ?? ''; }
export function saveKlingAccessKey(k: string): void { localStorage.setItem(KLING_ACCESS_KEY_STORAGE, k.trim()); }
export function clearKlingAccessKey(): void         { localStorage.removeItem(KLING_ACCESS_KEY_STORAGE); }

export function getStoredKlingSecretKey(): string  { return localStorage.getItem(KLING_SECRET_KEY_STORAGE) ?? ''; }
export function saveKlingSecretKey(k: string): void { localStorage.setItem(KLING_SECRET_KEY_STORAGE, k.trim()); }
export function clearKlingSecretKey(): void         { localStorage.removeItem(KLING_SECRET_KEY_STORAGE); }

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── KIE endpoints ─────────────────────────────────────────────────────────────
export async function generateWithRunwayAleph(
  imageSource: string,
  prompt: string,
  kieKey: string,
  aspectRatio = '16:9'
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/runway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-kie-key': kieKey },
    body: JSON.stringify({ prompt, imageBase64: base64, aspectRatio }),
  });
  await throwOnError(res, 'Runway Aleph');
  return (await res.json() as { url: string }).url;
}

export async function generateWithKling2(
  imageSource: string,
  prompt: string,
  kieKey: string,
  duration = 5,
  aspectRatio = '16:9'
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/kling', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-kie-key': kieKey },
    body: JSON.stringify({ prompt, imageBase64: base64, duration, aspectRatio }),
  });
  await throwOnError(res, 'Kling 2.1');
  return (await res.json() as { url: string }).url;
}

export async function generateWithKling3AudioKie(
  imageSource: string,
  prompt: string,
  kieKey: string,
  duration = 5,
  aspectRatio = '16:9'
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/kling-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-kie-key': kieKey },
    body: JSON.stringify({ prompt, imageBase64: base64, duration, aspectRatio }),
  });
  await throwOnError(res, 'Kling 3.0');
  return (await res.json() as { url: string }).url;
}

export async function generateWithKling3AudioFal(
  imageSource: string,
  prompt: string,
  falKey: string,
  duration = 5,
  aspectRatio = '16:9'
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/fal-kling-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-fal-key': falKey },
    body: JSON.stringify({ prompt, imageBase64: base64, duration, aspectRatio }),
  });
  await throwOnError(res, 'Kling 3.0');
  return (await res.json() as { url: string }).url;
}

export async function generateWithVeoFast(
  imageSource: string,
  prompt: string,
  kieKey: string,
  aspectRatio = '16:9'
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/veo-fast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-kie-key': kieKey },
    body: JSON.stringify({ prompt, imageBase64: base64, aspectRatio }),
  });
  await throwOnError(res, 'Veo 3.1 Fast');
  return (await res.json() as { url: string }).url;
}

export async function generateWithVeoFull(
  imageSource: string,
  prompt: string,
  kieKey: string,
  aspectRatio = '16:9'
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/veo-full', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-kie-key': kieKey },
    body: JSON.stringify({ prompt, imageBase64: base64, aspectRatio }),
  });
  await throwOnError(res, 'Veo 3.1');
  return (await res.json() as { url: string }).url;
}

export async function generateWithVeoDirect(
  imageSource: string,
  prompt: string,
  geminiKey: string,
  aspectRatio = '16:9'
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/veo-gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-gemini-key': geminiKey },
    body: JSON.stringify({ prompt, imageBase64: base64, aspectRatio }),
  });
  await throwOnError(res, 'Veo 3.1 Direct');
  return (await res.json() as { url: string }).url;
}

export async function generateWithFluxFal(
  imageSource: string,
  prompt: string,
  falKey: string
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/fal-flux', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-fal-key': falKey },
    body: JSON.stringify({ prompt, imageBase64: base64 }),
  });
  await throwOnError(res, 'FLUX Dev');
  return (await res.json() as { url: string }).url;
}

export async function generateWithFluxReplicate(
  imageSource: string,
  prompt: string,
  replicateKey: string
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/replicate-flux', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-replicate-key': replicateKey },
    body: JSON.stringify({ prompt, imageBase64: base64 }),
  });
  await throwOnError(res, 'FLUX Dev');
  return (await res.json() as { url: string }).url;
}

export async function generateWithKling2Native(
  imageSource: string,
  prompt: string,
  klingAccessKey: string,
  klingSecretKey: string,
  duration = 5,
  aspectRatio = '16:9'
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/kling-native', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-kling-access-key': klingAccessKey,
      'x-kling-secret-key': klingSecretKey,
    },
    body: JSON.stringify({ prompt, imageBase64: base64, duration, aspectRatio }),
  });
  await throwOnError(res, 'Kling 2.1 Native');
  return (await res.json() as { url: string }).url;
}

export async function generateWithKling3AudioNative(
  imageSource: string,
  prompt: string,
  klingAccessKey: string,
  klingSecretKey: string,
  duration = 5,
  aspectRatio = '16:9'
): Promise<string> {
  const base64 = await ensureBase64(imageSource);
  const res = await fetch('/api/kling-audio-native', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-kling-access-key': klingAccessKey,
      'x-kling-secret-key': klingSecretKey,
    },
    body: JSON.stringify({ prompt, imageBase64: base64, duration, aspectRatio }),
  });
  await throwOnError(res, 'Kling 3.0 Native');
  return (await res.json() as { url: string }).url;
}
