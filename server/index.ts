import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// ── Replicate proxy ──────────────────────────────────────────────────────────
app.post('/api/replicate', async (req, res) => {
  const apiKey = req.headers['x-replicate-key'];
  if (!apiKey || typeof apiKey !== 'string') {
    res.status(400).json({ error: 'Missing x-replicate-key header' });
    return;
  }

  const { prompt } = req.body as { prompt?: string };
  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt in request body' });
    return;
  }

  try {
    // Create prediction
    const createRes = await fetch(
      'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${apiKey}`,
        },
        body: JSON.stringify({ input: { prompt } }),
      }
    );

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as { detail?: string };
      res.status(createRes.status).json({ error: err.detail ?? `Replicate error ${createRes.status}` });
      return;
    }

    const prediction = await createRes.json() as {
      id: string;
      status: string;
      output?: string[];
      error?: string;
    };

    if (prediction.status === 'succeeded' && prediction.output?.[0]) {
      res.json({ url: prediction.output[0] });
      return;
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
        output?: string[];
        error?: string;
      };

      if (poll.status === 'succeeded' && poll.output?.[0]) {
        res.json({ url: poll.output[0] });
        return;
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
