import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHmac, randomBytes } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '20mb' }));

// ── Temporary image store ─────────────────────────────────────────────────────
// Replicate requires publicly accessible URLs — we store base64 images here
// briefly so Replicate can fetch them, then expire them after 10 minutes.
const tempImages = new Map<string, { data: Buffer; mime: string; expiry: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of tempImages) if (v.expiry < now) tempImages.delete(k);
}, 5 * 60 * 1000).unref();

app.get('/api/temp-image/:id', (req, res) => {
  const entry = tempImages.get(req.params.id);
  if (!entry || entry.expiry < Date.now()) { res.status(404).end(); return; }
  res.setHeader('Content-Type', entry.mime);
  res.setHeader('Cache-Control', 'public, max-age=600');
  res.send(entry.data);
});

// ── Shared helpers ─────────────────────────────────────────────────────────────

async function pollUntilDone(
  pollFn: () => Promise<{ status: string; url?: string; error?: string }>,
  maxAttempts = 90,
  delayMs = 5000
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    const result = await pollFn();
    if (result.status === 'done') {
      if (result.url) return result.url;
      throw new Error('Completed but no URL returned');
    }
    if (result.status === 'failed') throw new Error(result.error ?? 'Generation failed');
  }
  throw new Error('Request timed out after polling');
}

// Character Lock — prepended to every video prompt
function wrapPrompt(raw: string): string {
  return (
    '⚠ ABSOLUTE IDENTITY LOCK — NON-NEGOTIABLE: Every frame MUST feature the EXACT same person shown in the reference image — the identical individual, not a look-alike or substitute.\n' +
    'SAME FACE: Reproduce the exact facial structure — identical bone structure, eye shape + color, nose shape + bridge, lip shape + fullness, skin tone, cheekbones, jawline, brow thickness + arch. Any facial variation is prohibited.\n' +
    'SAME HAIR: Exact hair color, length, style, texture, parting, and accessories — zero changes allowed.\n' +
    'SAME BODY: Identical build, height proportions, skin tone throughout every frame. Same clothing, jewelry, and accessories as the reference.\n' +
    'SAME PERSON — NO SUBSTITUTION: Do not cast, render, or infer a different person. This is the only character permitted in this scene.\n' +
    'MOTION REQUIRED: The character must move naturally and fluidly — no frozen frames, no static poses, no slideshow transitions.\n' +
    'FRAME CONSISTENCY: Character appearance must be 100% identical across all frames — zero drift, morphing, or gradual change between frames.\n\n' +
    `${raw}\n\n` +
    'ABSOLUTE NEGATIVES: different person, wrong face, face substitution, wrong skin tone, wrong hair color, wrong hair style, face drift, character morph, extra characters, missing characters, static image, frozen frame, no motion, slideshow, watermark, blurry faces.'
  );
}

const SAFETY_KEYWORDS = [
  'content policy', 'safety', 'flagged', 'violat', 'moderat',
  'inappropriate', 'nsfw', 'harmful', 'blocked', 'prohibited',
];
function isSafetyError(message: string): boolean {
  return SAFETY_KEYWORDS.some((kw) => message.toLowerCase().includes(kw));
}

const SANITIZE_MAP: [RegExp, string][] = [
  [/\bblood(?:y|ied)?\b/gi, 'crimson liquid'],
  [/\bgore\b/gi, 'intense imagery'],
  [/\bviolen(?:ce|t)\b/gi, 'intense'],
  [/\bnude\b/gi, 'bare'],
  [/\bnaked\b/gi, 'unclothed'],
  [/\bweapon\b/gi, 'object'],
  [/\b(?:gun|pistol|rifle)\b/gi, 'device'],
  [/\bexplosion\b/gi, 'burst of light'],
  [/\bbomb\b/gi, 'object'],
  [/\bdrug(?:s)?\b/gi, 'substance'],
  [/\bterror(?:ist)?\b/gi, 'figure'],
  [/\bstab(?:bing|bed|s)?\b/gi, 'strike'],
];
export function sanitizePrompt(prompt: string): string {
  let result = prompt;
  for (const [pattern, replacement] of SANITIZE_MAP) result = result.replace(pattern, replacement);
  return result;
}
function safetyMessage(provider: string): string {
  return `This scene's prompt was flagged by ${provider}'s safety system. Please edit the scene description and try again.`;
}

// ── KIE shared helpers ─────────────────────────────────────────────────────────

type KieCreateBody = Record<string, unknown>;

interface KieCreateResponse {
  code?: number;
  message?: string;
  data?: { taskId?: string; task_id?: string; id?: string } & Record<string, unknown>;
  taskId?: string;
  task_id?: string;
}

interface KiePollResponse {
  code?: number;
  message?: string;
  data?: {
    status?: string;
    videoUrl?: string;
    video_url?: string;
    resultVideoUrl?: string;
    result_video_url?: string;
    outputVideoUrl?: string;
    failReason?: string;
    fail_reason?: string;
  };
}

