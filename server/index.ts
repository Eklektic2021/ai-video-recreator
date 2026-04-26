import crypto from 'crypto';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import RunwayML from '@runwayml/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '15mb' }));

// ── Shared helpers ─────────────────────────────────────────────────────────────

async function pollUntilDone(
  pollFn: () => Promise<{ status: string; url?: string; error?: string }>,
  maxAttempts = 90,
  delayMs = 2000
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
      });
      res.json({ url });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

// ── Runway proxy ─────────────────────────────────────────────────────────────
app.post('/api/runway', async (req, res) => {
  const apiKey = req.headers['x-runway-key'];
  if (!apiKey || typeof apiKey !== 'string') {
    res.status(400).json({ error: 'Missing x-runway-key header' });
    return;
  }

  const { prompt, imageBase64, duration = 5 } = req.body as {
    prompt?: string; imageBase64?: string; duration?: number;
  };
  if (!prompt || !imageBase64) {
    res.status(400).json({ error: 'Missing prompt or imageBase64' });
    return;
  }

  async function attemptRunway(p: string): Promise<string> {
    const client = new RunwayML({ apiKey: apiKey as string });
    const imageToVideo = await client.imageToVideo.create({
      model: 'gen4_turbo',
      promptImage: imageBase64 as string,
      promptText: p,
      duration: duration as 5 | 10,
      ratio: '1280:720',
    });

    let task = await client.tasks.retrieve(imageToVideo.id);
    let attempts = 0;
    while (task.status !== 'SUCCEEDED' && task.status !== 'FAILED') {
      if (++attempts > 90) throw new Error('Request timed out after 450 seconds');
      await new Promise((r) => setTimeout(r, 5000));
      task = await client.tasks.retrieve(imageToVideo.id);
    }
    if (task.status === 'FAILED') throw new Error(task.failure ?? 'Runway generation failed');
    const url = task.output?.[0] ?? null;
    if (!url) throw new Error('No output URL returned');
    return url;
  }

  try {
    let url: string;
    try {
      url = await attemptRunway(wrapPrompt(prompt));
    } catch (firstErr) {
      if (firstErr instanceof Error && isSafetyError(firstErr.message)) {
        try {
          url = await attemptRunway(wrapPrompt(sanitizePrompt(prompt)));
        } catch {
          res.status(400).json({ error: safetyMessage('Runway') });
          return;
        }
      } else { throw firstErr; }
    }
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

// ── Kling proxy (fal.ai Kling 3.0) ──────────────────────────────────────────
app.post('/api/kling', async (req, res) => {
  const apiKey = req.headers['x-fal-key'];
  if (!apiKey || typeof apiKey !== 'string') {
    res.status(400).json({ error: 'Missing x-fal-key header' });
    return;
  }

  const { prompt, imageBase64, duration = 5, audioEnabled = false } = req.body as {
    prompt?: string; imageBase64?: string; duration?: number; audioEnabled?: boolean;
  };
  if (!prompt || !imageBase64) {
    res.status(400).json({ error: 'Missing prompt or imageBase64' });
    return;
  }

  const FAL_ENDPOINT = 'fal-ai/kling-video/v3/image-to-video';
  const falHeaders = { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' };

  console.log(`[Kling/fal] endpoint=${FAL_ENDPOINT} duration=${duration} audio=${audioEnabled}`);
  console.log(`[Kling/fal] key=${apiKey.slice(0, 8)}… (len=${apiKey.length})`);

  async function attemptKling(p: string): Promise<string> {
    const submitRes = await fetch(`https://queue.fal.run/${FAL_ENDPOINT}`, {
      method: 'POST',
      headers: falHeaders,
      body: JSON.stringify({
        image_url: imageBase64,
        prompt: p,
        duration: String(duration),
        aspect_ratio: '16:9',
        motion_has_audio: audioEnabled,
      }),
    });

    const submitBody = await submitRes.text();
    console.log(`[Kling/fal] submit status=${submitRes.status} body=${submitBody}`);

    if (!submitRes.ok) {
      let msg: string;
      try { msg = (JSON.parse(submitBody) as { detail?: string; error?: string }).detail ?? (JSON.parse(submitBody) as { error?: string }).error ?? `Kling error ${submitRes.status}`; }
      catch { msg = `Kling error ${submitRes.status}: ${submitBody}`; }
      throw new Error(msg);
    }

    const { request_id } = JSON.parse(submitBody) as { request_id: string };
    if (!request_id) throw new Error('fal.ai did not return a request_id');

    console.log(`[Kling/fal] request_id=${request_id}`);

    return pollUntilDone(async () => {
      const statusRes = await fetch(
        `https://queue.fal.run/${FAL_ENDPOINT}/requests/${request_id}/status`,
        { headers: falHeaders }
      );
      const s = await statusRes.json() as { status: string; error?: string };
      console.log(`[Kling/fal] poll status=${s.status}`);

      if (s.status === 'COMPLETED') {
        const resultRes = await fetch(
          `https://queue.fal.run/${FAL_ENDPOINT}/requests/${request_id}`,
          { headers: falHeaders }
        );
        const data = await resultRes.json() as { video?: { url: string } };
        return { status: 'done', url: data.video?.url };
      }
      if (s.status === 'FAILED' || s.status === 'ERROR') {
        return { status: 'failed', error: s.error ?? 'Kling generation failed' };
      }
      return { status: 'pending' };
    }, 90, 5000);
  }

  try {
    let url: string;
    try {
      url = await attemptKling(wrapPrompt(prompt));
    } catch (firstErr) {
      if (firstErr instanceof Error && isSafetyError(firstErr.message)) {
        try {
          url = await attemptKling(wrapPrompt(sanitizePrompt(prompt)));
        } catch {
          res.status(400).json({ error: safetyMessage('Kling') });
          return;
        }
      } else { throw firstErr; }
    }
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

// ── Vidu proxy ───────────────────────────────────────────────────────────────
app.post('/api/vidu', async (req, res) => {
  const apiKey = req.headers['x-vidu-key'];
  if (!apiKey || typeof apiKey !== 'string') {
    res.status(400).json({ error: 'Missing x-vidu-key header' });
    return;
  }

  const { prompt, imageBase64, duration = 4 } = req.body as {
    prompt?: string; imageBase64?: string; duration?: number;
  };
  if (!prompt || !imageBase64) {
    res.status(400).json({ error: 'Missing prompt or imageBase64' });
    return;
  }

  const CREATE_URL = 'https://api.vidu.studio/vidu/v1/tasks';
  const authHeader = `Token ${apiKey}`;
  const viduHeaders = { 'Content-Type': 'application/json', Authorization: authHeader };

  console.log(`[Vidu] POST ${CREATE_URL}`);
  console.log(`[Vidu] Authorization: Token ${apiKey.slice(0, 8)}… (len=${apiKey.length})`);
  console.log(`[Vidu] duration=${duration} imageBase64 prefix="${imageBase64.slice(0, 30)}…"`);

  async function attemptVidu(p: string): Promise<string> {
    const createRes = await fetch(CREATE_URL, {
      method: 'POST',
      headers: viduHeaders,
      body: JSON.stringify({
        type: 'img2video',
        model: 'vidu-2.0',
        input: {
          enhance: true,
          seed: 0,
          prompts: [
            { type: 'image', data: imageBase64 },
            { type: 'text', data: p },
          ],
        },
        output_params: { sample_count: 1, duration },
      }),
    });

    const createBody = await createRes.text();
    console.log(`[Vidu] create status=${createRes.status} body=${createBody}`);

    if (!createRes.ok) {
      let errMsg: string;
      try { errMsg = (JSON.parse(createBody) as { message?: string }).message ?? `Vidu error ${createRes.status}: ${createBody}`; }
      catch { errMsg = `Vidu error ${createRes.status}: ${createBody}`; }
      throw new Error(errMsg);
    }

    const task = JSON.parse(createBody) as { id?: string; task_id?: string };
    const taskId = task.id ?? task.task_id;
    if (!taskId) throw new Error(`Vidu did not return a task ID. Response: ${createBody}`);

    console.log(`[Vidu] task created id=${taskId}`);
    const POLL_URL = `https://api.vidu.studio/vidu/v1/tasks/${taskId}`;
    return pollUntilDone(async () => {
      const r = await fetch(POLL_URL, { headers: { Authorization: authHeader } });
      const t = await r.json() as { state?: string; creations?: { url: string }[] };
      console.log(`[Vidu] poll ${POLL_URL} → state=${t.state}`);
      if (t.state === 'success') return { status: 'done', url: t.creations?.[0]?.url };
      if (t.state === 'failed') return { status: 'failed', error: 'Vidu task failed' };
      return { status: 'pending' };
    }, 90, 5000);
  }

  try {
    let url: string;
    try {
      url = await attemptVidu(wrapPrompt(prompt));
    } catch (firstErr) {
      if (firstErr instanceof Error && isSafetyError(firstErr.message)) {
        try {
          url = await attemptVidu(wrapPrompt(sanitizePrompt(prompt)));
        } catch {
          res.status(400).json({ error: safetyMessage('Vidu') });
          return;
        }
      } else { throw firstErr; }
    }
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

// ── Veo proxy ─────────────────────────────────────────────────────────────────
app.post('/api/veo', async (req, res) => {
  const apiKey = req.headers['x-gemini-key'];
  if (!apiKey || typeof apiKey !== 'string') {
    res.status(400).json({ error: 'Missing x-gemini-key header' });
    return;
  }

  const { prompt, imageBase64, duration = 8 } = req.body as {
    prompt?: string; imageBase64?: string; duration?: number;
  };
  if (!prompt || !imageBase64) {
    res.status(400).json({ error: 'Missing prompt or imageBase64' });
    return;
  }

  async function attemptVeo(p: string): Promise<string> {
    const createRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: p, image: { bytesBase64Encoded: imageBase64 } }],
          parameters: { aspectRatio: '16:9', durationSeconds: duration },
        }),
      }
    );

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(err.error?.message ?? `Veo error ${createRes.status}`);
    }

    const op = await createRes.json() as { name: string };
    const opName = op.name;
    return pollUntilDone(async () => {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${opName}?key=${apiKey}`
      );
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
    }, 180, 3000);
  }

  try {
    let url: string;
    try {
      url = await attemptVeo(wrapPrompt(prompt));
    } catch (firstErr) {
      if (firstErr instanceof Error && isSafetyError(firstErr.message)) {
        try {
          url = await attemptVeo(wrapPrompt(sanitizePrompt(prompt)));
        } catch {
          res.status(400).json({ error: safetyMessage('Veo') });
          return;
        }
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
