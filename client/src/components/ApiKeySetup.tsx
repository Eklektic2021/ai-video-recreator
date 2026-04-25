import { useState } from 'react';
import { saveApiKey, getStoredApiKey } from '../lib/anthropic';
import {
  getStoredOpenAIKey,
  saveOpenAIKey,
  getStoredReplicateKey,
  saveReplicateKey,
} from '../lib/imageGen';

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

        <button className="analyze-btn apikey-save-btn" onClick={handleSave}>
          Save &amp; Continue
        </button>
      </div>
    </div>
  );
}