async function kieCreate(
  url: string,
  headers: Record<string, string>,
  body: KieCreateBody,
  label: string
): Promise<string> {
  const reqBody = JSON.stringify(body);
  console.log(`[${label}] → POST ${url} | keys: ${Object.keys(body).join(',')} | body.length: ${reqBody.length}`);

  const res = await fetch(url, { method: 'POST', headers, body: reqBody });
  const raw = await res.text();
  console.log(`[${label}] ← status=${res.status} body=${raw.slice(0, 800)}`);

  let parsed: KieCreateResponse;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error(`${label} error ${res.status}: ${raw.slice(0, 200)}`); }

  if (!res.ok) {
    const msg = parsed.message ?? (parsed.data?.failReason as string | undefined) ?? `${label} HTTP ${res.status}`;
    throw new Error(msg);
  }

  const code = parsed.code;
  // KIE uses code=0 or code=200 for success. Non-zero codes are errors only if an error message is present.
  const isErrorCode = code !== undefined && code !== 0 && code !== 200;
  if (isErrorCode) {
    const msg = parsed.message ?? (parsed.data?.failReason as string | undefined);
    if (msg) throw new Error(msg);
    console.warn(`[${label}] unusual code=${code} with no error message, continuing...`);
  }

  const taskId =
    parsed.data?.taskId ?? parsed.data?.task_id ?? parsed.data?.id ??
    parsed.taskId ?? parsed.task_id;
  if (!taskId) throw new Error(`${label} no task ID in response: ${raw.slice(0, 500)}`);

  console.log(`[${label}] taskId=${taskId}`);
  return String(taskId);
}

function kiePoll(
  queryUrl: string,
  headers: Record<string, string>,
  label: string
): () => Promise<{ status: string; url?: string; error?: string }> {
  return async () => {
    const r = await fetch(queryUrl, { headers });
    const raw = await r.text();
    let body: KiePollResponse;
    try { body = JSON.parse(raw); } catch { return { status: 'pending' }; }

    const data = body.data ?? {};
    const st = (data.status ?? '').toLowerCase();
    const url = data.videoUrl ?? data.video_url ?? data.resultVideoUrl ?? data.result_video_url ?? data.outputVideoUrl;
    console.log(`[${label}] poll status=${st} url=${url ?? '(none)'}`);

    if (st === 'succeeded' || st === 'completed' || st === 'success' || st === 'succeed') return { status: 'done', url };
    if (st === 'failed' || st === 'error') {
      return { status: 'failed', error: data.failReason ?? data.fail_reason ?? body.message ?? `${label} task failed` };
    }
    return { status: 'pending' };
  };
}

// ── fal.ai shared helpers ──────────────────────────────────────────────────────

async function falSubmit(
  endpoint: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  label: string
): Promise<string> {
  const res = await fetch(`https://queue.fal.run/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  console.log(`[${label}/fal] submit status=${res.status} body=${raw.slice(0, 300)}`);

  let parsed: { request_id?: string; error?: string; detail?: string };
  try { parsed = JSON.parse(raw); }
  catch { throw new Error(`${label} fal.ai error ${res.status}: ${raw.slice(0, 200)}`); }

  if (!res.ok) throw new Error(parsed.detail ?? parsed.error ?? `${label} fal.ai error ${res.status}`);
  const reqId = parsed.request_id;
  if (!reqId) throw new Error(`${label} fal.ai did not return request_id`);

  console.log(`[${label}/fal] request_id=${reqId}`);
  return reqId;
}

function falPoll<T>(
  endpoint: string,
  requestId: string,
  headers: Record<string, string>,
  label: string,
  extractUrl: (data: T) => string | undefined
): () => Promise<{ status: string; url?: string; error?: string }> {
  return async () => {
    const sr = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}/status`, { headers });
    const s = await sr.json() as { status: string; error?: string };
    console.log(`[${label}/fal] poll status=${s.status}`);

    if (s.status === 'COMPLETED') {
      const rr = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}`, { headers });
      const data = await rr.json() as T;
      return { status: 'done', url: extractUrl(data) };
    }
    if (s.status === 'FAILED' || s.status === 'ERROR') {
      return { status: 'failed', error: s.error ?? `${label} failed` };
    }
    return { status: 'pending' };
  };
}

// ── Kling native API helpers ──────────────────────────────────────────────────

function generateKlingJWT(accessKey: string, secretKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: accessKey,
    exp: now + 1800,
    nbf: now,
    iat: now,
    jti: randomBytes(16).toString('hex'),
  })).toString('base64url');
  const sig = createHmac('sha256', secretKey)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${sig}`;
}

async function klingNativeCreate(
  accessKey: string,
  secretKey: string,
  body: Record<string, unknown>,
  label: string
): Promise<string> {
  const jwt = generateKlingJWT(accessKey, secretKey);
  const reqBody = JSON.stringify(body);
  console.log(`[${label}/native] → POST https://api-singapore.klingai.com/v1/videos/image2video | model: ${body.model_name} | prompt.length: ${String(body.prompt ?? '').length}`);
  const res = await fetch('https://api-singapore.klingai.com/v1/videos/image2video', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: reqBody,
  });
  const raw = await res.text();
  console.log(`[${label}/native] ← status=${res.status} body=${raw.slice(0, 500)}`);

  let parsed: { code?: number; message?: string; data?: { task_id?: string } };
  try { parsed = JSON.parse(raw); }
  catch { throw new Error(`${label} native error ${res.status}: ${raw.slice(0, 200)}`); }

  if (!res.ok || (parsed.code !== undefined && parsed.code !== 0)) {
    throw new Error(parsed.message ?? `${label} native error ${res.status}`);
  }
  const taskId = parsed.data?.task_id;
  if (!taskId) throw new Error(`${label} native no task_id. Response: ${raw.slice(0, 300)}`);
  console.log(`[${label}/native] taskId=${taskId}`);
  return taskId;
}

