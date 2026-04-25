import { useState } from 'react';
import { saveApiKey } from '../lib/anthropic';

interface Props {
  onSave: (key: string) => void;
}

export default function ApiKeySetup({ onSave }: Props) {
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  const handleSave = () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setError('Please enter your API key.');
      return;
    }
    if (!trimmed.startsWith('sk-ant-')) {
      setError('That doesn\'t look like an Anthropic API key (should start with sk-ant-).');
      return;
    }
    saveApiKey(trimmed);
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

        <h1 className="apikey-title">Enter Your Anthropic API Key</h1>
        <p className="apikey-desc">
          This app calls Claude directly from your browser. Your key is stored only in
          your browser&apos;s localStorage and is never sent to any external server.
        </p>

        <div className="apikey-input-wrap">
          <input
            className="apikey-input"
            type={show ? 'text' : 'password'}
            placeholder="sk-ant-..."
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
            spellCheck={false}
          />
          <button
            className="apikey-toggle"
            type="button"
            onClick={() => setShow((s) => !s)}
            tabIndex={-1}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        </div>

        {error && <p className="apikey-error">{error}</p>}

        <button className="analyze-btn apikey-save-btn" onClick={handleSave}>
          Save &amp; Continue
        </button>

        <p className="apikey-link-text">
          Don&apos;t have a key?{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="apikey-link"
          >
            Get one from Anthropic Console ↗
          </a>
        </p>
      </div>
    </div>
  );
}
