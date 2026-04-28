import { useState } from 'react';
import type { SceneAnalysis } from '../types';
import { getStoredKieKey } from '../lib/videoGen';

type Model = 'V4' | 'V4.5Plus';

interface Props {
  scenes: SceneAnalysis[];
  description: string;
}

function buildSunoPrompt(scenes: SceneAnalysis[], description: string): string {
  const moods = [...new Set(scenes.map((s) => s.mood).filter(Boolean))].slice(0, 4);
  const moodText = moods.length > 0 ? moods.join(', ') : 'cinematic, emotional';
  const descSnippet = description.trim().slice(0, 120);
  return `${descSnippet ? descSnippet + '. ' : ''}${moodText} cinematic background music`;
}

export default function MusicGen({ scenes, description }: Props) {
  const [prompt, setPrompt] = useState(() => buildSunoPrompt(scenes, description));
  const [model, setModel] = useState<Model>('V4');
  const [instrumental, setInstrumental] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kieKey = getStoredKieKey();

  const generate = async () => {
    if (!kieKey || !prompt.trim()) return;
    setLoading(true);
    setError(null);
    setAudioUrl(null);
    try {
      const res = await fetch('/api/suno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-kie-key': kieKey },
        body: JSON.stringify({ prompt: prompt.trim(), model, instrumental }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Suno error ${res.status}`);
      }
      const data = await res.json() as { url: string };
      setAudioUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Music generation failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadAudio = async () => {
    if (!audioUrl) return;
    try {
      const res = await fetch(audioUrl);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'suno-music.mp3';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(audioUrl, '_blank');
    }
  };

  return (
    <div className="musicgen-section">
      <div className="musicgen-header">
        <h3 className="musicgen-title">Music Generation</h3>
        <p className="musicgen-subtitle">Generate AI music via Suno using your KIE AI key</p>
      </div>

      {!kieKey && (
        <div className="vidgen-missing-key">
          <span className="vidgen-missing-icon">⚠</span>
          <span>
            Add your <strong>KIE AI API key</strong> in settings to generate music.{' '}
            <a href="https://kie.ai/dashboard/keys" target="_blank" rel="noreferrer" className="vidgen-notice-link">
              Get one at kie.ai ↗
            </a>
          </span>
        </div>
      )}

      <div className="musicgen-model-row">
        <span className="musicgen-row-label">Model</span>
        {(['V4', 'V4.5Plus'] as Model[]).map((m) => (
          <button
            key={m}
            className={`musicgen-pill${model === m ? ' musicgen-pill--active' : ''}`}
            onClick={() => setModel(m)}
          >
            Suno {m}
          </button>
        ))}
        <label className="musicgen-toggle-wrap">
          <input
            type="checkbox"
            checked={instrumental}
            onChange={(e) => setInstrumental(e.target.checked)}
          />
          <span className="musicgen-toggle-label">Instrumental only</span>
        </label>
      </div>

      <div className="musicgen-prompt-area">
        <label className="musicgen-row-label">Prompt</label>
        <textarea
          className="musicgen-textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Describe the music you want to generate..."
        />
      </div>

      <div className="musicgen-actions">
        <button
          className="analyze-btn musicgen-generate-btn"
          onClick={generate}
          disabled={!kieKey || !prompt.trim() || loading}
        >
          {loading ? (
            <>
              <span className="vidgen-btn-spinner" />
              Generating… (1–3 min)
            </>
          ) : audioUrl ? (
            '↺ Regenerate'
          ) : (
            '♫ Generate Music'
          )}
        </button>
      </div>

      {loading && (
        <div className="musicgen-loading">
          <div className="spinner" />
          <p className="vidgen-loading-text">Generating music with Suno {model}… this can take 1–3 minutes</p>
        </div>
      )}

      {error && (
        <div className="vidgen-error">
          <span>⚠ {error}</span>
          <button className="vidgen-retry-btn" onClick={generate}>Retry</button>
        </div>
      )}

      {audioUrl && !loading && (
        <div className="musicgen-player">
          <audio src={audioUrl} controls className="musicgen-audio" />
          <button className="vidgen-download-btn" onClick={downloadAudio}>↓ Download MP3</button>
        </div>
      )}
    </div>
  );
}