function klingNativePoll(
  taskId: string,
  accessKey: string,
  secretKey: string,
  label: string
): () => Promise<{ status: string; url?: string; error?: string }> {
  return async () => {
    const jwt = generateKlingJWT(accessKey, secretKey);
    const r = await fetch(`https://api-singapore.klingai.com/v1/videos/image2video/${taskId}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const raw = await r.text();
    let body: { code?: number; data?: { task_status?: string; task_result?: { videos?: { url: string }[] }; task_status_msg?: string } };
    try { body = JSON.parse(raw); } catch { return { status: 'pending' }; }

    const data = body.data ?? {};
    const st = (data.task_status ?? '').toLowerCase();
    const url = data.task_result?.videos?.[0]?.url;
    console.log(`[${label}/native] poll status=${st} url=${url ?? '(none)'}`);

    if (st === 'succeed' || st === 'succeeded' || st === 'completed') return { status: 'done', url };
    if (st === 'failed' || st === 'error') {
      return { status: 'failed', error: data.task_status_msg ?? `${label} native task failed` };
    }
    return { status: 'pending' };
  };
}

// ── /api/replicate — image gen proxy (used by imageGen.ts) ───────────────────
app.post('/api/replicate', async (req, res) => {
  const apiKey = req.headers['x-replicate-key'];
  if (!apiKey || typeof apiKey !== 'string') {
    res.status(400).json({ error: 'Missing x-replicate-key header' }); return;
  }

  const { prompt, referenceImageBase64 } = req.body as { prompt?: string; referenceImageBase64?: string };
  if (!prompt) { res.status(400).json({ error: 'Missing prompt' }); return; }

  const useRedux = !!referenceImageBase64;
  const modelUrl = useRedux
    ? 'https://api.replicate.com/v1/models/black-forest-labs/flux-redux-dev/predictions'
    : 'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions';

  // Replicate requires a public URL — store the base64 image server-side and
  // build a URL that Replicate can fetch back from us.
  let input: Record<string, unknown>;
  if (useRedux && referenceImageBase64) {
    const match = referenceImageBase64.match(/^data:([^;,]+);base64,(.+)$/s);
    const mime = match?.[1] ?? 'image/png';
    const b64 = match?.[2] ?? referenceImageBase64;
    const buf = Buffer.from(b64, 'base64');
    const id = randomBytes(16).toString('hex');
    tempImages.set(id, { data: buf, mime, expiry: Date.now() + 10 * 60 * 1000 });
    const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() ?? req.protocol;
    const host = req.headers.host ?? 'localhost:3001';
    const publicUrl = `${proto}://${host}/api/temp-image/${id}`;
    console.log(`[Replicate/FLUX-Redux] stored temp image id=${id} mime=${mime} size=${buf.length} publicUrl=${publicUrl}`);
    input = { redux_image: publicUrl, prompt };
  } else {
    input = { prompt };
  }

  try {
    const createRes = await fetch(modelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Token ${apiKey}` },
      body: JSON.stringify({ input }),
    });
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as { detail?: string };
      res.status(createRes.status).json({ error: err.detail ?? `Replicate error ${createRes.status}` }); return;
    }

    const prediction = await createRes.json() as { id: string; status: string; output?: string[] | string; error?: string };
    const extractUrl = (o: string[] | string | undefined) => Array.isArray(o) ? o[0] : o ?? null;

    if (prediction.status === 'succeeded' && extractUrl(prediction.output)) {
      res.json({ url: extractUrl(prediction.output) }); return;
    }

    const predId = prediction.id;
    const url = await pollUntilDone(async () => {
      const r = await fetch(`https://api.replicate.com/v1/predictions/${predId}`, {
        headers: { Authorization: `Token ${apiKey}` },
      });
      const p = await r.json() as { status: string; output?: string[] | string; error?: string };
      if (p.status === 'succeeded') return { status: 'done', url: extractUrl(p.output) ?? undefined };
      if (p.status === 'failed' || p.status === 'canceled') return { status: 'failed', error: p.error };
      return { status: 'pending' };
    }, 90, 2000);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── /api/runway — Runway Aleph via KIE ───────────────────────────────────────
