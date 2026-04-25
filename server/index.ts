import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
// Base64 reference images can be several MB; increase limit accordingly
app.use(express.json({ limit: '15mb' }));

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

  const input = useRedux
    ? { redux_image: referenceImageBase64, prompt }
    : { prompt };

  try {
    const createRes = await fetch(modelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${apiKey}`,
      },
      body: JSON.stringify({ input }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as { detail?: string };
      res.status(createRes.status).json({ error: err.detail ?? `Replicate error ${createRes.status}` });
      return;
    }

    const prediction = await createRes.json() as {
      id: string;
      status: string;
      output?: string[] | string;
      error?: string;
    };

    const extractUrl = (output: string[] | string | undefined): string | null => {
      if (!output) return null;
      if (Array.isArray(output)) return output[0] ?? null;
      return output;
    };

    if (prediction.status === 'succeeded') {
      const url = extractUrl(prediction.output);
      if (url) { res.json({ url }); return; }
    }

    // Poll until complete
    const predId = prediction.id;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predId}`, {
        headers: { Authorization: `Token ${apiKey}` },
      });

      if (!pollRes.ok) {
        res.status(pollRes.status).json({ error: `Poll error ${pollRes.status}` });
        return;
      }

      const poll = await pollRes.json() as {
        status: string;
        output?: string[] | string;
        error?: string;
      };

      if (poll.status === 'succeeded') {
        const url = extractUrl(poll.output);
        if (url) { res.json({ url }); return; }
      }

      if (poll.status === 'failed' || poll.status === 'canceled') {
        res.status(500).json({ error: poll.error ?? 'Prediction failed' });
        return;
      }
    }

    res.status(504).json({ error: 'Prediction timed out after 120 seconds' });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// ── Serve React frontend ─────────────────────────────────────────────────────
const distPath = path.join(__dirname, '..', 'dist', 'public');
app.use(express.static(distPath));

// SPA fallback — all non-API routes serve index.html
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
