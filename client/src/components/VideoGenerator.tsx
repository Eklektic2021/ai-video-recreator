import { useState, useCallback } from 'react';
import type { SceneAnalysis } from '../types';
import {
  getStoredKieKey,
  getStoredFalKey,
  getStoredGeminiKey,
  getStoredVideoReplicateKey,
  getStoredKlingKey,
  generateWithRunwayAleph,
  generateWithKling2,
  generateWithKling2Native,
  generateWithKling3AudioKie,
  generateWithKling3AudioFal,
  generateWithKling3AudioNative,
  generateWithVeoFast,
  generateWithVeoFull,
  generateWithVeoDirect,
  generateWithFluxFal,
  generateWithFluxReplicate,
} from '../lib/videoGen';

type Provider =
  | 'runway-aleph'
  | 'kling-2'
  | 'kling-3-audio'
  | 'veo-fast'
  | 'veo-full'
  | 'veo-direct'
  | 'flux-dev';

interface VideoState {
  url: string | null;
  loading: boolean;
  error: string | null;
  isImage: boolean;
}

interface ProviderDef {
  id: Provider;
  label: string;
  getBadge: (falKey: string, replicateKey: string, klingKey: string) => string;
  isAvailable: (kie: string, fal: string, gemini: string, replicate: string, kling: string) => boolean;
  hideIfNoKey?: boolean;
  durations: number[];
  fixedDuration?: number;
  noKeyMsg: string;
  isImage?: boolean;
}

const PROVIDER_DEFS: ProviderDef[] = [
  {
    id: 'runway-aleph',
    label: 'Runway Aleph',
    getBadge: () => 'KIE',
    isAvailable: (kie) => !!kie,
    durations: [],
    noKeyMsg: 'Add your KIE AI API key to use Runway Aleph',
  },
  {
    id: 'kling-2',
    label: 'Kling 2.1',
    getBadge: (_f, _r, kling) => (kling ? 'Kling' : 'KIE'),
    isAvailable: (kie, _f, _g, _r, kling) => !!(kie || kling),
    durations: [5, 10],
    noKeyMsg: 'Add your Kling AI or KIE AI API key to use Kling 2.1',
  },
  {
    id: 'kling-3-audio',
    label: 'Kling 3.0 🎙️',
    getBadge: (fal, _r, kling) => (kling ? 'Kling' : fal ? 'fal.ai' : 'KIE'),
    isAvailable: (kie, fal, _g, _r, kling) => !!(kie || fal || kling),
    durations: [5, 10],
    noKeyMsg: 'Add your Kling AI, KIE AI, or fal.ai API key to use Kling 3.0',
  },
  {
    id: 'veo-fast',
    label: 'Veo 3.1 Fast',
    getBadge: () => 'KIE',
    isAvailable: (kie) => !!kie,
    durations: [],
    fixedDuration: 8,
    noKeyMsg: 'Add your KIE AI API key to use Veo 3.1 Fast',
  },
  {
    id: 'veo-full',
    label: 'Veo 3.1 🎙️',
    getBadge: () => 'KIE',
    isAvailable: (kie) => !!kie,
    durations: [],
    fixedDuration: 8,
    noKeyMsg: 'Add your KIE AI API key to use Veo 3.1',
  },
  {
    id: 'veo-direct',
    label: 'Veo 3.1 Direct',
    getBadge: () => 'Gemini',
    isAvailable: (_kie, _fal, gemini) => !!gemini,
    hideIfNoKey: true,
    durations: [],
    fixedDuration: 8,
    noKeyMsg: 'Add your Google Gemini API key to use Veo 3.1 Direct',
  },
  {
    id: 'flux-dev',
    label: 'FLUX Dev',
    getBadge: (fal, replicate) => (fal ? 'fal.ai' : replicate ? 'Replicate' : 'fal.ai'),
    isAvailable: (_kie, fal, _gemini, replicate) => !!(fal || replicate),
    durations: [],
    isImage: true,
    noKeyMsg: 'Add your fal.ai or Replicate API key to use FLUX Dev',
  },
];

const BADGE_CLASSES: Record<string, string> = {
  KIE: 'vidgen-badge--kie',
  'fal.ai': 'vidgen-badge--fal',
  Gemini: 'vidgen-badge--gemini',
  Replicate: 'vidgen-badge--replicate',
};

type AspectRatio = '16:9' | '9:16' | '1:1';
type Platform = 'tiktok' | 'instagram' | 'youtube-shorts' | 'youtube' | 'facebook' | 'linkedin';

