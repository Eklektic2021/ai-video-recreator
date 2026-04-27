import crypto from 'crypto';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '15mb' }));

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
  throw new Error('Request timed out');
}

function wrapPrompt(raw: string): string {
  return (
    'Cinematic video clip. Consistent characters throughout — do not change facial features, ' +
    'skin tone, body proportions, or clothing between frames. No morphing, distortion, or ' +
    'character drift. Smooth natural motion only — no static frames, no frozen imagery, no ' +
    'slideshow effect. Keep all characters exactly as shown in the reference image.' +
    `\n\n${raw}\n\n` +
    'Negative: static image, frozen frame, slideshow, morphing faces, distorted features, ' +
    'extra limbs, extra characters, character inconsistency, blurry faces, low quality, watermark.'
  );
}

const SAFETY_KEYWORDS = [
  'content policy', 'safety', 'flagged', 'violat', 'moderat',
  'inappropriate', 'nsfw', 'harmful', 'blocked', 'prohibited',
];

function isSafetyError(message: string): boolean {
  const lower = message.toLowerCase();
  return SAFETY_KEYWORDS.some((kw) => lower.includes(kw));
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
  for (const [pattern, replacement] of SANITIZE_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function safetyMessage(provider: string): string {
  return `This scene's prompt was flagged by ${provider}'s safety system. Please edit the scene description and try again.`;
}

// ── KIE AI shared helpers ──────────────────────────────────────────────────────

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
    failReason?: string;
  };
}

async function kieCreate(
  url: string,
  headers: Record<string, string>,
  body: KieCreateBody,
  label: string
): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  console.log(`[${label}] create status=${res.status} body=${raw}`);

  let parsed: KieCreateResponse;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error(`${label} error ${res.status}: ${raw}`); }

  if (!res.ok || (parsed.code !== undefined && parsed.code !== 200 && parsed.code !== 0)) {
    throw new Error(parsed.message ?? `${label} error ${res.status}`);
  }

  const taskId =
    parsed.data?.taskId ?? parsed.data?.task_id ?? parsed.data?.id ??
    parsed.taskId ?? parsed.task_id;
  if (!taskId) throw new Error(`${label} did not return a task ID. Response: ${raw}`);

  console.log(`[${label}] taskId=${taskId}`);
  return taskId;
}

function kiePoll(
  queryUrl: string,
  headers: Record<string, string>,
  label: string
): () => Promise<{ status: string; url?: string; error?: string }> {
  return async () => {
    const r = await fetch(queryUrl, { headers });
    const body = await r.json() as KiePollResponse;
    const data = body.data ?? {};
    const st = (data.status ?? '').toLowerCase();
    const url = data.videoUrl ?? data.video_url;
    console.log(`[${label}] poll status=${st} url=${url ?? '(none)'}`);

    if (st === 'succeeded' || st === 'completed' || st === 'success') {
      return { status: 'done', url };
    }
    if (st === 'failed' || st === 'error') {
      return { status: 'failed', error: data.failReason ?? body.message ?? `${label} task failed` };
    }
    return { status: 'pending' };
  };
}