app.post('/api/runway', async (req, res) => {
  const kieKey = req.headers['x-kie-key'];
  if (!kieKey || typeof kieKey !== 'string') {
    res.status(400).json({ error: 'Missing x-kie-key header' }); return;
  }

  const { prompt, imageBase64, aspectRatio = '16:9' } = req.body as {
    prompt?: string; imageBase64?: string; aspectRatio?: string;
  };
  if (!prompt || !imageBase64) { res.status(400).json({ error: 'Missing prompt or imageBase64' }); return; }

  const kieHdr = { Authorization: `Bearer ${kieKey}`, 'Content-Type': 'application/json' };

  async function attemptRunway(p: string): Promise<string> {
    const taskId = await kieCreate(
      'https://api.kie.ai/api/v1/runway/generate',
      kieHdr,
      { prompt: p, imageUrl: imageBase64, model: 'runway-aleph', aspectRatio, waterMark: false },
      'Runway'
    );
    return pollUntilDone(kiePoll(`https://api.kie.ai/api/v1/runway/query/${taskId}`, kieHdr, 'Runway'));
  }

  try {
    let url: string;
    try { url = await attemptRunway(wrapPrompt(prompt)); }
    catch (e) {
      if (e instanceof Error && isSafetyError(e.message)) {
        try { url = await attemptRunway(wrapPrompt(sanitizePrompt(prompt))); }
        catch { res.status(400).json({ error: safetyMessage('Runway') }); return; }
      } else { throw e; }
    }
    res.json({ url });
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ── /api/kling — Kling 2.1 via KIE ──────────────────────────────────────────
app.post('/api/kling', async (req, res) => {
  const kieKey = req.headers['x-kie-key'];
  if (!kieKey || typeof kieKey !== 'string') {
    res.status(400).json({ error: 'Missing x-kie-key header' }); return;
  }

  const { prompt, imageBase64, duration = 5, aspectRatio = '16:9' } = req.body as {
    prompt?: string; imageBase64?: string; duration?: number; aspectRatio?: string;
  };
  if (!prompt || !imageBase64) { res.status(400).json({ error: 'Missing prompt or imageBase64' }); return; }

  const kieHdr = { Authorization: `Bearer ${kieKey}`, 'Content-Type': 'application/json' };

  async function attemptKling(p: string): Promise<string> {
    const taskId = await kieCreate(
      'https://api.kie.ai/api/v1/kling/v2.1/image-to-video',
      kieHdr,
      { prompt: p, imageUrl: imageBase64, duration: String(duration), aspectRatio, modelName: 'kling-v2.1' },
      'Kling'
    );
    return pollUntilDone(kiePoll(`https://api.kie.ai/api/v1/kling/query/${taskId}`, kieHdr, 'Kling'));
  }

  try {
    let url: string;
    try { url = await attemptKling(wrapPrompt(prompt)); }
    catch (e) {
      if (e instanceof Error && isSafetyError(e.message)) {
        try { url = await attemptKling(wrapPrompt(sanitizePrompt(prompt))); }
        catch { res.status(400).json({ error: safetyMessage('Kling') }); return; }
      } else { throw e; }
    }
    res.json({ url });
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ── /api/kling-audio — Kling 3.0 with audio via KIE ─────────────────────────
app.post('/api/kling-audio', async (req, res) => {
  const kieKey = req.headers['x-kie-key'];
  if (!kieKey || typeof kieKey !== 'string') {
    res.status(400).json({ error: 'Missing x-kie-key header' }); return;
  }

  const { prompt, imageBase64, duration = 5, aspectRatio = '16:9' } = req.body as {
    prompt?: string; imageBase64?: string; duration?: number; aspectRatio?: string;
  };
  if (!prompt || !imageBase64) { res.status(400).json({ error: 'Missing prompt or imageBase64' }); return; }

  const kieHdr = { Authorization: `Bearer ${kieKey}`, 'Content-Type': 'application/json' };

  async function attemptKling3(p: string): Promise<string> {
    const taskId = await kieCreate(
      'https://api.kie.ai/api/v1/kling/v3/image-to-video',
      kieHdr,
      { prompt: p, imageUrl: imageBase64, duration: String(duration), aspectRatio, motion_has_audio: true },
      'Kling3'
    );
    return pollUntilDone(kiePoll(`https://api.kie.ai/api/v1/kling/query/${taskId}`, kieHdr, 'Kling3'));
  }

  try {
    let url: string;
    try { url = await attemptKling3(wrapPrompt(prompt)); }
    catch (e) {
      if (e instanceof Error && isSafetyError(e.message)) {
        try { url = await attemptKling3(wrapPrompt(sanitizePrompt(prompt))); }
        catch { res.status(400).json({ error: safetyMessage('Kling 3.0') }); return; }
      } else { throw e; }
    }
    res.json({ url });
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ── /api/veo-fast — Veo 3.1 Fast via KIE ────────────────────────────────────
app.post('/api/veo-fast', async (req, res) => {
  const kieKey = req.headers['x-kie-key'];
  if (!kieKey || typeof kieKey !== 'string') {
    res.status(400).json({ error: 'Missing x-kie-key header' }); return;
  }

  const { prompt, imageBase64, aspectRatio = '16:9' } = req.body as {
    prompt?: string; imageBase64?: string; aspectRatio?: string;
  };
  if (!prompt || !imageBase64) { res.status(400).json({ error: 'Missing prompt or imageBase64' }); return; }

  const kieHdr = { Authorization: `Bearer ${kieKey}`, 'Content-Type': 'application/json' };

  async function attemptVeoFast(p: string): Promise<string> {
    // Strip data URI prefix — KIE Veo expects raw base64
    const rawBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const body = { prompt: p, imageUrl: rawBase64, model: 'veo3_fast', aspectRatio, aspect_ratio: aspectRatio };
    console.log(`[VeoFast] request → model: veo3_fast, aspectRatio: ${aspectRatio}, imageBase64.length: ${rawBase64.length}, prompt.length: ${p.length}`);
    const taskId = await kieCreate(
      'https://api.kie.ai/api/v1/veo/generate',
      kieHdr,
      body,
      'VeoFast'
    );
    return pollUntilDone(kiePoll(`https://api.kie.ai/api/v1/veo/query/${taskId}`, kieHdr, 'VeoFast'));
  }

  try {
    let url: string;
    try { url = await attemptVeoFast(wrapPrompt(prompt)); }
    catch (e) {
      if (e instanceof Error && isSafetyError(e.message)) {
        try { url = await attemptVeoFast(wrapPrompt(sanitizePrompt(prompt))); }
        catch { res.status(400).json({ error: safetyMessage('Veo 3.1 Fast') }); return; }
      } else { throw e; }
    }
    res.json({ url });
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ── /api/veo-full — Veo 3.1 Full with audio via KIE ─────────────────────────
app.post('/api/veo-full', async (req, res) => {
  const kieKey = req.headers['x-kie-key'];
  if (!kieKey || typeof kieKey !== 'string') {
    res.status(400).json({ error: 'Missing x-kie-key header' }); return;
  }

  const { prompt, imageBase64, aspectRatio = '16:9' } = req.body as {
    prompt?: string; imageBase64?: string; aspectRatio?: string;
  };
  if (!prompt || !imageBase64) { res.status(400).json({ error: 'Missing prompt or imageBase64' }); return; }

  const kieHdr = { Authorization: `Bearer ${kieKey}`, 'Content-Type': 'application/json' };

  async function attemptVeoFull(p: string): Promise<string> {
    const rawBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const body = { prompt: p, imageUrl: rawBase64, model: 'veo3', aspectRatio, aspect_ratio: aspectRatio, enableAudio: true };
    console.log(`[VeoFull] request → model: veo3, aspectRatio: ${aspectRatio}, imageBase64.length: ${rawBase64.length}, prompt.length: ${p.length}`);
    const taskId = await kieCreate(
      'https://api.kie.ai/api/v1/veo/generate',
      kieHdr,
      body,
      'VeoFull'
    );
    return pollUntilDone(kiePoll(`https://api.kie.ai/api/v1/veo/query/${taskId}`, kieHdr, 'VeoFull'));
  }

  try {
    let url: string;
    try { url = await attemptVeoFull(wrapPrompt(prompt)); }
    catch (e) {
      if (e instanceof Error && isSafetyError(e.message)) {
        try { url = await attemptVeoFull(wrapPrompt(sanitizePrompt(prompt))); }
        catch { res.status(400).json({ error: safetyMessage('Veo 3.1') }); return; }
      } else { throw e; }
    }
    res.json({ url });
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ── /api/vidu — Vidu 2.0 via KIE (kept for compatibility) ───────────────────
app.post('/api/vidu', async (req, res) => {
  const kieKey = req.headers['x-kie-key'];
  if (!kieKey || typeof kieKey !== 'string') {
    res.status(400).json({ error: 'Missing x-kie-key header' }); return;
  }

  const { prompt, imageBase64, duration = 4, aspectRatio = '16:9' } = req.body as {
    prompt?: string; imageBase64?: string; duration?: number; aspectRatio?: string;
  };
  if (!prompt || !imageBase64) { res.status(400).json({ error: 'Missing prompt or imageBase64' }); return; }

  const kieHdr = { Authorization: `Bearer ${kieKey}`, 'Content-Type': 'application/json' };

  async function attemptVidu(p: string): Promise<string> {
    const taskId = await kieCreate(
      'https://api.kie.ai/api/v1/vidu/generate',
      kieHdr,
      { prompt: p, imageUrl: imageBase64, duration, aspectRatio },
      'Vidu'
    );
    return pollUntilDone(kiePoll(`https://api.kie.ai/api/v1/vidu/query/${taskId}`, kieHdr, 'Vidu'));
  }

  try {
    let url: string;
    try { url = await attemptVidu(wrapPrompt(prompt)); }
    catch (e) {
      if (e instanceof Error && isSafetyError(e.message)) {
        try { url = await attemptVidu(wrapPrompt(sanitizePrompt(prompt))); }
        catch { res.status(400).json({ error: safetyMessage('Vidu') }); return; }
      } else { throw e; }
    }
    res.json({ url });
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ── /api/kling-native — Kling 2.1 via official Kling API ────────────────────
app.post('/api/kling-native', async (req, res) => {
  const accessKey = req.headers['x-kling-access-key'];
  const secretKey = req.headers['x-kling-secret-key'];
  if (!accessKey || typeof accessKey !== 'string' || !secretKey || typeof secretKey !== 'string') {
    res.status(400).json({ error: 'Missing x-kling-access-key or x-kling-secret-key header' }); return;
  }

  const { prompt, imageBase64, duration = 5, aspectRatio = '16:9' } = req.body as {
    prompt?: string; imageBase64?: string; duration?: number; aspectRatio?: string;
  };
  if (!prompt || !imageBase64) { res.status(400).json({ error: 'Missing prompt or imageBase64' }); return; }

  async function attemptKlingNative(p: string): Promise<string> {
    const rawBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const taskId = await klingNativeCreate(accessKey as string, secretKey as string, {
      model_name: 'kling-v2-1',
      image: rawBase64,
      prompt: p,
      negative_prompt: 'static image, frozen frame, slideshow, blurry, low quality, watermark',
      duration: String(duration),
      aspect_ratio: aspectRatio,
      mode: 'std',
    }, 'Kling2.1');
    return pollUntilDone(klingNativePoll(taskId, accessKey as string, secretKey as string, 'Kling2.1'));
  }

  try {
    let url: string;
    try { url = await attemptKlingNative(wrapPrompt(prompt)); }
    catch (e) {
      if (e instanceof Error && isSafetyError(e.message)) {
        try { url = await attemptKlingNative(wrapPrompt(sanitizePrompt(prompt))); }
        catch { res.status(400).json({ error: safetyMessage('Kling 2.1') }); return; }
      } else { throw e; }
    }
    res.json({ url });
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ── /api/kling-audio-native — Kling 3.0 with audio via official Kling API ───
app.post('/api/kling-audio-native', async (req, res) => {
  const accessKey = req.headers['x-kling-access-key'];
  const secretKey = req.headers['x-kling-secret-key'];
  if (!accessKey || typeof accessKey !== 'string' || !secretKey || typeof secretKey !== 'string') {
    res.status(400).json({ error: 'Missing x-kling-access-key or x-kling-secret-key header' }); return;
  }

  const { prompt, imageBase64, duration = 5, aspectRatio = '16:9' } = req.body as {
    prompt?: string; imageBase64?: string; duration?: number; aspectRatio?: string;
  };
  if (!prompt || !imageBase64) { res.status(400).json({ error: 'Missing prompt or imageBase64' }); return; }

  async function attemptKling3Native(p: string): Promise<string> {
    const rawBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const taskId = await klingNativeCreate(accessKey as string, secretKey as string, {
      model_name: 'kling-v3',
      image: rawBase64,
      prompt: p,
      negative_prompt: 'static image, frozen frame, slideshow, blurry, low quality, watermark',
      duration: String(duration),
      aspect_ratio: aspectRatio,
      mode: 'std',
    }, 'Kling3.0');
    return pollUntilDone(klingNativePoll(taskId, accessKey as string, secretKey as string, 'Kling3.0'));
  }

  try {
    let url: string;
    try { url = await attemptKling3Native(wrapPrompt(prompt)); }
    catch (e) {
      if (e instanceof Error && isSafetyError(e.message)) {
        try { url = await attemptKling3Native(wrapPrompt(sanitizePrompt(prompt))); }
        catch { res.status(400).json({ error: safetyMessage('Kling 3.0') }); return; }
      } else { throw e; }
    }
    res.json({ url });
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ── /api/fal-kling-audio — Kling 3.0 with audio via fal.ai ──────────────────
app.post('/api/fal-kling-audio', async (req, res) => {
  const falKey = req.headers['x-fal-key'];
  if (!falKey || typeof falKey !== 'string') {
    res.status(400).json({ error: 'Missing x-fal-key header' }); return;
  }

  const { prompt, imageBase64, duration = 5, aspectRatio = '16:9' } = req.body as {
    prompt?: string; imageBase64?: string; duration?: number; aspectRatio?: string;
  };
  if (!prompt || !imageBase64) { res.status(400).json({ error: 'Missing prompt or imageBase64' }); return; }

  const FAL_EP = 'fal-ai/kling-video/v3/image-to-video';
  const falHdr = { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' };

  async function attemptFalKling(p: string): Promise<string> {
    const reqId = await falSubmit(
      FAL_EP,
      falHdr,
      { image_url: imageBase64, prompt: p, duration: String(duration), aspect_ratio: aspectRatio, motion_has_audio: true },
      'Kling3/fal'
    );
    return pollUntilDone(
      falPoll<{ video?: { url: string } }>(FAL_EP, reqId, falHdr, 'Kling3/fal', (d) => d.video?.url),
      90, 5000
    );
  }

  try {
    let url: string;
    try { url = await attemptFalKling(wrapPrompt(prompt)); }
    catch (e) {
      if (e instanceof Error && isSafetyError(e.message)) {
        try { url = await attemptFalKling(wrapPrompt(sanitizePrompt(prompt))); }
        catch { res.status(400).json({ error: safetyMessage('Kling 3.0') }); return; }
      } else { throw e; }
    }
    res.json({ url });
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ── /api/fal-flux — FLUX Dev via fal.ai ─────────────────────────────────────
app.post('/api/fal-flux', async (req, res) => {
  const falKey = req.headers['x-fal-key'];
  if (!falKey || typeof falKey !== 'string') {
    res.status(400).json({ error: 'Missing x-fal-key header' }); return;
  }

  const { prompt, imageBase64 } = req.body as { prompt?: string; imageBase64?: string };
  if (!prompt) { res.status(400).json({ error: 'Missing prompt' }); return; }

  const FAL_EP = 'fal-ai/flux/dev';
  const falHdr = { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' };

  const submitBody: Record<string, unknown> = { prompt };
  if (imageBase64) submitBody.image_url = imageBase64;

  try {
    const reqId = await falSubmit(FAL_EP, falHdr, submitBody, 'FLUX/fal');
    const url = await pollUntilDone(
      falPoll<{ images?: { url: string }[] }>(FAL_EP, reqId, falHdr, 'FLUX/fal', (d) => d.images?.[0]?.url),
      60, 3000
    );
    res.json({ url });
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ── /api/replicate-flux — FLUX Dev via Replicate (video) ─────────────────────
app.post('/api/replicate-flux', async (req, res) => {
  const apiKey = req.headers['x-replicate-key'];
  if (!apiKey || typeof apiKey !== 'string') {
    res.status(400).json({ error: 'Missing x-replicate-key header' }); return;
  }

  const { prompt, imageBase64 } = req.body as { prompt?: string; imageBase64?: string };
  if (!prompt) { res.status(400).json({ error: 'Missing prompt' }); return; }

  const MODEL_URL = 'https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions';
  const input: Record<string, unknown> = { prompt };
  if (imageBase64) input.image = imageBase64;

  try {
    const createRes = await fetch(MODEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Token ${apiKey}` },
      body: JSON.stringify({ input }),
    });
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as { detail?: string };
      res.status(createRes.status).json({ error: err.detail ?? `Replicate error ${createRes.status}` }); return;
    }

    const prediction = await createRes.json() as { id: string; status: string; output?: string[] | string; error?: string };
    const extractUrl = (o: string[] | string | undefined) => Array.isArray(o) ? o[0] : o ?? undefined;

    if (prediction.status === 'succeeded') {
      res.json({ url: extractUrl(prediction.output) }); return;
    }

    const predId = prediction.id;
    const url = await pollUntilDone(async () => {
      const r = await fetch(`https://api.replicate.com/v1/predictions/${predId}`, {
        headers: { Authorization: `Token ${apiKey}` },
      });
      const p = await r.json() as { status: string; output?: string[] | string; error?: string };
      if (p.status === 'succeeded') return { status: 'done', url: extractUrl(p.output) };
      if (p.status === 'failed' || p.status === 'canceled') return { status: 'failed', error: p.error };
      return { status: 'pending' };
    }, 60, 3000);
    res.json({ url });
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ── /api/veo-gemini — Veo 3.1 direct via Gemini API ─────────────────────────
app.post('/api/veo-gemini', async (req, res) => {
  const geminiKey = req.headers['x-gemini-key'];
  if (!geminiKey || typeof geminiKey !== 'string') {
    res.status(400).json({ error: 'Missing x-gemini-key header' }); return;
  }

  const { prompt, imageBase64, aspectRatio = '16:9' } = req.body as {
    prompt?: string; imageBase64?: string; aspectRatio?: string;
  };
  if (!prompt || !imageBase64) { res.status(400).json({ error: 'Missing prompt or imageBase64' }); return; }

  // Strip data URI prefix → raw base64
  const rawBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

  async function attemptVeoDirect(p: string): Promise<string> {
    const createRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: p, image: { bytesBase64Encoded: rawBase64, mimeType: 'image/jpeg' } }],
          parameters: { aspectRatio, durationSeconds: 8 },
        }),
      }
    );

    const createRaw = await createRes.text();
    console.log(`[VeoDirect] create status=${createRes.status} body=${createRaw.slice(0, 300)}`);

    if (!createRes.ok) {
      let msg: string;
      try { msg = (JSON.parse(createRaw) as { error?: { message?: string } }).error?.message ?? `Gemini error ${createRes.status}`; }
      catch { msg = `Gemini error ${createRes.status}: ${createRaw.slice(0, 100)}`; }
      throw new Error(msg);
    }

    const op = JSON.parse(createRaw) as { name: string };
    const opName = op.name;

    return pollUntilDone(async () => {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/${opName}?key=${geminiKey}`);
      const t = await r.json() as {
        done?: boolean;
        error?: { message?: string };
        response?: { generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[] } };
      };
      if (t.error) return { status: 'failed', error: t.error.message };
      if (t.done) {
        const uri = t.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
        return { status: 'done', url: uri };
      }
      return { status: 'pending' };
    }, 120, 5000);
  }

  try {
    let url: string;
    try { url = await attemptVeoDirect(wrapPrompt(prompt)); }
    catch (e) {
      if (e instanceof Error && isSafetyError(e.message)) {
        try { url = await attemptVeoDirect(wrapPrompt(sanitizePrompt(prompt))); }
        catch { res.status(400).json({ error: safetyMessage('Veo 3.1 Direct') }); return; }
      } else { throw e; }
    }
    res.json({ url });
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ── /api/kling-omni-native — Kling Omni 3.1 via official Kling API ───────────
app.post('/api/kling-omni-native', async (req, res) => {
  const accessKey = req.headers['x-kling-access-key'];
  const secretKey = req.headers['x-kling-secret-key'];
  if (!accessKey || typeof accessKey !== 'string' || !secretKey || typeof secretKey !== 'string') {
    res.status(400).json({ error: 'Missing x-kling-access-key or x-kling-secret-key header' }); return;
  }

  const { prompt, imageBase64, duration = 5, aspectRatio = '16:9' } = req.body as {
    prompt?: string; imageBase64?: string; duration?: number; aspectRatio?: string;
  };
  if (!prompt || !imageBase64) { res.status(400).json({ error: 'Missing prompt or imageBase64' }); return; }

  async function attemptKlingOmni(p: string): Promise<string> {
    const rawBase64 = imageBase64!.includes(',') ? imageBase64!.split(',')[1] : imageBase64!;
    const taskId = await klingNativeCreate(accessKey as string, secretKey as string, {
      model_name: 'kling-v3',
      image: rawBase64,
      prompt: p,
      negative_prompt: 'static image, frozen frame, slideshow, blurry, low quality, watermark',
      duration: String(duration),
      aspect_ratio: aspectRatio,
      mode: 'pro',
      cfg_scale: 0.5,
    }, 'KlingOmni');
    return pollUntilDone(klingNativePoll(taskId, accessKey as string, secretKey as string, 'KlingOmni'));
  }

  try {
    let url: string;
    try { url = await attemptKlingOmni(wrapPrompt(prompt)); }
    catch (e) {
      if (e instanceof Error && isSafetyError(e.message)) {
        try { url = await attemptKlingOmni(wrapPrompt(sanitizePrompt(prompt))); }
        catch { res.status(400).json({ error: safetyMessage('Kling Omni 3.1') }); return; }
      } else { throw e; }
    }
    res.json({ url });
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ── /api/udio — Udio music via KIE ───────────────────────────────────────────
app.post('/api/udio', async (req, res) => {
  const kieKey = req.headers['x-kie-key'];
  if (!kieKey || typeof kieKey !== 'string') {
    res.status(400).json({ error: 'Missing x-kie-key header' }); return;
  }

  const { prompt, instrumental = false } = req.body as {
    prompt?: string; instrumental?: boolean;
  };
  if (!prompt) { res.status(400).json({ error: 'Missing prompt' }); return; }

  const kieHdr = { Authorization: `Bearer ${kieKey}`, 'Content-Type': 'application/json' };

  try {
    const createRes = await fetch('https://api.kie.ai/api/v1/udio/create', {
      method: 'POST',
      headers: kieHdr,
      body: JSON.stringify({ prompt, instrumental }),
    });
    const createRaw = await createRes.text();
    console.log(`[Udio] create status=${createRes.status} body=${createRaw.slice(0, 300)}`);

    let cp: { code?: number; message?: string; data?: { workId?: string } };
    try { cp = JSON.parse(createRaw); }
    catch { throw new Error(`Udio error ${createRes.status}: ${createRaw.slice(0, 200)}`); }

    if (!createRes.ok || (cp.code !== undefined && cp.code !== 200 && cp.code !== 0)) {
      throw new Error(cp.message ?? `Udio error ${createRes.status}`);
    }

    const workId = cp.data?.workId;
    if (!workId) throw new Error('Udio did not return a workId');
    console.log(`[Udio] workId=${workId}`);

    const url = await pollUntilDone(async () => {
      const r = await fetch(`https://api.kie.ai/api/v1/udio/record-info?workId=${workId}`, { headers: kieHdr });
      const body = await r.json() as {
        code?: number;
        data?: { status?: string; tracks?: { audioUrl?: string }[]; audioUrl?: string };
      };
      const data = body.data ?? {};
      const st = (data.status ?? '').toLowerCase();
      console.log(`[Udio] poll status=${st}`);
      if (st === 'completed' || st === 'success' || st === 'succeeded') {
        return { status: 'done', url: data.tracks?.[0]?.audioUrl ?? data.audioUrl };
      }
      if (st === 'failed' || st === 'error') return { status: 'failed', error: 'Udio generation failed' };
      return { status: 'pending' };
    }, 60, 5000);

    res.json({ url });
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ── /api/suno — Suno music via KIE ───────────────────────────────────────────
app.post('/api/suno', async (req, res) => {
  const kieKey = req.headers['x-kie-key'];
  if (!kieKey || typeof kieKey !== 'string') {
    res.status(400).json({ error: 'Missing x-kie-key header' }); return;
  }

  const { prompt, model = 'V4', title = '', instrumental = false } = req.body as {
    prompt?: string; model?: string; title?: string; instrumental?: boolean;
  };
  if (!prompt) { res.status(400).json({ error: 'Missing prompt' }); return; }

  const kieHdr = { Authorization: `Bearer ${kieKey}`, 'Content-Type': 'application/json' };

  try {
    const createRes = await fetch('https://api.kie.ai/api/v1/suno/v4/create', {
      method: 'POST',
      headers: kieHdr,
      body: JSON.stringify({ prompt, model, title: title.slice(0, 80), instrumental }),
    });
    const createRaw = await createRes.text();
    console.log(`[Suno] create status=${createRes.status} body=${createRaw.slice(0, 300)}`);

    let cp: { code?: number; message?: string; data?: { workId?: string } };
    try { cp = JSON.parse(createRaw); }
    catch { throw new Error(`Suno error ${createRes.status}: ${createRaw.slice(0, 200)}`); }

    if (!createRes.ok || (cp.code !== undefined && cp.code !== 200 && cp.code !== 0)) {
      throw new Error(cp.message ?? `Suno error ${createRes.status}`);
    }

    const workId = cp.data?.workId;
    if (!workId) throw new Error('Suno did not return a workId');
    console.log(`[Suno] workId=${workId}`);

    const url = await pollUntilDone(async () => {
      const r = await fetch(`https://api.kie.ai/api/v1/suno/record-info?workId=${workId}`, { headers: kieHdr });
      const body = await r.json() as {
        code?: number;
        data?: { status?: string; tracks?: { audioUrl?: string }[]; audioUrl?: string };
      };
      const data = body.data ?? {};
      const st = (data.status ?? '').toLowerCase();
      console.log(`[Suno] poll status=${st}`);
      if (st === 'completed' || st === 'success' || st === 'succeeded') {
        return { status: 'done', url: data.tracks?.[0]?.audioUrl ?? data.audioUrl };
      }
      if (st === 'failed' || st === 'error') return { status: 'failed', error: 'Suno generation failed' };
      return { status: 'pending' };
    }, 60, 5000);

    res.json({ url });
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ── Serve React frontend ──────────────────────────────────────────────────────
const distPath = path.join(__dirname, '..', 'dist', 'public');
app.use(express.static(distPath));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
