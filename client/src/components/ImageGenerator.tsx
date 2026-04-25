import { useState, useCallback } from 'react';
import type { SceneAnalysis } from '../types';
import {
  getStoredOpenAIKey,
  getStoredReplicateKey,
  generateWithDalle,
  generateWithFlux,
} from '../lib/imageGen';

type Provider = 'dalle' | 'flux';

interface ImageState {
  url: string | null;
  loading: boolean;
  error: string | null;
}

function buildPrompt(scene: SceneAnalysis): string {
  return [
    scene.description,
    `Camera: ${scene.cameraWork}`,
    `Lighting: ${scene.lighting}`,
    `Mood: ${scene.mood}`,
    scene.keyElements.length ? `Key elements: ${scene.keyElements.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('. ');
}

async function downloadImage(url: string, sceneNum: number) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `scene-${sceneNum}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, '_blank');
  }
}

export default function ImageGenerator({ scenes }: { scenes: SceneAnalysis[] }) {
  const [provider, setProvider] = useState<Provider>('dalle');
  const [images, setImages] = useState<Record<number, ImageState>>({});
  const [generatingAll, setGeneratingAll] = useState(false);

  const openaiKey = getStoredOpenAIKey();
  const replicateKey = getStoredReplicateKey();
  const activeKey = provider === 'dalle' ? openaiKey : replicateKey;
  const missingKey = !activeKey;

  const setImageState = useCallback((sceneNum: number, update: Partial<ImageState>) => {
    setImages((prev) => {
      const existing: ImageState = prev[sceneNum] ?? { url: null, loading: false, error: null };
      return { ...prev, [sceneNum]: { ...existing, ...update } };
    });
  }, []);

  const generateOne = useCallback(
    async (scene: SceneAnalysis) => {
      const key = provider === 'dalle' ? openaiKey : replicateKey;
      if (!key) return;
      setImageState(scene.scene, { loading: true, error: null, url: null });
      try {
        const prompt = buildPrompt(scene);
        const url =
          provider === 'dalle'
            ? await generateWithDalle(key, prompt)
            : await generateWithFlux(key, prompt);
        setImageState(scene.scene, { url, loading: false });
      } catch (err) {
        setImageState(scene.scene, {
          loading: false,
          error: err instanceof Error ? err.message : 'Generation failed',
        });
      }
    },
    [provider, openaiKey, replicateKey, setImageState]
  );

  const generateAll = useCallback(async () => {
    if (missingKey || generatingAll) return;
    setGeneratingAll(true);
    for (const scene of scenes) {
      await generateOne(scene);
    }
    setGeneratingAll(false);
  }, [missingKey, generatingAll, scenes, generateOne]);

  return (
    <div className="imggen-section">
      {/* ── Header ── */}
      <div className="imggen-header">
        <h3 className="imggen-title">Image Generation</h3>
        <div className="imggen-controls">
          <div className="imggen-provider-toggle">
            <button
              className={`imggen-provider-btn${provider === 'dalle' ? ' imggen-provider-btn--active' : ''}`}
              onClick={() => setProvider('dalle')}
            >
              DALL·E 3 (OpenAI)
            </button>
            <button
              className={`imggen-provider-btn${provider === 'flux' ? ' imggen-provider-btn--active' : ''}`}
              onClick={() => setProvider('flux')}
            >
              FLUX Schnell (Replicate)
            </button>
          </div>

          {!missingKey && (
            <button
              className="imggen-all-btn"
              onClick={generateAll}
              disabled={generatingAll}
            >
              {generatingAll
                ? `Generating… (${Object.values(images).filter((i) => i.url).length}/${scenes.length})`
                : `Generate All ${scenes.length} Scenes`}
            </button>
          )}
        </div>
      </div>

      {/* ── Missing key notice ── */}
      {missingKey && (
        <div className="imggen-missing-key">
          <span className="imggen-missing-icon">⚠</span>
          <span>
            No {provider === 'dalle' ? 'OpenAI' : 'Replicate'} API key found. Click the{' '}
            <strong>⚙ API Key</strong> button in the header to add it.
          </span>
        </div>
      )}

      {/* ── Per-scene cards ── */}
      <div className="imggen-scenes">
        {scenes.map((scene) => {
          const img = images[scene.scene];
          const isLoading = img?.loading ?? false;
          const url = img?.url ?? null;
          const error = img?.error ?? null;
          const hasResult = url !== null || error !== null;

          return (
            <div key={scene.scene} className="imggen-scene-card">
              <div className="imggen-scene-header">
                <div className="imggen-scene-info">
                  <span className="imggen-scene-label">Scene {scene.scene}</span>
                  <span className="imggen-scene-ts">{scene.timestamp}</span>
                </div>
                {!missingKey && (
                  <button
                    className="imggen-generate-btn"
                    onClick={() => generateOne(scene)}
                    disabled={isLoading || generatingAll}
                  >
                    {isLoading ? (
                      <>
                        <span className="imggen-btn-spinner" />
                        Generating…
                      </>
                    ) : hasResult ? (
                      '↺ Regenerate'
                    ) : (
                      '✦ Generate'
                    )}
                  </button>
                )}
              </div>

              <p className="imggen-prompt-preview">{buildPrompt(scene)}</p>

              {isLoading && (
                <div className="imggen-loading-area">
                  <div className="spinner" />
                  <p className="imggen-loading-text">Generating image…</p>
                </div>
              )}

              {!isLoading && url && (
                <div className="imggen-result">
                  <img src={url} alt={`Scene ${scene.scene}`} className="imggen-image" />
                  <div className="imggen-image-actions">
                    <button
                      className="imggen-download-btn"
                      onClick={() => downloadImage(url, scene.scene)}
                    >
                      ↓ Download
                    </button>
                    <button
                      className="imggen-regen-btn"
                      onClick={() => generateOne(scene)}
                      disabled={generatingAll}
                    >
                      ↺ Regenerate
                    </button>
                  </div>
                </div>
              )}

              {!isLoading && error && (
                <div className="imggen-error">
                  <span>⚠ {error}</span>
                  <button
                    className="imggen-retry-btn"
                    onClick={() => generateOne(scene)}
                    disabled={generatingAll}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
