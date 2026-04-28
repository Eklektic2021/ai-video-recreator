import Anthropic from '@anthropic-ai/sdk';
import type { AnalysisResult, SelectedPlatforms } from '../types';

export const STORAGE_KEY = 'maisuite_anthropic_key';

export function getStoredApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveApiKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key.trim());
  } catch {
    // localStorage unavailable — key won't persist but app still works
  }
}

export function clearApiKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
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
  "coverArtPrompt": "...",
  "remixIdeas": [
    {
      "title": "...",
      "concept": "...",
      "style": "...",
      "mood": "..."
    }
  ]
}

Generate scene analysis with 3-8 scenes depending on content length. Include only the platforms specified by the user. Make all prompts detailed, platform-specific, and immediately usable. Always include exactly 5 remixIdeas — creative variations of the original content with different scenes, styles, visual concepts, or moods that could inspire a fresh recreation.`;

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function sanitizeScene(raw: unknown): AnalysisResult['sceneAnalysis'][number] {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    scene: typeof s.scene === 'number' ? s.scene : 0,
    timestamp: str(s.timestamp),
    description: str(s.description),
    cameraWork: str(s.cameraWork),
    lighting: str(s.lighting),
    mood: str(s.mood),
    keyElements: Array.isArray(s.keyElements)
      ? (s.keyElements as unknown[]).map((e) => str(e))
      : [],
  };
}

function sanitizeSFX(raw: unknown): AnalysisResult['sfxBreakdown'][number] {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    timestamp: str(s.timestamp),
    sound: str(s.sound),
    type: str(s.type, 'ambient'),
    intensity: str(s.intensity, 'Medium'),
    notes: str(s.notes),
  };
}

function sanitizeRemixIdea(raw: unknown): NonNullable<AnalysisResult['remixIdeas']>[number] {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    title: str(r.title),
    concept: str(r.concept),
    style: str(r.style),
    mood: str(r.mood),
  };
}

function sanitizeAnalysisResult(raw: unknown): AnalysisResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Response is not an object (got ${typeof raw})`);
  }

  const r = raw as Record<string, unknown>;

  const sceneAnalysis = Array.isArray(r.sceneAnalysis)
    ? r.sceneAnalysis.map(sanitizeScene)
    : [];
  const sfxBreakdown = Array.isArray(r.sfxBreakdown)
    ? r.sfxBreakdown.map(sanitizeSFX)
    : [];
  const remixIdeas = Array.isArray(r.remixIdeas)
    ? r.remixIdeas.map(sanitizeRemixIdea)
    : [];
  const videoPlatformPrompts =
    r.videoPlatformPrompts && typeof r.videoPlatformPrompts === 'object' && !Array.isArray(r.videoPlatformPrompts)
      ? r.videoPlatformPrompts as AnalysisResult['videoPlatformPrompts']
      : {};
  const musicPrompts =
    r.musicPrompts && typeof r.musicPrompts === 'object' && !Array.isArray(r.musicPrompts)
      ? r.musicPrompts as AnalysisResult['musicPrompts']
      : {};
  const editingInstructions =
    r.editingInstructions && typeof r.editingInstructions === 'object' && !Array.isArray(r.editingInstructions)
      ? r.editingInstructions as AnalysisResult['editingInstructions']
      : {};
  const coverArtPrompt = str(r.coverArtPrompt);

  if (sceneAnalysis.length === 0) console.warn('[runAnalysis] sceneAnalysis is empty after sanitization');
  if (sfxBreakdown.length === 0) console.warn('[runAnalysis] sfxBreakdown is empty after sanitization');

  return { sceneAnalysis, videoPlatformPrompts, musicPrompts, editingInstructions, sfxBreakdown, coverArtPrompt, remixIdeas };
}

export async function runAnalysis(
  apiKey: string,
  description: string,
  platforms: SelectedPlatforms
): Promise<AnalysisResult> {
  console.log('[runAnalysis] Starting — description length:', description.length, '| platforms:', JSON.stringify(platforms));

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

  console.log('[runAnalysis] Sending request to Claude (model: claude-opus-4-7, max_tokens: 8000)');

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
  console.log('[runAnalysis] Got response — stop_reason:', message.stop_reason, '| content blocks:', message.content.length);
  console.log('[runAnalysis] Content block types:', message.content.map((b) => b.type).join(', '));

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    console.error('[runAnalysis] No text block found. Full content:', JSON.stringify(message.content.map((b) => ({ type: b.type }))));
    throw new Error('Claude returned no text in its response. Check your API key and try again.');
  }

  const raw = textBlock.text.trim();
  console.log('[runAnalysis] Raw text length:', raw.length);
  console.log('[runAnalysis] Raw text preview:', raw.slice(0, 300));

  if (!raw) {
    throw new Error('Claude returned an empty text response.');
  }

  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    console.error('[runAnalysis] No JSON braces found in response:', raw.slice(0, 500));
    throw new Error('Claude\'s response did not contain a JSON object. The response may have been cut off or malformed.');
  }

  const jsonStr = raw.slice(jsonStart, jsonEnd + 1);
  console.log('[runAnalysis] Extracted JSON length:', jsonStr.length);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    console.error('[runAnalysis] JSON.parse failed:', e);
    console.error('[runAnalysis] Problematic JSON (first 600 chars):', jsonStr.slice(0, 600));
    throw new Error(`Could not parse Claude's response as JSON: ${e instanceof Error ? e.message : String(e)}`);
  }

  console.log('[runAnalysis] JSON parsed successfully');

  const result = sanitizeAnalysisResult(parsed);
  console.log('[runAnalysis] Sanitization complete — scenes:', result.sceneAnalysis.length, '| sfx:', result.sfxBreakdown.length, '| remixIdeas:', result.remixIdeas?.length ?? 0);

  return result;
}
