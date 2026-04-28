import { useState, useCallback } from 'react';
import {
  AnalysisResult,
  SceneAnalysis,
  VideoPlatformPrompt,
  MusicPrompt,
  EditingInstructions,
  SFXItem,
  RemixIdea,
} from '../types';
import ImageGenerator from './ImageGenerator';
import VideoGenerator from './VideoGenerator';
import MusicGen from './MusicGen';

interface Props {
  result: AnalysisResult;
  selectedPlatforms: { video: string[]; music: string[]; editing: string[] };
  description?: string;
  onUseRemixIdea?: (concept: string) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button className="copy-btn" onClick={handleCopy}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

function SceneCard({ scene }: { scene: SceneAnalysis }) {
  return (
    <div className="scene-card">
      <div className="scene-header">
        <span className="scene-number">Scene {scene.scene}</span>
        <span className="scene-timestamp">{scene.timestamp}</span>
      </div>
      <p className="scene-description">{scene.description}</p>
      <div className="scene-meta">
        <div className="scene-meta-item">
          <span className="meta-label">Camera</span>
          <span className="meta-value">{scene.cameraWork}</span>
        </div>
        <div className="scene-meta-item">
          <span className="meta-label">Lighting</span>
          <span className="meta-value">{scene.lighting}</span>
        </div>
        <div className="scene-meta-item">
          <span className="meta-label">Mood</span>
          <span className="meta-value">{scene.mood}</span>
        </div>
      </div>
      {scene.keyElements.length > 0 && (
        <div className="scene-elements">
          {scene.keyElements.map((el, i) => (
            <span key={i} className="element-tag">
              {el}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PromptBlock({
  platform,
  prompt,
}: {
  platform: string;
  prompt: VideoPlatformPrompt;
}) {
  const text = [
    `PLATFORM: ${platform}`,
    `\nMAIN PROMPT:\n${prompt.mainPrompt}`,
    prompt.negativePrompt ? `\nNEGATIVE PROMPT:\n${prompt.negativePrompt}` : '',
    `\nTECHNICAL SETTINGS:\n${prompt.technicalSettings}`,
    `\nTIPS:\n${prompt.tips}`,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="prompt-block">
      <div className="prompt-block-header">
        <h4 className="prompt-platform">{platform}</h4>
        <CopyButton text={text} />
      </div>
      <div className="prompt-section">
        <span className="prompt-label">Main Prompt</span>
        <p className="prompt-text">{prompt.mainPrompt}</p>
      </div>
      {prompt.negativePrompt && (
        <div className="prompt-section">
          <span className="prompt-label">Negative Prompt</span>
          <p className="prompt-text">{prompt.negativePrompt}</p>
        </div>
      )}
      <div className="prompt-section">
        <span className="prompt-label">Technical Settings</span>
        <p className="prompt-text">{prompt.technicalSettings}</p>
      </div>
      <div className="prompt-section">
        <span className="prompt-label">Tips</span>
        <p className="prompt-text">{prompt.tips}</p>
      </div>
    </div>
  );
}

function MusicBlock({
  platform,
  music,
}: {
  platform: string;
  music: MusicPrompt;
}) {
  const text = [
    `PLATFORM: ${platform}`,
    `\nPROMPT:\n${music.prompt}`,
    `\nGenre: ${music.genre}`,
    `Tempo: ${music.tempo}`,
    `Instruments: ${music.instruments}`,
    `Mood: ${music.mood}`,
    `Duration: ${music.duration}`,
  ].join('\n');

  return (
    <div className="prompt-block">
      <div className="prompt-block-header">
        <h4 className="prompt-platform">{platform}</h4>
        <CopyButton text={text} />
      </div>
      <div className="prompt-section">
        <span className="prompt-label">Prompt</span>
        <p className="prompt-text">{music.prompt}</p>
      </div>
      <div className="music-meta">
        <div className="music-meta-item">
          <span className="meta-label">Genre</span>
          <span className="meta-value">{music.genre}</span>
        </div>
        <div className="music-meta-item">
          <span className="meta-label">Tempo</span>
          <span className="meta-value">{music.tempo}</span>
        </div>
        <div className="music-meta-item">
          <span className="meta-label">Instruments</span>
          <span className="meta-value">{music.instruments}</span>
        </div>
        <div className="music-meta-item">
          <span className="meta-label">Mood</span>
          <span className="meta-value">{music.mood}</span>
        </div>
        <div className="music-meta-item">
          <span className="meta-label">Duration</span>
          <span className="meta-value">{music.duration}</span>
        </div>
      </div>
    </div>
  );
}

function EditingBlock({
  platform,
  instructions,
}: {
  platform: string;
  instructions: EditingInstructions;
}) {
  const text = [
    `PLATFORM: ${platform}`,
    `\nOVERVIEW:\n${instructions.overview}`,
    `\nSTEPS:\n${instructions.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
    `\nKEY EFFECTS:\n${instructions.keyEffects.join('\n')}`,
    `\nCOLOR GRADING:\n${instructions.colorGrading}`,
    `\nTRANSITIONS:\n${instructions.transitions}`,
    `\nTIMING:\n${instructions.timing}`,
  ].join('\n');

  return (
    <div className="prompt-block">
      <div className="prompt-block-header">
        <h4 className="prompt-platform">{platform}</h4>
        <CopyButton text={text} />
      </div>
      <div className="prompt-section">
        <span className="prompt-label">Overview</span>
        <p className="prompt-text">{instructions.overview}</p>
      </div>
      <div className="prompt-section">
        <span className="prompt-label">Steps</span>
        <ol className="steps-list">
          {instructions.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>
      {instructions.keyEffects.length > 0 && (
        <div className="prompt-section">
          <span className="prompt-label">Key Effects</span>
          <ul className="effects-list">
            {instructions.keyEffects.map((effect, i) => (
              <li key={i}>{effect}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="prompt-section">
        <span className="prompt-label">Color Grading</span>
        <p className="prompt-text">{instructions.colorGrading}</p>
      </div>
      <div className="prompt-section">
        <span className="prompt-label">Transitions</span>
        <p className="prompt-text">{instructions.transitions}</p>
      </div>
      <div className="prompt-section">
        <span className="prompt-label">Timing</span>
        <p className="prompt-text">{instructions.timing}</p>
      </div>
    </div>
  );
}

function SFXTable({ items }: { items: SFXItem[] }) {
  const text = items
    .map(
      (s) =>
        `[${s.timestamp}] ${s.sound} | ${s.type} | Intensity: ${s.intensity} | ${s.notes}`
    )
    .join('\n');

  return (
    <div>
      <div className="tab-header-row">
        <CopyButton text={text} />
      </div>
      <div className="sfx-table-wrap">
        <table className="sfx-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Sound</th>
              <th>Type</th>
              <th>Intensity</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td className="sfx-timestamp">{item.timestamp}</td>
                <td>{item.sound}</td>
                <td>
                  <span className="sfx-type-badge">{item.type}</span>
                </td>
                <td>
                  <span className={`sfx-intensity sfx-intensity--${item.intensity.toLowerCase()}`}>
                    {item.intensity}
                  </span>
                </td>
                <td className="sfx-notes">{item.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RemixIdeasSection({
  ideas,
  onUse,
}: {
  ideas: RemixIdea[];
  onUse?: (concept: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!ideas.length) return null;
  return (
    <div className="remix-ideas-card">
      <button className="remix-expand-btn" onClick={() => setExpanded((e) => !e)}>
        <span>✨ Remix Ideas ({ideas.length})</span>
        <span className="remix-expand-icon">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="remix-ideas-list">
          {ideas.map((idea, i) => (
            <div key={i} className="remix-idea-item">
              <div className="remix-idea-header">
                <strong className="remix-idea-title">{idea.title}</strong>
                {onUse && (
                  <button className="remix-use-btn" onClick={() => onUse(idea.concept)}>
                    Use This Concept
                  </button>
                )}
              </div>
              <p className="remix-idea-concept">{idea.concept}</p>
              <div className="remix-idea-meta">
                <span className="element-tag">{idea.style}</span>
                <span className="element-tag">{idea.mood}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const MAIN_TABS = [
  { id: 'scenes', label: 'Scene Analysis' },
  { id: 'images', label: 'Image Gen' },
  { id: 'videogen', label: 'Video Gen' },
  { id: 'musicgen', label: 'Music Gen' },
  { id: 'video', label: 'Video Prompts' },
  { id: 'music', label: 'Music Prompts' },
  { id: 'editing', label: 'Editing Guide' },
  { id: 'sfx', label: 'SFX Breakdown' },
  { id: 'cover', label: 'Cover Art' },
] as const;

type TabId = (typeof MAIN_TABS)[number]['id'];

export default function ResultsTabs({ result, selectedPlatforms, description, onUseRemixIdea }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('scenes');
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});

  const handleImageGenerated = useCallback((sceneNum: number, url: string) => {
    setGeneratedImages((prev) => ({ ...prev, [sceneNum]: url }));
  }, []);

  const [activeVideoTab, setActiveVideoTab] = useState(
    selectedPlatforms.video[0] ?? ''
  );
  const [activeMusicTab, setActiveMusicTab] = useState(
    selectedPlatforms.music[0] ?? ''
  );
  const [activeEditingTab, setActiveEditingTab] = useState(
    selectedPlatforms.editing[0] ?? ''
  );

  const exportText = () => {
    const lines: string[] = ['=== AI VIDEO RECREATOR ANALYSIS ===\n'];

    lines.push('--- SCENE ANALYSIS ---');
    result.sceneAnalysis.forEach((s) => {
      lines.push(
        `Scene ${s.scene} [${s.timestamp}]\n${s.description}\nCamera: ${s.cameraWork} | Lighting: ${s.lighting} | Mood: ${s.mood}\nElements: ${s.keyElements.join(', ')}\n`
      );
    });

    lines.push('\n--- VIDEO PLATFORM PROMPTS ---');
    Object.entries(result.videoPlatformPrompts).forEach(([p, v]) => {
      lines.push(
        `\n${p}:\nMain: ${v.mainPrompt}\nNegative: ${v.negativePrompt ?? 'N/A'}\nSettings: ${v.technicalSettings}\nTips: ${v.tips}`
      );
    });

    lines.push('\n--- MUSIC PROMPTS ---');
    Object.entries(result.musicPrompts).forEach(([p, m]) => {
      lines.push(
        `\n${p}:\n${m.prompt}\nGenre: ${m.genre} | Tempo: ${m.tempo} | Mood: ${m.mood}`
      );
    });

    lines.push('\n--- EDITING INSTRUCTIONS ---');
    Object.entries(result.editingInstructions).forEach(([p, e]) => {
      lines.push(`\n${p}:\n${e.overview}\nSteps:\n${e.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
    });

    lines.push('\n--- SFX BREAKDOWN ---');
    result.sfxBreakdown.forEach((s) => {
      lines.push(`[${s.timestamp}] ${s.sound} (${s.type}, ${s.intensity}) — ${s.notes}`);
    });

    lines.push(`\n--- COVER ART PROMPT ---\n${result.coverArtPrompt}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'video-analysis.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'video-analysis.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="results-container">
      <div className="results-header">
        <h2 className="results-title">Analysis Results</h2>
        <div className="export-buttons">
          <button className="export-btn export-btn--text" onClick={exportText}>
            Export TXT
          </button>
          <button className="export-btn export-btn--json" onClick={exportJson}>
            Export JSON
          </button>
        </div>
      </div>

      <div className="main-tabs">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`main-tab ${activeTab === tab.id ? 'main-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'scenes' && (
          <div>
            <div className="scenes-grid">
              {result.sceneAnalysis.map((scene) => (
                <SceneCard key={scene.scene} scene={scene} />
              ))}
            </div>
            {result.remixIdeas && result.remixIdeas.length > 0 && (
              <RemixIdeasSection ideas={result.remixIdeas} onUse={onUseRemixIdea} />
            )}
          </div>
        )}

        {activeTab === 'images' && (
          <ImageGenerator
            scenes={result.sceneAnalysis}
            onImageGenerated={handleImageGenerated}
          />
        )}

        {activeTab === 'videogen' && (
          <VideoGenerator
            scenes={result.sceneAnalysis}
            generatedImages={generatedImages}
            onSwitchToImages={() => setActiveTab('images')}
          />
        )}

        {activeTab === 'musicgen' && (
          <MusicGen
            scenes={result.sceneAnalysis}
            description={description ?? ''}
          />
        )}

        {activeTab === 'video' && (
          <div>
            {selectedPlatforms.video.length > 1 && (
              <div className="sub-tabs">
                {selectedPlatforms.video.map((p) => (
                  <button
                    key={p}
                    className={`sub-tab ${activeVideoTab === p ? 'sub-tab--active' : ''}`}
                    onClick={() => setActiveVideoTab(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            {result.videoPlatformPrompts[activeVideoTab || selectedPlatforms.video[0]] && (
              <PromptBlock
                platform={activeVideoTab || selectedPlatforms.video[0]}
                prompt={result.videoPlatformPrompts[activeVideoTab || selectedPlatforms.video[0]]}
              />
            )}
          </div>
        )}

        {activeTab === 'music' && (
          <div>
            {selectedPlatforms.music.length > 1 && (
              <div className="sub-tabs">
                {selectedPlatforms.music.map((p) => (
                  <button
                    key={p}
                    className={`sub-tab ${activeMusicTab === p ? 'sub-tab--active' : ''}`}
                    onClick={() => setActiveMusicTab(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            {result.musicPrompts[activeMusicTab || selectedPlatforms.music[0]] && (
              <MusicBlock
                platform={activeMusicTab || selectedPlatforms.music[0]}
                music={result.musicPrompts[activeMusicTab || selectedPlatforms.music[0]]}
              />
            )}
          </div>
        )}

        {activeTab === 'editing' && (
          <div>
            {selectedPlatforms.editing.length > 1 && (
              <div className="sub-tabs">
                {selectedPlatforms.editing.map((p) => (
                  <button
                    key={p}
                    className={`sub-tab ${activeEditingTab === p ? 'sub-tab--active' : ''}`}
                    onClick={() => setActiveEditingTab(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            {result.editingInstructions[activeEditingTab || selectedPlatforms.editing[0]] && (
              <EditingBlock
                platform={activeEditingTab || selectedPlatforms.editing[0]}
                instructions={result.editingInstructions[activeEditingTab || selectedPlatforms.editing[0]]}
              />
            )}
          </div>
        )}

        {activeTab === 'sfx' && <SFXTable items={result.sfxBreakdown} />}

        {activeTab === 'cover' && (
          <div className="cover-art-section">
            <div className="prompt-block-header">
              <h4 className="prompt-platform">Cover Art Prompt</h4>
              <CopyButton text={result.coverArtPrompt} />
            </div>
            <p className="cover-art-prompt">{result.coverArtPrompt}</p>
          </div>
        )}
      </div>
    </div>
  );
}