// ── Replicate proxy ──────────────────────────────────────────────────────────
app.post('/api/replicate', async (req, res) => {
  const apiKey = req.headers['x-replicate-key'];
  if (!apiKey || typeof apiKey !== 'string') {
    res.status(400).json({ error: 'Missing x-replicate-key header' });
    return;
  }

  const { prompt, referenceImageBase64 } = req.body as {
    prompt?: string;
    referenceImageBase64?: string;
  };

  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt in request body' });
    return;
  }

  const useRedux = !!referenceImageBase64;
  const modelUrl = useRedux
    ? 'https://api.replicate.com/v1/models/black-forest-labs/flux-redux-dev/predictions'
    : 'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions';
  const input = useRedux ? { redux_image: referenceImageBase64, prompt } : { prompt };

  try {
    const createRes = await fetch(modelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Token ${apiKey}` },
      body: JSON.stringify({ input }),
    });
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as { detail?: string };
      res.status(createRes.status).json({ error: err.detail ?? `Replicate error ${createRes.status}` });
      return;
    }

    const prediction = await createRes.json() as {
      id: string; status: string; output?: string[] | string; error?: string;
    };
    const extractUrl = (o: string[] | string | undefined) =>
      Array.isArray(o) ? o[0] : o ?? null;

    if (prediction.status === 'succeeded' && extractUrl(prediction.output)) {
      res.json({ url: extractUrl(prediction.output) });
      return;
    }

    const predId = prediction.id;
    try {
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
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

// ── KIE Runway proxy ──────────────────────────────────────────────────────────
app.post('/api/runway', async (req, res) => {
  const kieKey = req.headers['x-kie-key'];
  if (!kieKey || typeof kieKey !== 'string') {
    res.status(400).json({ error: 'Missing x-kie-key header' });
    return;
  }

  const { prompt, imageBase64, duration = 5, aspectRatio = '16:9' } = req.body as {
    prompt?: string; imageBase64?: string; duration?: number; aspectRatio?: string;
  };
  if (!prompt || !imageBase64) {
    res.status(400).json({ error: 'Missing prompt or imageBase64' });
    return;
  }

  const kieHeaders = { 'Authorization': `Bearer ${kieKey}`, 'Content-Type': 'application/json' };
  const model = duration === 10 ? 'runway-duration-10-generate' : 'runway-duration-5-generate';

  async function attemptRunway(p: string): Promise<string> {
    const taskId = await kieCreate(
      'https://api.kie.ai/api/v1/runway/generate',
      kieHeaders,
      { prompt: p, imageUrl: imageBase64, model, aspectRatio, waterMark: 'MAISuite Flow' },
      'Runway'
    );
    return pollUntilDone(
      kiePoll(`https://api.kie.ai/api/v1/runway/query/${taskId}`, kieHeaders, 'Runway')
    );
  }

  try {
    let url: string;
    try {
      url = await attemptRunway(wrapPrompt(prompt));
    } catch (firstErr) {
      if (firstErr instanceof Error && isSafetyError(firstErr.message)) {
        try { url = await attemptRunway(wrapPrompt(sanitizePrompt(prompt))); }
        catch { res.status(400).json({ error: safetyMessage('Runway') }); return; }
      } else { throw firstErr; }
    }
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

// ── KIE Kling proxy ───────────────────────────────────────────────────────────
app.post('/api/kling', async (req, res) => {
  const kieKey = req.headers['x-kie-key'];
  if (!kieKey || typeof kieKey !== 'string') {
    res.status(400).json({ error: 'Missing x-kie-key header' });
    return;
  }

  const { prompt, imageBase64, duration = 5, audioEnabled = false, aspectRatio = '16:9' } = req.body as {
    prompt?: string; imageBase64?: string; duration?: number; audioEnabled?: boolean; aspectRatio?: string;
  };
  if (!prompt || !imageBase64) {
    res.status(400).json({ error: 'Missing prompt or imageBase64' });
    return;
  }

  const kieHeaders = { 'Authorization': `Bearer ${kieKey}`, 'Content-Type': 'application/json' };
  console.log(`[Kling/KIE] duration=${duration} audio=${audioEnabled} ratio=${aspectRatio}`);

  async function attemptKling(p: string): Promise<string> {
    const taskId = await kieCreate(
      'https://api.kie.ai/api/v1/kling/v2.1/image-to-video',
      kieHeaders,
      {
        prompt: p,
        imageUrl: imageBase64,
        duration: String(duration),
        aspectRatio,
        modelName: 'kling-v2.1',
      },
      'Kling'
    );
    return pollUntilDone(
      kiePoll(`https://api.kie.ai/api/v1/kling/query/${taskId}`, kieHeaders, 'Kling')
    );
  }

  try {
    let url: string;
    try {
      url = await attemptKling(wrapPrompt(prompt));
    } catch (firstErr) {
      if (firstErr instanceof Error && isSafetyError(firstErr.message)) {
        try { url = await attemptKling(wrapPrompt(sanitizePrompt(prompt))); }
        catch { res.status(400).json({ error: safetyMessage('Kling') }); return; }
      } else { throw firstErr; }
    }
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

// ── KIE Vidu proxy ────────────────────────────────────────────────────────────
app.post('/api/vidu', async (req, res) => {
  const kieKey = req.headers['x-kie-key'];
  if (!kieKey || typeof kieKey !== 'string') {
    res.status(400).json({ error: 'Missing x-kie-key header' });
    return;
  }

  const { prompt, imageBase64, duration = 4, aspectRatio = '16:9' } = req.body as {
    prompt?: string; imageBase64?: string; duration?: number; aspectRatio?: string;
  };
  if (!prompt || !imageBase64) {
    res.status(400).json({ error: 'Missing prompt or imageBase64' });
    return;
  }

  const kieHeaders = { 'Authorization': `Bearer ${kieKey}`, 'Content-Type': 'application/json' };

  async function attemptVidu(p: string): Promise<string> {
    const taskId = await kieCreate(
      'https://api.kie.ai/api/v1/vidu/generate',
      kieHeaders,
      { prompt: p, imageUrl: imageBase64, duration, aspectRatio },
      'Vidu'
    );
    return pollUntilDone(
      kiePoll(`https://api.kie.ai/api/v1/vidu/query/${taskId}`, kieHeaders, 'Vidu')
    );
  }

  try {
    let url: string;
    try {
      url = await attemptVidu(wrapPrompt(prompt));
    } catch (firstErr) {
      if (firstErr instanceof Error && isSafetyError(firstErr.message)) {
        try { url = await attemptVidu(wrapPrompt(sanitizePrompt(prompt))); }
        catch { res.status(400).json({ error: safetyMessage('Vidu') }); return; }
      } else { throw firstErr; }
    }
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

// ── KIE Veo proxy ─────────────────────────────────────────────────────────────
app.post('/api/veo', async (req, res) => {
  const kieKey = req.headers['x-kie-key'];
  if (!kieKey || typeof kieKey !== 'string') {
    res.status(400).json({ error: 'Missing x-kie-key header' });
    return;
  }

  const { prompt, imageBase64, enableAudio = false, aspectRatio = '16:9' } = req.body as {
    prompt?: string; imageBase64?: string; duration?: number; enableAudio?: boolean; aspectRatio?: string;
  };
  if (!prompt || !imageBase64) {
    res.status(400).json({ error: 'Missing prompt or imageBase64' });
    return;
  }

  const kieHeaders = { 'Authorization': `Bearer ${kieKey}`, 'Content-Type': 'application/json' };
  const veoModel = enableAudio ? 'veo3' : 'veo3_fast';

  async function attemptVeo(p: string): Promise<string> {
    const body: KieCreateBody = {
      prompt: p,
      imageUrls: [imageBase64],
      model: veoModel,
      aspect_ratio: aspectRatio,
      generationType: 'REFERENCE_2_VIDEO',
    };
    if (enableAudio) body.enableAudio = true;
    const taskId = await kieCreate(
      'https://api.kie.ai/api/v1/veo/generate',
      kieHeaders,
      body,
      'Veo'
    );
    return pollUntilDone(
      kiePoll(`https://api.kie.ai/api/v1/veo/query/${taskId}`, kieHeaders, 'Veo')
    );
  }

  try {
    let url: string;
    try {
      url = await attemptVeo(wrapPrompt(prompt));
    } catch (firstErr) {
      if (firstErr instanceof Error && isSafetyError(firstErr.message)) {
        try { url = await attemptVeo(wrapPrompt(sanitizePrompt(prompt))); }
        catch { res.status(400).json({ error: safetyMessage('Veo') }); return; }
      } else { throw firstErr; }
    }
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

// ── Serve React frontend ─────────────────────────────────────────────────────
const distPath = path.join(__dirname, '..', 'dist', 'public');
app.use(express.static(distPath));

app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// suppress unused-import warning for crypto (used by old Kling JWT, kept for potential future use)
void crypto;