const ASPECT_RATIOS: { id: AspectRatio; label: string }[] = [
  { id: '16:9', label: '16:9  Landscape' },
  { id: '9:16', label: '9:16  Vertical' },
  { id: '1:1', label: '1:1  Square' },
];

const PLATFORMS: { id: Platform; label: string; ratio: AspectRatio; directive: string }[] = [
  { id: 'tiktok', label: 'TikTok', ratio: '9:16', directive: 'Vertical format, fast-paced, engaging first 3 seconds, optimized for mobile viewing.' },
  { id: 'instagram', label: 'Instagram Reels', ratio: '9:16', directive: 'Vertical format, visually striking, cinematic quality, mobile-first.' },
  { id: 'youtube-shorts', label: 'YouTube Shorts', ratio: '9:16', directive: 'Vertical format, quick hook in first 2 seconds, energetic pacing.' },
  { id: 'youtube', label: 'YouTube', ratio: '16:9', directive: 'Landscape format, cinematic quality, high production value.' },
  { id: 'facebook', label: 'Facebook', ratio: '16:9', directive: 'Landscape format, clear visuals, broad audience appeal.' },
  { id: 'linkedin', label: 'LinkedIn', ratio: '1:1', directive: 'Square format, professional tone, clean visuals.' },
];

function buildPrompt(scene: SceneAnalysis): string {
  const bg = scene.keyElements.length
    ? scene.keyElements.join(', ')
    : 'cinematic environment matching scene context';
  return [
    `FOREGROUND: ${scene.description}`,
    `BACKGROUND: ${bg}`,
    `CAMERA: ${scene.cameraWork}`,
    `LIGHTING: ${scene.lighting}. Mood: ${scene.mood}`,
  ].join('\n');
}

function hasDialogue(text: string): boolean {
  if (/\b(says?|said|speaks?|spoke|tells?|told|whispers?|shouts?|shout|cries?|calls?|replies?|asks?|asked|answers?|answered|mutters?|exclaims?|announces?|declares?)\b/i.test(text)) return true;
  if (/"[^"]{10,}"/.test(text) || /“[^"]{10,}”/.test(text)) return true;
  return false;
}

async function downloadMedia(url: string, sceneNum: number, isImage: boolean) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `scene-${sceneNum}-${isImage ? 'image.png' : 'video.mp4'}`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, '_blank');
  }
}

const AUDIO_CAPABLE: Provider[] = ['kling-3-audio', 'veo-full', 'veo-direct'];

interface Props {
  scenes: SceneAnalysis[];
  generatedImages: Record<number, string>;
  onSwitchToImages: () => void;
}

