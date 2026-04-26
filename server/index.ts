import crypto from 'crypto';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '15mb' }));

// ── Shared polling helper ─────────────────────────────────────────────────────
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
  throw new Error('Request timed out after 180 seconds');
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

  const { prompt, imageBase64 } = req.body as { prompt?: string; imageBase64?: string };
  if (!prompt || !imageBase64) {
    res.status(400).json({ error: 'Missing prompt or imageBase64' });
    return;
  }

  try {
    const createRes = await fetch('https://api.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify({
        model: 'gen4_turbo',
        promptImage: imageBase64,
        promptText: prompt,
        duration: 5,
        ratio: '1280:720',
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as { message?: string };
      res.status(createRes.status).json({ error: err.message ?? `Runway error ${createRes.status}` });
      return;
    }

    const task = await createRes.json() as { id: string };
    const taskId = task.id;

    try {
      const url = await pollUntilDone(async () => {
        const r = await fetch(`https://api.runwayml.com/v1/tasks/${taskId}`, {
          headers: { Authorization: `Bearer ${apiKey}`, 'X-Runway-Version': '2024-11-06' },
        });
        const t = await r.json() as { status: string; output?: string[]; failure?: string };
        if (t.status === 'SUCCEEDED') return { status: 'done', url: t.output?.[0] };
        if (t.status === 'FAILED') return { status: 'failed', error: t.failure };
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

// ── Kling proxy ──────────────────────────────────────────────────────────────
function generateKlingJWT(accessKey: string, secretKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 })).toString('base64url');
  const data = `${header}.${payload}`;
  const sig = crypto.createHmac('sha256', secretKey).update(data).digest('base64url');
  return `${data}.${sig}`;
}

app.post('/api/kling', async (req, res) => {
  const accessKey = req.headers['x-kling-access'];
  const secretKey = req.headers['x-kling-secret'];
  if (!accessKey || typeof accessKey !== 'string' || !secretKey || typeof secretKey !== 'string') {
    res.status(400).json({ error: 'Missing x-kling-access or x-kling-secret headers' });
    return;
  }

  const { prompt, imageBase64 } = req.body as { prompt?: string; imageBase64?: string };
  if (!prompt || !imageBase64) {
    res.status(400).json({ error: 'Missing prompt or imageBase64' });
    return;
  }

  const jwt = generateKlingJWT(accessKey, secretKey);

  try {
    const createRes = await fetch('https://api.klingai.com/v1/videos/image2video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        model_name: 'kling-v1',
        image: imageBase64,
        prompt,
        duration: '5',
        mode: 'std',
        cfg_scale: 0.5,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as { message?: string };
      res.status(createRes.status).json({ error: err.message ?? `Kling error ${createRes.status}` });
      return;
    }

    const body = await createRes.json() as { code: number; message?: string; data?: { task_id: string } };
    if (body.code !== 0 || !body.data?.task_id) {
      res.status(500).json({ error: body.message ?? 'Kling task creation failed' });
      return;
    }

    const taskId = body.data.task_id;

    try {
      const url = await pollUntilDone(async () => {
        const freshJwt = generateKlingJWT(accessKey, secretKey);
        const r = await fetch(`https://api.klingai.com/v1/videos/image2video/${taskId}`, {
          headers: { Authorization: `Bearer ${freshJwt}` },
        });
        const t = await r.json() as {
          data?: { task_status: string; task_result?: { videos?: { url: string }[] } };
        };
        const status = t.data?.task_status;
        if (status === 'succeed') return { status: 'done', url: t.data?.task_result?.videos?.[0]?.url };
        if (status === 'failed') return { status: 'failed', error: 'Kling task failed' };
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

// ── Vidu proxy ───────────────────────────────────────────────────────────────
app.post('/api/vidu', async (req, res) => {
  const apiKey = req.headers['x-vidu-key'];
  if (!apiKey || typeof apiKey !== 'string') {
    res.status(400).json({ error: 'Missing x-vidu-key header' });
    return;
  }

  const { prompt, imageBase64 } = req.body as { prompt?: string; imageBase64?: string };
  if (!prompt || !imageBase64) {
    res.status(400).json({ error: 'Missing prompt or imageBase64' });
    return;
  }

  try {
    const createRes = await fetch('https://api.vidu.studio/vidu/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Token ${apiKey}` },
      body: JSON.stringify({
        type: 'img2video',
        model: 'vidu-2.0',
        input: {
          enhance: true,
          seed: 0,
          prompts: [
            { type: 'image', data: imageBase64 },
            { type: 'text', data: prompt },
          ],
        },
        output_params: { sample_count: 1, duration: 4 },
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as { message?: string };
      res.status(createRes.status).json({ error: err.message ?? `Vidu error ${createRes.status}` });
      return;
    }

    const task = await createRes.json() as { id?: string; task_id?: string };
    const taskId = task.id ?? task.task_id;
    if (!taskId) {
      res.status(500).json({ error: 'Vidu did not return a task ID' });
      return;
    }

    try {
      const url = await pollUntilDone(async () => {
        const r = await fetch(`https://api.vidu.studio/vidu/v1/tasks/${taskId}`, {
          headers: { Authorization: `Token ${apiKey}` },
        });
        const t = await r.json() as { state?: string; creations?: { url: string }[] };
        if (t.state === 'success') return { status: 'done', url: t.creations?.[0]?.url };
        if (t.state === 'failed') return { status: 'failed', error: 'Vidu task failed' };
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

// ── Veo proxy ─────────────────────────────────────────────────────────────────
app.post('/api/veo', async (req, res) => {
  const apiKey = req.headers['x-gemini-key'];
  if (!apiKey || typeof apiKey !== 'string') {
    res.status(400).json({ error: 'Missing x-gemini-key header' });
    return;
  }

  const { prompt, imageBase64 } = req.body as { prompt?: string; imageBase64?: string };
  if (!prompt || !imageBase64) {
    res.status(400).json({ error: 'Missing prompt or imageBase64' });
    return;
  }

  try {
    const createRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt, image: { bytesBase64Encoded: imageBase64 } }],
          parameters: { aspectRatio: '16:9', durationSeconds: 8 },
        }),
      }
    );

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as { error?: { message?: string } };
      res.status(createRes.status).json({ error: err.error?.message ?? `Veo error ${createRes.status}` });
      return;
    }

    const op = await createRes.json() as { name: string };
    const opName = op.name;

    try {
      const url = await pollUntilDone(async () => {
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
      res.json({ url });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
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
