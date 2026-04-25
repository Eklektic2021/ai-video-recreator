import Anthropic from '@anthropic-ai/sdk';
import type { AnalysisResult, SelectedPlatforms } from '../types';

export const STORAGE_KEY = 'maisuite_anthropic_key';

export function getStoredApiKey(): string {
  return localStorage.getItem(STORAGE_KEY) ?? '';
}

export function saveApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key.trim());
}

export function clearApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

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

export async function runAnalysis(
  apiKey: string,
  description: string,
  platforms: SelectedPlatforms
): Promise<AnalysisResult> {
  const anthropic = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

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

  return JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as AnalysisResult;
}