export default function VideoGenerator({ scenes, generatedImages, onSwitchToImages }: Props) {
  const [provider, setProvider] = useState<Provider>('runway-aleph');
  const [duration, setDuration] = useState<number>(5);
  const [videos, setVideos] = useState<Record<number, VideoState>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [forceAudio, setForceAudio] = useState<Record<number, boolean>>({});
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [platform, setPlatform] = useState<Platform | null>(null);

  const kieKey = getStoredKieKey();
  const falKey = getStoredFalKey();
  const geminiKey = getStoredGeminiKey();
  const videoReplicateKey = getStoredVideoReplicateKey();
  const klingKey = getStoredKlingKey();

  const visibleProviders = PROVIDER_DEFS.filter(
    (def) => !def.hideIfNoKey || def.isAvailable(kieKey, falKey, geminiKey, videoReplicateKey, klingKey)
  );

  const currentDef = PROVIDER_DEFS.find((d) => d.id === provider)!;
  const hasAnyKey = !!(kieKey || falKey || geminiKey || videoReplicateKey || klingKey);

  const handleProviderChange = (p: Provider) => {
    const def = PROVIDER_DEFS.find((d) => d.id === p)!;
    if (!def.isAvailable(kieKey, falKey, geminiKey, videoReplicateKey, klingKey)) return;
    setProvider(p);
    if (def.durations.length > 0) setDuration(def.durations[0]);
  };

  const handlePlatformSelect = (p: Platform) => {
    const found = PLATFORMS.find((pl) => pl.id === p);
    if (found) { setPlatform(p); setAspectRatio(found.ratio); }
  };

  const setVideoState = useCallback((sceneNum: number, update: Partial<VideoState>) => {
    setVideos((prev) => {
      const existing: VideoState = prev[sceneNum] ?? { url: null, loading: false, error: null, isImage: false };
      return { ...prev, [sceneNum]: { ...existing, ...update } };
    });
  }, []);

  const generateOne = useCallback(async (scene: SceneAnalysis) => {
    const imageSource = generatedImages[scene.scene];
    if (!imageSource) return;

    const rawPrompt = buildPrompt(scene);
    const platformEntry = platform ? PLATFORMS.find((p) => p.id === platform) : null;
    const prompt = platformEntry ? `${rawPrompt}. ${platformEntry.directive}` : rawPrompt;

    const needsAudio = hasDialogue(rawPrompt) || (forceAudio[scene.scene] ?? false);
    const effectiveProvider: Provider =
      needsAudio && !AUDIO_CAPABLE.includes(provider) && kieKey ? 'veo-full' : provider;

    const def = PROVIDER_DEFS.find((d) => d.id === effectiveProvider)!;
    if (!def.isAvailable(kieKey, falKey, geminiKey, videoReplicateKey, klingKey)) return;

    setVideoState(scene.scene, { loading: true, error: null, url: null, isImage: false });
    try {
      let url: string;
      switch (effectiveProvider) {
        case 'runway-aleph':
          url = await generateWithRunwayAleph(imageSource, prompt, kieKey, aspectRatio);
          break;
        case 'kling-2':
          url = klingKey
            ? await generateWithKling2Native(imageSource, prompt, klingKey, duration, aspectRatio)
            : await generateWithKling2(imageSource, prompt, kieKey, duration, aspectRatio);
          break;
        case 'kling-3-audio':
          url = klingKey
            ? await generateWithKling3AudioNative(imageSource, prompt, klingKey, duration, aspectRatio)
            : falKey
            ? await generateWithKling3AudioFal(imageSource, prompt, falKey, duration, aspectRatio)
            : await generateWithKling3AudioKie(imageSource, prompt, kieKey, duration, aspectRatio);
          break;
        case 'veo-fast':
          url = await generateWithVeoFast(imageSource, prompt, kieKey, aspectRatio);
          break;
        case 'veo-full':
          url = await generateWithVeoFull(imageSource, prompt, kieKey, aspectRatio);
          break;
        case 'veo-direct':
          url = await generateWithVeoDirect(imageSource, prompt, geminiKey, aspectRatio);
          break;
        case 'flux-dev':
          url = falKey
            ? await generateWithFluxFal(imageSource, prompt, falKey)
            : await generateWithFluxReplicate(imageSource, prompt, videoReplicateKey);
          break;
        default:
          throw new Error('Unknown provider');
      }
      setVideoState(scene.scene, { url, loading: false, isImage: def.isImage ?? false });
    } catch (err) {
      setVideoState(scene.scene, {
        loading: false,
        error: err instanceof Error ? err.message : 'Generation failed',
      });
    }
  }, [provider, duration, kieKey, falKey, geminiKey, videoReplicateKey, klingKey, generatedImages, setVideoState, forceAudio, platform, aspectRatio]);

  const generateAll = useCallback(async () => {
    if (!hasAnyKey || generatingAll) return;
    setGeneratingAll(true);
    for (const scene of scenes) {
      if (generatedImages[scene.scene]) await generateOne(scene);
    }
    setGeneratingAll(false);
  }, [hasAnyKey, generatingAll, scenes, generatedImages, generateOne]);

  const scenesWithImages = scenes.filter((s) => generatedImages[s.scene]);
  const scenesWithoutImages = scenes.filter((s) => !generatedImages[s.scene]);
  const doneCount = Object.values(videos).filter((v) => v.url).length;
  const platformLabel = platform ? (PLATFORMS.find((p) => p.id === platform)?.label ?? null) : null;

  return (
    <div className="vidgen-section">
      {/* ── Header ── */}
      <div className="vidgen-header">
        <h3 className="vidgen-title">Video Generation</h3>
        <div className="vidgen-controls">
          <div className="vidgen-provider-toggle">
            {visibleProviders.map((def) => {
              const available = def.isAvailable(kieKey, falKey, geminiKey, videoReplicateKey, klingKey);
              const badge = def.getBadge(falKey, videoReplicateKey, klingKey);
              return (
                <button
                  key={def.id}
                  className={`vidgen-provider-btn${provider === def.id ? ' vidgen-provider-btn--active' : ''}${!available ? ' vidgen-provider-btn--disabled' : ''}`}
                  onClick={() => handleProviderChange(def.id)}
                  disabled={!available}
                  title={!available ? def.noKeyMsg : undefined}
                >
                  {def.label}
                  <span className={`vidgen-badge ${BADGE_CLASSES[badge] ?? ''}`}>{badge}</span>
                </button>
              );
            })}
          </div>

          {hasAnyKey && scenesWithImages.length > 0 && (
            <button
              className="vidgen-all-btn"
              onClick={generateAll}
              disabled={generatingAll}
            >
              {generatingAll
                ? `Generating… (${doneCount}/${scenesWithImages.length})`
                : `Generate All ${scenesWithImages.length} Clips`}
            </button>
          )}
        </div>
      </div>

      {/* ── Duration selector ── */}
      {(currentDef.durations.length > 0 || currentDef.fixedDuration !== undefined) && (
        <div className="vidgen-duration-row">
          <span className="vidgen-duration-label">Clip Duration</span>
          {currentDef.durations.length === 0 ? (
            <span className="vidgen-duration-badge">{currentDef.fixedDuration}s</span>
          ) : (
            <div className="vidgen-duration-pills">
              {currentDef.durations.map((d) => (
                <button
                  key={d}
                  className={`vidgen-duration-btn${duration === d ? ' vidgen-duration-btn--active' : ''}`}
                  onClick={() => setDuration(d)}
                >
                  {d}s
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Aspect ratio selector ── */}
      <div className="vidgen-aspect-row">
        <span className="vidgen-aspect-label">Aspect Ratio</span>
        <div className="vidgen-aspect-pills">
          {ASPECT_RATIOS.map(({ id, label }) => (
            <button
              key={id}
              className={`vidgen-aspect-btn${aspectRatio === id ? ' vidgen-aspect-btn--active' : ''}`}
              onClick={() => setAspectRatio(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Platform selector ── */}
      <div className="vidgen-platform-row">
        <span className="vidgen-platform-label">Publishing To</span>
        <div className="vidgen-platform-pills">
          {PLATFORMS.map(({ id, label }) => (
            <button
              key={id}
              className={`vidgen-platform-btn${platform === id ? ' vidgen-platform-btn--active' : ''}`}
              onClick={() => handlePlatformSelect(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── No images notice ── */}
      {scenesWithoutImages.length > 0 && (
        <div className="vidgen-notice">
          <span className="vidgen-notice-icon">ℹ</span>
          <span>
            {scenesWithImages.length === 0
              ? 'Generate scene images first — video clips are created from your generated images.'
              : `${scenesWithoutImages.length} scene${scenesWithoutImages.length > 1 ? 's' : ''} still need images.`}
            {' '}
            <button className="vidgen-notice-link" onClick={onSwitchToImages}>
              Go to Image Gen ↗
            </button>
          </span>
        </div>
      )}

      {/* ── Missing key warning ── */}
      {!hasAnyKey && (
        <div className="vidgen-missing-key">
          <span className="vidgen-missing-icon">⚠</span>
          <span>
            Add a <strong>KIE AI</strong>, <strong>fal.ai</strong>, or <strong>Gemini</strong> API key in settings to generate videos.{' '}
            <a href="https://kie.ai/dashboard/keys" target="_blank" rel="noreferrer" className="vidgen-notice-link">
              Get KIE AI key ↗
            </a>
          </span>
        </div>
      )}

      {/* ── Per-scene cards ── */}
      <div className="vidgen-scenes">
        {scenes.map((scene) => {
          const imageUrl = generatedImages[scene.scene] ?? null;
          const vid = videos[scene.scene];
          const isLoading = vid?.loading ?? false;
          const mediaUrl = vid?.url ?? null;
          const isImage = vid?.isImage ?? false;
          const error = vid?.error ?? null;
          const hasResult = mediaUrl !== null || error !== null;
          const scenePrompt = buildPrompt(scene);
          const autoDialogue = hasDialogue(scenePrompt);
          const needsAudio = autoDialogue || (forceAudio[scene.scene] ?? false);
          const effectiveProvider: Provider =
            needsAudio && !AUDIO_CAPABLE.includes(provider) && kieKey ? 'veo-full' : provider;
          const effectiveDef = PROVIDER_DEFS.find((d) => d.id === effectiveProvider)!;
          const effectiveDuration = effectiveDef.fixedDuration ?? duration;
          const canGenerate = !!imageUrl && effectiveDef.isAvailable(kieKey, falKey, geminiKey, videoReplicateKey, klingKey);

          return (
            <div key={scene.scene} className="vidgen-scene-card">
              <div className="vidgen-scene-header">
                <div className="vidgen-scene-info">
                  <span className="vidgen-scene-label">Scene {scene.scene}</span>
                  <span className="vidgen-scene-ts">{scene.timestamp}</span>
                  {!effectiveDef.isImage && (
                    <span className="vidgen-scene-duration">{effectiveDuration}s</span>
                  )}
                  <label className="vidgen-force-audio-wrap">
                    <input
                      type="checkbox"
                      checked={forceAudio[scene.scene] ?? false}
                      onChange={(e) =>
                        setForceAudio((prev) => ({ ...prev, [scene.scene]: e.target.checked }))
                      }
                    />
                    <span>Force Audio</span>
                  </label>
                </div>
                {canGenerate && (
                  <button
                    className="vidgen-generate-btn"
                    onClick={() => generateOne(scene)}
                    disabled={isLoading || generatingAll}
                  >
                    {isLoading ? (
                      <>
                        <span className="vidgen-btn-spinner" />
                        Generating…
                      </>
                    ) : hasResult ? (
                      '↺ Regenerate'
                    ) : effectiveDef.isImage ? (
                      '▶ Generate Image'
                    ) : (
                      '▶ Generate Clip'
                    )}
                  </button>
                )}
              </div>

              {needsAudio && !AUDIO_CAPABLE.includes(provider) && (
                <div className="vidgen-dialogue-notice">
                  🎙️ {autoDialogue ? 'Dialogue detected' : 'Audio forced'} — using Veo 3.1 for native audio
                </div>
              )}

              <div className="vidgen-body">
                <div className="vidgen-source">
                  {imageUrl ? (
                    <img src={imageUrl} alt={`Scene ${scene.scene} reference`} className="vidgen-thumb" />
                  ) : (
                    <div className="vidgen-thumb-empty">
                      <span className="vidgen-thumb-icon">🖼</span>
                      <span className="vidgen-thumb-label">No image yet</span>
                      <button className="vidgen-thumb-link" onClick={onSwitchToImages}>
                        Generate →
                      </button>
                    </div>
                  )}
                </div>

                <div className="vidgen-output">
                  <p className="vidgen-prompt-preview">{scenePrompt}</p>

                  {isLoading && (
                    <div className="vidgen-loading-area">
                      <div className="spinner" />
                      <p className="vidgen-loading-text">
                        {effectiveDef.isImage
                          ? 'Generating image… this can take 30–60 seconds'
                          : needsAudio && !AUDIO_CAPABLE.includes(provider)
                          ? `Generating Veo 3.1 audio clip${platformLabel ? ` for ${platformLabel}` : ''}… this can take 2–4 minutes`
                          : `Generating ${effectiveDuration}s clip${platformLabel ? ` for ${platformLabel}` : ''}… this can take 1–3 minutes`}
                      </p>
                    </div>
                  )}

                  {!isLoading && mediaUrl && (
                    <div className="vidgen-result">
                      {isImage ? (
                        <img
                          src={mediaUrl}
                          alt={`Scene ${scene.scene} result`}
                          className="vidgen-video"
                          style={{ objectFit: 'contain' }}
                        />
                      ) : (
                        <video src={mediaUrl} controls className="vidgen-video" preload="metadata" />
                      )}
                      <div className="vidgen-video-actions">
                        <button
                          className="vidgen-download-btn"
                          onClick={() => downloadMedia(mediaUrl, scene.scene, isImage)}
                        >
                          ↓ Download
                        </button>
                        <button
                          className="vidgen-regen-btn"
                          onClick={() => generateOne(scene)}
                          disabled={generatingAll}
                        >
                          ↺ Regenerate
                        </button>
                      </div>
                    </div>
                  )}

                  {!isLoading && error && (
                    <div className="vidgen-error">
                      <span>⚠ {error}</span>
                      <button
                        className="vidgen-retry-btn"
                        onClick={() => generateOne(scene)}
                        disabled={generatingAll}
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {!isLoading && !mediaUrl && !error && imageUrl && canGenerate && (
                    <div className="vidgen-empty-state">
                      <span className="vidgen-empty-icon">▶</span>
                      <p className="vidgen-empty-text">
                        Click Generate {effectiveDef.isImage ? 'Image' : 'Clip'} to create
                        {!effectiveDef.isImage && ` a ${effectiveDuration}s`}
                        {platformLabel ? ` ${platformLabel}` : ''} {effectiveDef.isImage ? 'image' : 'video'}
                      </p>
                    </div>
                  )}

                  {!isLoading && !mediaUrl && !error && imageUrl && !canGenerate && (
                    <div className="vidgen-empty-state vidgen-empty-state--warn">
                      <span className="vidgen-empty-icon">⚠</span>
                      <p className="vidgen-empty-text">{effectiveDef.noKeyMsg}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Audio providers note ── */}
      <div className="vidgen-audio-banner">
        🎙️ <strong>Kling 3.0</strong> and <strong>Veo 3.1</strong> generate native audio — dialogue, ambient sound, and music.
      </div>
    </div>
  );
}
