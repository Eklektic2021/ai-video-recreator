import { useState, useCallback } from 'react';
import type { SceneAnalysis } from '../types';
import {
  getStoredRunwayKey,
  getStoredKlingAccess,
  getStoredKlingSecret,
  getStoredViduKey,
  getStoredGeminiKey,
  generateWithRunway,
  generateWithKling,
  generateWithVidu,
  generateWithVeo,
} from '../lib/videoGen';

type Provider = 'runway' | 'kling' | 'vidu' | 'veo';

interface VideoState {
  url: string | null;
  loading: boolean;
  error: string | null;
}

const PROVIDERS: { id: Provider; label: string; duration: string }[] = [
  { id: 'runway', label: 'Runway Gen-4', duration: '5s' },
  { id: 'kling',  label: 'Kling AI',     duration: '5s' },
  { id: 'vidu',   label: 'Vidu 2.0',     duration: '4s' },
  { id: 'veo',    label: 'Veo 2',        duration: '8s' },
];

function buildPrompt(scene: SceneAnalysis): string {
  return [
    scene.description,
    `Camera: ${scene.cameraWork}`,
    `Lighting: ${scene.lighting}`,
    `Mood: ${scene.mood}`,
  ].join('. ');
}

async function downloadVideo(url: string, sceneNum: number) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `scene-${sceneNum}-video.mp4`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, '_blank');
  }
}

function providerKeyName(p: Provider): string {
  if (p === 'runway') return 'Runway';
  if (p === 'kling') return 'Kling';
  if (p === 'vidu') return 'Vidu';
  return 'Gemini (Veo)';
}

interface Props {
  scenes: SceneAnalysis[];
  generatedImages: Record<number, string>;
  onSwitchToImages: () => void;
}

