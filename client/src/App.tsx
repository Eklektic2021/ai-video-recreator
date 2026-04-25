import { useState, useRef, useCallback, useEffect } from 'react';
import ApiKeySetup from './components/ApiKeySetup';
import AuthGuard from './components/AuthGuard';
import PlatformSelector from './components/PlatformSelector';
import ProjectsPanel from './components/ProjectsPanel';
import ResultsTabs from './components/ResultsTabs';
import { saveProject } from './hooks/useProjects';
import { auth } from './lib/firebase';
import { getStoredApiKey, clearApiKey, runAnalysis } from './lib/anthropic';
import { AnalysisResult, SelectedPlatforms } from './types';

const DEFAULT_PLATFORMS: SelectedPlatforms = {
  video: ['Runway ML', 'Kling AI'],
  music: ['Suno'],
  editing: ['CapCut'],
};

const DARK_MODE_KEY = 'maisuite_dark_mode';

export default function App() {
  const [apiKey, setApiKey] = useState<string>(getStoredApiKey);
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem(DARK_MODE_KEY);
    return stored === null ? true : stored === 'true';
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [platforms, setPlatforms] = useState<SelectedPlatforms>(DEFAULT_PLATFORMS);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Analyzing your video...');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(DARK_MODE_KEY, String(darkMode));
    if (darkMode) {
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
    }
  }, [darkMode]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('video/')) {
      setError('Please upload a video file.');
      return;
    }
    setVideoFile(file);
    setError(null);
    setResult(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const canAnalyze =
    !!apiKey &&
    !!videoFile &&
    description.trim().length > 0 &&
    (platforms.video.length > 0 || platforms.music.length > 0 || platforms.editing.length > 0);

  const rotatingMessages = [
    'Analyzing your video...',
    'Identifying scenes and camera work...',
    'Generating platform prompts...',
    'Crafting music recommendations...',
    'Building editing guide...',
    'Finalizing SFX breakdown...',
  ];

  const handleAnalyze = async () => {
    if (!canAnalyze) return;
    setLoading(true);
    setError(null);
    setResult(null);

    let msgIdx = 0;
    setLoadingMessage(rotatingMessages[msgIdx]);
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % rotatingMessages.length;
      setLoadingMessage(rotatingMessages[msgIdx]);
    }, 3000);

    try {
      const data = await runAnalysis(apiKey, description, platforms);
      setResult(data);
      const uid = auth.currentUser?.uid;
      if (uid) {
        saveProject(uid, { title: description, platforms, output: data }).catch(
          (e) => console.warn('Failed to save project:', e)
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      clearInterval(msgInterval);
      setLoading(false);
    }
  };

  if (!apiKey || showKeySetup) {
    return (
      <AuthGuard>
        <ApiKeySetup
          onSave={(key) => {
            setApiKey(key);
            setShowKeySetup(false);
          }}
        />
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <ProjectsPanel
        open={showProjects}
        onClose={() => setShowProjects(false)}
        onLoad={(output, plats) => {
          setResult(output);
          setPlatforms(plats);
        }}
      />
      <div className={`app${darkMode ? '' : ' light-mode'}`}>
        {loading && (
          <div className="loading-overlay">
            <div className="loading-card">
              <div className="spinner" />
              <p className="loading-message">{loadingMessage}</p>
            </div>
          </div>
        )}

        <header className="header">
          <div className="header-inner">
            <div className="header-brand">
              <span className="header-logo">MAISuite Flow</span>
              <span className="header-sep">|</span>
              <span className="header-title">AI Video Recreator</span>
            </div>
            <div className="header-right">
              <p className="header-tagline">
                Analyze any video and generate ready-to-use prompts for every platform
              </p>
              <button
                className="projects-open-btn"
                onClick={() => setShowProjects(true)}
              >
                &#128193; My Projects
              </button>
              <button
                className="theme-toggle-btn"
                onClick={() => setDarkMode((d) => !d)}
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? '☀' : '🌙'}
              </button>
              <button
                className="apikey-change-btn"
                onClick={() => setShowKeySetup(true)}
                title="Change API key"
              >
                &#9881; API Key
              </button>
            </div>
          </div>
        </header>

        <main className="main">
          <div className="card">
            <h2 className="card-title">Upload Your Video</h2>

            <div
              className={`upload-zone ${dragOver ? 'upload-zone--dragover' : ''} ${videoFile ? 'upload-zone--filled' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              {videoFile ? (
                <div className="upload-zone-filled">
                  <span className="upload-icon">&#127916;</span>
                  <div>
                    <p className="upload-filename">{videoFile.name}</p>
                    <p className="upload-filesize">
                      {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    className="upload-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVideoFile(null);
                      setResult(null);
                    }}
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <div className="upload-zone-empty">
                  <span className="upload-icon upload-icon--large">&#128249;</span>
                  <p className="upload-hint">
                    Drag &amp; drop a video file here, or{' '}
                    <span className="upload-link">browse</span>
                  </p>
                  <p className="upload-formats">MP4, MOV, AVI, WebM supported</p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">Describe Your Vision</h2>
            <textarea
              className="description-textarea"
              placeholder="Describe what you're trying to recreate or achieve with this video. What's the style, tone, and purpose? The more detail you provide, the better the generated prompts will be."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
            />
            <p className="char-count">{description.length} characters</p>
          </div>

          <div className="card">
            <h2 className="card-title">Select Platforms</h2>
            <p className="card-subtitle">
              Choose which platforms you want prompts generated for
            </p>
            <PlatformSelector selected={platforms} onChange={setPlatforms} />
          </div>

          {error && (
            <div className="error-banner">
              <span className="error-icon">&#9888;</span>
              <span>{error}</span>
              <button className="error-dismiss" onClick={() => setError(null)}>
                &times;
              </button>
            </div>
          )}

          <div className="analyze-row">
            <button
              className="analyze-btn"
              onClick={handleAnalyze}
              disabled={!canAnalyze || loading}
            >
              {loading ? 'Analyzing...' : 'Analyze Video'}
            </button>
            {!canAnalyze && !loading && (
              <p className="analyze-hint">
                Upload a video, add a description, and select at least one platform to continue.
              </p>
            )}
          </div>

          {result && (
            <ResultsTabs result={result} selectedPlatforms={platforms} />
          )}
        </main>

        <footer className="footer">
          <p>
            Powered by{' '}
            <span className="footer-brand">Claude AI</span>
            {' · '}
            <span className="footer-suite">MAISuite Flow</span>
            {' · '}
            <button
              className="footer-clear-key"
              onClick={() => { clearApiKey(); setApiKey(''); }}
            >
              Clear API Key
            </button>
          </p>
        </footer>
      </div>
    </AuthGuard>
  );
}
