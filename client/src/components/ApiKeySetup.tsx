import { useState } from 'react';
import { saveApiKey, getStoredApiKey } from '../lib/anthropic';
import {
  getStoredOpenAIKey,
  saveOpenAIKey,
  getStoredReplicateKey,
  saveReplicateKey,
} from '../lib/imageGen';
import {
  getStoredKieKey, saveKieKey,
  getStoredFalKey, saveFalKey,
  getStoredGeminiKey, saveGeminiKey,
  getStoredVideoReplicateKey, saveVideoReplicateKey,
  getStoredKlingAccessKey, saveKlingAccessKey,
  getStoredKlingSecretKey, saveKlingSecretKey,
} from '../lib/videoGen';

interface Props {
  onSave: (key: string) => void;
}

export default function ApiKeySetup({ onSave }: Props) {
  const [key, setKey] = useState(getStoredApiKey);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  const [openaiKey, setOpenaiKey] = useState(getStoredOpenAIKey);
  const [showOpenai, setShowOpenai] = useState(false);

  const [replicateKey, setReplicateKey] = useState(getStoredReplicateKey);
  const [showReplicate, setShowReplicate] = useState(false);

  const [kieKey, setKieKey] = useState(getStoredKieKey);
  const [showKie, setShowKie] = useState(false);

  const [klingAccessKey, setKlingAccessKey] = useState(getStoredKlingAccessKey);
  const [showKlingAccess, setShowKlingAccess] = useState(false);
  const [klingSecretKey, setKlingSecretKey] = useState(getStoredKlingSecretKey);
  const [showKlingSecret, setShowKlingSecret] = useState(false);

  const [falKey, setFalKey] = useState(getStoredFalKey);
  const [showFal, setShowFal] = useState(false);

  const [videoReplicateKey, setVideoReplicateKey] = useState(getStoredVideoReplicateKey);
  const [showVideoReplicate, setShowVideoReplicate] = useState(false);

  const [geminiKey, setGeminiKey] = useState(getStoredGeminiKey);
  const [showGemini, setShowGemini] = useState(false);

  const handleSave = () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setError('Please enter your Anthropic API key.');
      return;
    }
    if (!trimmed.startsWith('sk-ant-')) {
      setError("That doesn't look like an Anthropic API key (should start with sk-ant-).");
      return;
    }
    saveApiKey(trimmed);
    if (openaiKey.trim()) saveOpenAIKey(openaiKey);
    if (replicateKey.trim()) saveReplicateKey(replicateKey);
    if (kieKey.trim()) saveKieKey(kieKey);
    if (klingAccessKey.trim()) saveKlingAccessKey(klingAccessKey);
    if (klingSecretKey.trim()) saveKlingSecretKey(klingSecretKey);
    if (falKey.trim()) saveFalKey(falKey);
    if (videoReplicateKey.trim()) saveVideoReplicateKey(videoReplicateKey);
    if (geminiKey.trim()) saveGeminiKey(geminiKey);
    onSave(trimmed);
  };

  return (
    <div className="apikey-overlay">
      <div className="apikey-card">
        <div className="apikey-brand">
          <span className="header-logo">MAISuite Flow</span>
          <span className="header-sep">|</span>
          <span className="header-title">AI Video Recreator</span>
        </div>

        <h1 className="apikey-title">API Key Settings</h1>
        <p className="apikey-desc">
          Your keys are stored only in your browser&apos;s localStorage and are never
          sent to any external server.
        </p>

        {/* ── Anthropic (required) ── */}
        <p className="apikey-field-label">
          Anthropic API Key <span className="apikey-required">required</span>
        </p>
        <div className="apikey-input-wrap">
          <input
            className="apikey-input"
            type={show ? 'text' : 'password'}
            placeholder="sk-ant-..."
            value={key}
            onChange={(e) => { setKey(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus={!key}
            spellCheck={false}
          />
          <button className="apikey-toggle" type="button" onClick={() => setShow((s) => !s)} tabIndex={-1}>
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
        {error && <p className="apikey-error">{error}</p>}
        <p className="apikey-link-text">
          Don&apos;t have one?{' '}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="apikey-link">
            Get it from Anthropic Console ↗
          </a>
        </p>

        {/* ── Divider ── */}
        <div className="apikey-divider">
          <span>Optional — for Image Generation</span>
        </div>

        {/* ── OpenAI (optional) ── */}
        <p className="apikey-field-label">
          OpenAI API Key <span className="apikey-optional">for DALL·E 3</span>
        </p>
        <div className="apikey-input-wrap">
          <input
            className="apikey-input"
            type={showOpenai ? 'text' : 'password'}
            placeholder="sk-..."
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            spellCheck={false}
          />
          <button className="apikey-toggle" type="button" onClick={() => setShowOpenai((s) => !s)} tabIndex={-1}>
            {showOpenai ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="apikey-link-text">
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="apikey-link">
            Get OpenAI key ↗
          </a>
        </p>

        {/* ── Replicate (optional) ── */}
        <p className="apikey-field-label">
          Replicate API Key <span className="apikey-optional">for FLUX Schnell</span>
        </p>
        <div className="apikey-input-wrap">
          <input
            className="apikey-input"
            type={showReplicate ? 'text' : 'password'}
            placeholder="r8_..."
            value={replicateKey}
            onChange={(e) => setReplicateKey(e.target.value)}
            spellCheck={false}
          />
          <button className="apikey-toggle" type="button" onClick={() => setShowReplicate((s) => !s)} tabIndex={-1}>
            {showReplicate ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="apikey-link-text">
          <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noreferrer" className="apikey-link">
            Get Replicate key ↗
          </a>
        </p>

        {/* ── Divider ── */}
        <div className="apikey-divider">
          <span>Optional — for Video Generation</span>
        </div>

        {/* ── KIE AI (optional) ── */}
        <p className="apikey-field-label">
          KIE AI API Key <span className="apikey-optional">for Runway, Kling, Veo & Suno</span>
        </p>
        <div className="apikey-input-wrap">
          <input
            className="apikey-input"
            type={showKie ? 'text' : 'password'}
            placeholder="kie_..."
            value={kieKey}
            onChange={(e) => setKieKey(e.target.value)}
            spellCheck={false}
          />
          <button className="apikey-toggle" type="button" onClick={() => setShowKie((s) => !s)} tabIndex={-1}>
            {showKie ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="apikey-link-text">
          <a href="https://kie.ai/dashboard/keys" target="_blank" rel="noreferrer" className="apikey-link">
            Get KIE AI key ↗
          </a>
        </p>

        {/* ── Kling native (optional) ── */}
        <p className="apikey-field-label">
          Kling Access Key <span className="apikey-optional">native Kling 2.1 &amp; 3.0 direct</span>
        </p>
        <div className="apikey-input-wrap">
          <input
            className="apikey-input"
            type={showKlingAccess ? 'text' : 'password'}
            placeholder="Access key..."
            value={klingAccessKey}
            onChange={(e) => setKlingAccessKey(e.target.value)}
            spellCheck={false}
          />
          <button className="apikey-toggle" type="button" onClick={() => setShowKlingAccess((s) => !s)} tabIndex={-1}>
            {showKlingAccess ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="apikey-field-label">
          Kling Secret Key <span className="apikey-optional">required alongside Access Key</span>
        </p>
        <div className="apikey-input-wrap">
          <input
            className="apikey-input"
            type={showKlingSecret ? 'text' : 'password'}
            placeholder="Secret key..."
            value={klingSecretKey}
            onChange={(e) => setKlingSecretKey(e.target.value)}
            spellCheck={false}
          />
          <button className="apikey-toggle" type="button" onClick={() => setShowKlingSecret((s) => !s)} tabIndex={-1}>
            {showKlingSecret ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="apikey-link-text">
          <a href="https://klingai.com/dev/user/api-keys" target="_blank" rel="noreferrer" className="apikey-link">
            Get Kling AI keys ↗
          </a>
        </p>

        {/* ── fal.ai (optional) ── */}
        <p className="apikey-field-label">
          fal.ai API Key <span className="apikey-optional">for Kling 3.0 &amp; FLUX Dev</span>
        </p>
        <div className="apikey-input-wrap">
          <input
            className="apikey-input"
            type={showFal ? 'text' : 'password'}
            placeholder="fal_..."
            value={falKey}
            onChange={(e) => setFalKey(e.target.value)}
            spellCheck={false}
          />
          <button className="apikey-toggle" type="button" onClick={() => setShowFal((s) => !s)} tabIndex={-1}>
            {showFal ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="apikey-link-text">
          <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noreferrer" className="apikey-link">
            Get fal.ai key ↗
          </a>
        </p>

        {/* ── Replicate video (optional) ── */}
        <p className="apikey-field-label">
          Replicate API Key <span className="apikey-optional">for FLUX Dev (video)</span>
        </p>
        <div className="apikey-input-wrap">
          <input
            className="apikey-input"
            type={showVideoReplicate ? 'text' : 'password'}
            placeholder="r8_..."
            value={videoReplicateKey}
            onChange={(e) => setVideoReplicateKey(e.target.value)}
            spellCheck={false}
          />
          <button className="apikey-toggle" type="button" onClick={() => setShowVideoReplicate((s) => !s)} tabIndex={-1}>
            {showVideoReplicate ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="apikey-link-text">
          <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noreferrer" className="apikey-link">
            Get Replicate key ↗
          </a>
        </p>

        {/* ── Google Gemini (optional) ── */}
        <p className="apikey-field-label">
          Google Gemini API Key <span className="apikey-optional">for Veo 3.1 direct</span>
        </p>
        <div className="apikey-input-wrap">
          <input
            className="apikey-input"
            type={showGemini ? 'text' : 'password'}
            placeholder="AIza..."
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            spellCheck={false}
          />
          <button className="apikey-toggle" type="button" onClick={() => setShowGemini((s) => !s)} tabIndex={-1}>
            {showGemini ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="apikey-link-text">
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="apikey-link">
            Get Gemini key ↗
          </a>
        </p>

        <button className="analyze-btn apikey-save-btn" onClick={handleSave}>
          Save &amp; Continue
        </button>
      </div>
    </div>
  );
}
