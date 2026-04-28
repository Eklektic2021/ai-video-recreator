import { useState, useCallback } from 'react';
import type { SceneAnalysis } from '../types';
import { getStoredKieKey } from '../lib/videoGen';
import { getStoredOpenAIKey, generateWithDalle } from '../lib/imageGen';

type MusicProvider = 'suno' | 'udio';
type SunoModel = 'V4' | 'V4.5Plus';

const GENRES = [
  'Trap', 'R&B', 'Hip-Hop', 'Gospel', 'Lo-Fi', 'Cinematic',
  'Drill', 'Afrobeats', 'Orchestral', 'Pop', 'Soul', 'Electronic',
] as const;

const GENRE_INSTRUMENTS: Record<string, string> = {
  Trap: '808 bass, trap hi-hats, snare rolls',
  'R&B': 'smooth bass, keys, light trap drums',
  'Hip-Hop': 'boom bap drums, bass, vinyl samples',
  Gospel: 'organ, choir, piano, bass guitar',
  'Lo-Fi': 'lo-fi drums, warm bass, jazzy chords',
  Cinematic: 'orchestral strings, brass, timpani, choir',
  Drill: 'dark sliding 808s, drill percussion, bass',
  Afrobeats: 'afro percussion, bass, talking drum, guitar',
  Orchestral: 'full orchestra, strings, woodwinds, brass, harp',
  Pop: 'synth, electric bass, pop drums, guitar',
  Soul: 'piano, bass, horns, rhythm guitar, strings',
  Electronic: 'synthesizer, electronic drums, sub-bass, pads',
};

function autoBpm(scenes: SceneAnalysis[]): number {
  const text = scenes.map((s) => s.mood).join(' ').toLowerCase();
  const isFast = /energetic|intense|exciting|upbeat|hype|fierce|powerful|action|dynamic|aggressive|fast|urgent|adrenaline/.test(text);
  const isSlow = /calm|peaceful|melanchol|sad|reflective|intimate|quiet|gentle|serene|tender|somber|mournful|slow|dream/.test(text);
  if (isFast) return 128;
  if (isSlow) return 72;
  return 98;
}

function buildPrompt(
  provider: MusicProvider,
  genre: string,
  bpm: number,
  instrumental: boolean,
  scenes: SceneAnalysis[],
): string {
  const moods = [...new Set(scenes.map((s) => s.mood).filter(Boolean))].slice(0, 3);
  const moodText = moods.length ? moods.join(', ') : 'cinematic, emotional';
  const instruments = GENRE_INSTRUMENTS[genre] ?? 'piano, bass, drums';

  if (provider === 'suno') {
    if (instrumental) {
      return [
        `[${genre}] [${bpm} BPM] [${moodText}]`,
        `Instruments: ${instruments}.`,
        `Beat style: ${genre.toLowerCase()} groove.`,
        'Instrumental only, no vocals.',
      ].join('\n');
    } else {
      return [
        `[${genre}] [${bpm} BPM] [${moodText}]`,
        `Instruments: ${instruments}.`,
        `Beat style: ${genre.toLowerCase()} groove.`,
        '',
        '[Verse]',
        '',
        '[Chorus]',
      ].join('\n');
    }
  } else {
    const vocalNote = instrumental ? 'Instrumental only, no vocals.' : 'Background vocals or none.';
    return [
      `${genre} background music at ${bpm} BPM.`,
      `Mood and energy: ${moodText}.`,
      `Instruments: ${instruments}.`,
      `Beat style: ${genre.toLowerCase()} groove.`,
      vocalNote,
    ].join(' ');
  }
}

interface Props {
  scenes: SceneAnalysis[];
  description?: string;
  coverArtPrompt?: string;
}

