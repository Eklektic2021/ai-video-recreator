import { useState, useCallback, useRef } from 'react';
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

const MAX_REFS = 3;
const ACCEPTED = 'image/jpeg,image/png,image/webp';

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

interface Props {
  scenes: SceneAnalysis[];
  onImageGenerated?: (sceneNum: number, url: string) => void;
}

export default function ImageGenerator({ scenes, onImageGenerated }: Props) {
  const [provider, setProvider] = useState<Provider>('dalle');
  const [refImages, setRefImages] = useState<string[]>([]);
  const [images, setImages] = useState<Record<number, ImageState>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openaiKey = getStoredOpenAIKey();
  const replicateKey = getStoredReplicateKey();
  const activeKey = provider === 'dalle' ? openaiKey : replicateKey;
  const missingKey = !activeKey;

  const handleRefUpload = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_REFS - refImages.length;
    if (remaining <= 0) return;
    const toAdd = Array.from(files).slice(0, remaining);
    const encoded = await Promise.all(toAdd.map(fileToBase64));
    setRefImages((prev) => [...prev, ...encoded].slice(0, MAX_REFS));
  }, [refImages.length]);

  const removeRef = useCallback((idx: number) => {
    setRefImages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

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
            ? await generateWithDalle(key, prompt, refImages)
            : await generateWithFlux(key, prompt, refImages);
        setImageState(scene.scene, { url, loading: false });
        onImageGenerated?.(scene.scene, url);
      } catch (err) {
        setImageState(scene.scene, {
          loading: false,
          error: err instanceof Error ? err.message : 'Generation failed',
        });
      }
    },
    [provider, openaiKey, replicateKey, refImages, setImageState]
  );

  const generateAll = useCallback(async () => {
    if (missingKey || generatingAll) return;
    setGeneratingAll(true);
    for (const scene of scenes) {
      await generateOne(scene);
    }
    setGeneratingAll(false);
  }, [missingKey, generatingAll, scenes, generateOne]);

  const hasRefs = refImages.length > 0;

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
              gpt-image-1 (OpenAI)
            </button>
            <button
              className={`imggen-provider-btn${provider === 'flux' ? ' imggen-provider-btn--active' : ''}`}
              onClick={() => setProvider('flux')}
            >
              {hasRefs ? 'FLUX Redux (Replicate)' : 'FLUX Schnell (Replicate)'}
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

      {/* ── Reference image upload ── */}
      <div className="imggen-ref-section">
        <div className="imggen-ref-header">
          <span className="imggen-ref-label">Character &amp; Scene Reference</span>
          <span className="imggen-ref-count">{refImages.length}/{MAX_REFS}</span>
        </div>
        <p className="imggen-ref-desc">
          Upload reference images to maintain character consistency across all scenes
        </p>

        <div className="imggen-ref-row">
          {refImages.map((src, idx) => (
            <div key={idx} className="imggen-ref-thumb">
              <img src={src} alt={`Reference ${idx + 1}`} className="imggen-ref-img" />
              <button
                className="imggen-ref-remove"
                onClick={() => removeRef(idx)}
                aria-label={`Remove reference image ${idx + 1}`}
              >
                ×
              </button>
            </div>
          ))}

          {refImages.length < MAX_REFS && (
            <button
              className="imggen-ref-add"
              onClick={() => fileInputRef.current?.click()}
              title="Add reference image"
            >
              <span className="imggen-ref-plus">+</span>
              <span className="imggen-ref-add-label">Add image</span>
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            handleRefUpload(e.target.files);
            e.target.value = '';
          }}
        />

        <p className="imggen-ref-note">
          OpenAI uses <strong>gpt-image-1</strong> for reference consistency.
          Replicate uses <strong>FLUX Redux</strong> when references are provided, FLUX Schnell otherwise.
        </p>
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
