import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== 'production';
const PORT = parseInt(process.env.PORT ?? '3000', 10);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const SYSTEM_PROMPT = `You are an expert video analysis AI for MAISuite Flow. When given a video description and platform selections, you analyze the content and generate comprehensive, production-ready prompts and instructions.

Always respond with a single valid JSON object matching this exact structure (no markdown, no extra text):
{
  "sceneAnalysis": [
    {
      "scene": 1,
      "timestamp": "0:00-0:05",
      "description": "...",
      "cameraWork": "...",
      "lighting": "...",
      "mood": "...",
      "keyElements": ["...", "..."]
    }
  ],
  "videoPlatformPrompts": {
    "PlatformName": {
      "mainPrompt": "...",
      "negativePrompt": "...",
      "technicalSettings": "...",
      "tips": "..."
    }
  },
  "musicPrompts": {
    "PlatformName": {
      "prompt": "...",
      "genre": "...",
      "tempo": "...",
      "instruments": "...",
      "mood": "...",
      "duration": "..."
    }
  },
  "editingInstructions": {
    "PlatformName": {
      "overview": "...",
      "steps": ["...", "..."],
      "keyEffects": ["...", "..."],
      "colorGrading": "...",
      "transitions": "...",
      "timing": "..."
    }
  },
  "sfxBreakdown": [
    {
      "timestamp": "0:00",
      "sound": "...",
      "type": "ambient|foley|musical|impact|transition",
      "intensity": "Low|Medium|High",
      "notes": "..."
    }
  ],
  "coverArtPrompt": "..."
}

Generate scene analysis with 3-8 scenes depending on content length. Include only the platforms specified by the user. Make all prompts detailed, platform-specific, and immediately usable.`;

async function analyzeVideo(
  anthropic: Anthropic,
  description: string,
  platforms: { video: string[]; music: string[]; editing: string[] }
): Promise<object> {
  const platformList = [
    platforms.video.length ? `Video generation platforms: ${platforms.video.join(', ')}` : '',
    platforms.music.length ? `Music generation platforms: ${platforms.music.join(', ')}` : '',
    platforms.editing.length ? `Video editing platforms: ${platforms.editing.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const userMessage = `Analyze this video and generate all prompts and instructions.

VIDEO DESCRIPTION:
${description}

SELECTED PLATFORMS:
${platformList}

Generate a complete analysis with scene breakdown, platform-specific prompts for each selected platform, SFX breakdown, and cover art prompt. Return only the JSON object.`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = anthropic.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 8000,
    thinking: { type: 'adaptive' } as any,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  });

  const message = await stream.finalMessage();

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  const raw = textBlock.text.trim();
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('Could not parse JSON from response');
  }

  return JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
}

async function main() {
  const anthropic = new Anthropic();
  const app = express();
  app.use(express.json());

  app.post('/api/analyze', upload.single('video'), async (req, res) => {
    try {
      const description = req.body.description as string;
      const platforms = JSON.parse(req.body.platforms as string);

      if (!description?.trim()) {
        res.status(400).json({ error: 'Description is required.' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'Video file is required.' });
        return;
      }

      const result = await analyzeVideo(anthropic, description, platforms);
      res.json(result);
    } catch (err: unknown) {
      console.error('Analysis error:', err);
      const message = err instanceof Error ? err.message : 'Analysis failed';
      res.status(500).json({ error: message });
    }
  });

  if (isDev) {
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, '../vite.config.ts'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, '../dist/public');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main().catch(console.error);