export default function MusicGen({ scenes, coverArtPrompt }: Props) {
  const [musicProvider, setMusicProvider] = useState<MusicProvider>('suno');
  const [sunoModel, setSunoModel] = useState<SunoModel>('V4');
  const [genre, setGenre] = useState<string>('Cinematic');
  const [bpm, setBpm] = useState<number>(() => autoBpm(scenes));
  const [instrumental, setInstrumental] = useState(false);
  const [prompt, setPrompt] = useState<string>(() =>
    buildPrompt('suno', 'Cinematic', autoBpm(scenes), false, scenes)
  );
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kieKey = getStoredKieKey();
  const openaiKey = getStoredOpenAIKey();

  const [coverArtUrl, setCoverArtUrl] = useState<string | null>(null);
  const [coverArtLoading, setCoverArtLoading] = useState(false);
  const [coverArtError, setCoverArtError] = useState<string | null>(null);

  const generateCoverArt = useCallback(async () => {
    if (!coverArtPrompt || !openaiKey) return;
    setCoverArtLoading(true);
    setCoverArtError(null);
    try {
      const url = await generateWithDalle(openaiKey, coverArtPrompt, []);
      setCoverArtUrl(url);
    } catch (err) {
      setCoverArtError(err instanceof Error ? err.message : 'Cover art generation failed');
    } finally {
      setCoverArtLoading(false);
    }
  }, [coverArtPrompt, openaiKey]);

  const refreshPrompt = useCallback((
    provider: MusicProvider,
    g: string,
    b: number,
    instr: boolean,
  ) => {
    setPrompt(buildPrompt(provider, g, b, instr, scenes));
  }, [scenes]);

  const handleProviderChange = (p: MusicProvider) => {
    setMusicProvider(p);
    refreshPrompt(p, genre, bpm, instrumental);
  };

  const handleGenreChange = (g: string) => {
    setGenre(g);
    refreshPrompt(musicProvider, g, bpm, instrumental);
  };

  const handleBpmChange = (b: number) => {
    setBpm(b);
    refreshPrompt(musicProvider, genre, b, instrumental);
  };

  const handleInstrumentalChange = (instr: boolean) => {
    setInstrumental(instr);
    refreshPrompt(musicProvider, genre, bpm, instr);
  };

  const generate = async () => {
    if (!kieKey || !prompt.trim()) return;
    setLoading(true);
    setError(null);
    setAudioUrl(null);
    try {
      if (musicProvider === 'suno') {
        const res = await fetch('/api/suno', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-kie-key': kieKey },
          body: JSON.stringify({ prompt: prompt.trim(), model: sunoModel, instrumental }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `Suno error ${res.status}`);
        }
        const data = await res.json() as { url: string };
        setAudioUrl(data.url);
      } else {
        const res = await fetch('/api/udio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-kie-key': kieKey },
          body: JSON.stringify({ prompt: prompt.trim(), instrumental }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `Udio error ${res.status}`);
        }
        const data = await res.json() as { url: string };
        setAudioUrl(data.url);
      }
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
      a.download = `${musicProvider}-music.mp3`;
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
        <p className="musicgen-subtitle">Generate AI music via Suno or Udio using your KIE AI key</p>
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

      {/* ── Provider toggle ── */}
      <div className="musicgen-model-row">
        <span className="musicgen-row-label">Provider</span>
        <button
          className={`musicgen-pill${musicProvider === 'suno' ? ' musicgen-pill--active' : ''}`}
          onClick={() => handleProviderChange('suno')}
        >
          Suno
        </button>
        <button
          className={`musicgen-pill${musicProvider === 'udio' ? ' musicgen-pill--active' : ''}`}
          onClick={() => handleProviderChange('udio')}
        >
          Udio
        </button>

        {musicProvider === 'suno' && (
          <>
            <span className="musicgen-row-label" style={{ marginLeft: '0.5rem' }}>Model</span>
            {(['V4', 'V4.5Plus'] as SunoModel[]).map((m) => (
              <button
                key={m}
                className={`musicgen-pill${sunoModel === m ? ' musicgen-pill--active' : ''}`}
                onClick={() => setSunoModel(m)}
              >
                {m}
              </button>
            ))}
          </>
        )}

        <label className="musicgen-toggle-wrap" style={{ marginLeft: 'auto' }}>
          <input
            type="checkbox"
            checked={instrumental}
            onChange={(e) => handleInstrumentalChange(e.target.checked)}
          />
          <span className="musicgen-toggle-label">Instrumental only</span>
        </label>
      </div>

      {/* ── Genre pills ── */}
      <div className="musicgen-genre-row">
        <span className="musicgen-row-label">Genre</span>
        <div className="musicgen-genre-pills">
          {GENRES.map((g) => (
            <button
              key={g}
              className={`musicgen-genre-pill${genre === g ? ' musicgen-genre-pill--active' : ''}`}
              onClick={() => handleGenreChange(g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* ── BPM slider ── */}
      <div className="musicgen-bpm-row">
        <span className="musicgen-row-label">BPM</span>
        <input
          type="range"
          className="musicgen-bpm-slider"
          min={40}
          max={200}
          step={1}
          value={bpm}
          onChange={(e) => handleBpmChange(Number(e.target.value))}
        />
        <span className="musicgen-bpm-value">{bpm}</span>
      </div>

      {/* ── Prompt textarea ── */}
      <div className="musicgen-prompt-area">
        <label className="musicgen-row-label">Prompt</label>
        <textarea
          className="musicgen-textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Edit prompt before generating..."
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
          <p className="vidgen-loading-text">
            Generating music with {musicProvider === 'suno' ? `Suno ${sunoModel}` : 'Udio'}… this can take 1–3 minutes
          </p>
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

      {/* ── Cover Art ── */}
      {coverArtPrompt && (
        <div className="musicgen-coverart-section">
          <div className="musicgen-coverart-header">
            <span className="musicgen-row-label">Cover Art</span>
            {openaiKey ? (
              <button
                className="musicgen-coverart-btn"
                onClick={generateCoverArt}
                disabled={coverArtLoading}
              >
                {coverArtLoading ? (
                  <><span className="vidgen-btn-spinner" /> Generating…</>
                ) : coverArtUrl ? (
                  '↺ Regenerate'
                ) : (
                  '✦ Generate Cover Art'
                )}
              </button>
            ) : (
              <span className="musicgen-coverart-nokey">Add OpenAI key to generate</span>
            )}
          </div>
          <p className="musicgen-coverart-prompt">{coverArtPrompt}</p>
          {coverArtError && (
            <div className="vidgen-error" style={{ marginTop: '0.5rem' }}>
              <span>⚠ {coverArtError}</span>
            </div>
          )}
          {coverArtUrl && !coverArtLoading && (
            <div className="musicgen-coverart-result">
              <img src={coverArtUrl} alt="Generated cover art" className="musicgen-coverart-img" />
              <a
                href={coverArtUrl}
                download="cover-art.png"
                className="vidgen-download-btn"
                target="_blank"
                rel="noreferrer"
              >
                ↓ Download
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