export default function VideoGenerator({ scenes, generatedImages, onSwitchToImages }: Props) {
  const [provider, setProvider] = useState<Provider>('runway');
  const [videos, setVideos] = useState<Record<number, VideoState>>({});
  const [generatingAll, setGeneratingAll] = useState(false);

  const runwayKey    = getStoredRunwayKey();
  const klingAccess  = getStoredKlingAccess();
  const klingSecret  = getStoredKlingSecret();
  const viduKey      = getStoredViduKey();
  const geminiKey    = getStoredGeminiKey();

  const hasKey =
    provider === 'runway' ? !!runwayKey :
    provider === 'kling'  ? !!(klingAccess && klingSecret) :
    provider === 'vidu'   ? !!viduKey :
    !!geminiKey;

  const selectedDuration = PROVIDERS.find((p) => p.id === provider)?.duration ?? '5s';

  const setVideoState = useCallback((sceneNum: number, update: Partial<VideoState>) => {
    setVideos((prev) => {
      const existing: VideoState = prev[sceneNum] ?? { url: null, loading: false, error: null };
      return { ...prev, [sceneNum]: { ...existing, ...update } };
    });
  }, []);

  const generateOne = useCallback(async (scene: SceneAnalysis) => {
    const imageSource = generatedImages[scene.scene];
    if (!imageSource || !hasKey) return;

    setVideoState(scene.scene, { loading: true, error: null, url: null });
    try {
      const prompt = buildPrompt(scene);
      let url: string;
      if (provider === 'runway') {
        url = await generateWithRunway(imageSource, prompt, runwayKey);
      } else if (provider === 'kling') {
        url = await generateWithKling(imageSource, prompt, klingAccess, klingSecret);
      } else if (provider === 'vidu') {
        url = await generateWithVidu(imageSource, prompt, viduKey);
      } else {
        url = await generateWithVeo(imageSource, prompt, geminiKey);
      }
      setVideoState(scene.scene, { url, loading: false });
    } catch (err) {
      setVideoState(scene.scene, {
        loading: false,
        error: err instanceof Error ? err.message : 'Video generation failed',
      });
    }
  }, [provider, runwayKey, klingAccess, klingSecret, viduKey, geminiKey, hasKey, generatedImages, setVideoState]);

  const generateAll = useCallback(async () => {
    if (!hasKey || generatingAll) return;
    setGeneratingAll(true);
    for (const scene of scenes) {
      if (generatedImages[scene.scene]) {
        await generateOne(scene);
      }
    }
    setGeneratingAll(false);
  }, [hasKey, generatingAll, scenes, generatedImages, generateOne]);

  const scenesWithImages    = scenes.filter((s) => generatedImages[s.scene]);
  const scenesWithoutImages = scenes.filter((s) => !generatedImages[s.scene]);
  const doneCount           = Object.values(videos).filter((v) => v.url).length;

  return (
    <div className="vidgen-section">
      {/* ── Header ── */}
      <div className="vidgen-header">
        <h3 className="vidgen-title">Video Generation</h3>
        <div className="vidgen-controls">
          <div className="vidgen-provider-toggle">
            {PROVIDERS.map(({ id, label }) => (
              <button
                key={id}
                className={`vidgen-provider-btn${provider === id ? ' vidgen-provider-btn--active' : ''}`}
                onClick={() => setProvider(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {hasKey && scenesWithImages.length > 0 && (
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
      {!hasKey && (
        <div className="vidgen-missing-key">
          <span className="vidgen-missing-icon">⚠</span>
          <span>
            No <strong>{providerKeyName(provider)}</strong> API key found. Click the{' '}
            <strong>⚙ API Key</strong> button in the header to add it.
          </span>
        </div>
      )}

      {/* ── Per-scene cards ── */}
      <div className="vidgen-scenes">
        {scenes.map((scene) => {
          const imageUrl  = generatedImages[scene.scene] ?? null;
          const vid       = videos[scene.scene];
          const isLoading = vid?.loading ?? false;
          const videoUrl  = vid?.url ?? null;
          const error     = vid?.error ?? null;
          const hasResult = videoUrl !== null || error !== null;

          return (
            <div key={scene.scene} className="vidgen-scene-card">
              <div className="vidgen-scene-header">
                <div className="vidgen-scene-info">
                  <span className="vidgen-scene-label">Scene {scene.scene}</span>
                  <span className="vidgen-scene-ts">{scene.timestamp}</span>
                  <span className="vidgen-scene-duration">{selectedDuration}</span>
                </div>
                {hasKey && imageUrl && (
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
                    ) : (
                      '▶ Generate Clip'
                    )}
                  </button>
                )}
              </div>

              <div className="vidgen-body">
                {/* Source image thumbnail */}
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

                {/* Video output */}
                <div className="vidgen-output">
                  <p className="vidgen-prompt-preview">{buildPrompt(scene)}</p>

                  {isLoading && (
                    <div className="vidgen-loading-area">
                      <div className="spinner" />
                      <p className="vidgen-loading-text">
                        Generating {selectedDuration} clip… this can take 1–3 minutes
                      </p>
                    </div>
                  )}

                  {!isLoading && videoUrl && (
                    <div className="vidgen-result">
                      <video
                        src={videoUrl}
                        controls
                        className="vidgen-video"
                        preload="metadata"
                      />
                      <div className="vidgen-video-actions">
                        <button
                          className="vidgen-download-btn"
                          onClick={() => downloadVideo(videoUrl, scene.scene)}
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

                  {!isLoading && !videoUrl && !error && imageUrl && hasKey && (
                    <div className="vidgen-empty-state">
                      <span className="vidgen-empty-icon">▶</span>
                      <p className="vidgen-empty-text">
                        Click Generate Clip to create a {selectedDuration} video
                      </p>
                    </div>
                  )}

                  {!isLoading && !videoUrl && !error && imageUrl && !hasKey && (
                    <div className="vidgen-empty-state vidgen-empty-state--warn">
                      <span className="vidgen-empty-icon">⚠</span>
                      <p className="vidgen-empty-text">
                        Add a <strong>{providerKeyName(provider)}</strong> key to generate clips
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
