import { SelectedPlatforms } from '../types';

const VIDEO_PLATFORMS = [
  'Higgsfield',
  'Runway ML',
  'Kling AI',
  'Pika Labs',
  'Sora',
  'Luma Dream Machine',
  'Google Flow',
  'Vidu',
];

const MUSIC_PLATFORMS = ['Suno', 'Udio', 'Mureka', 'Loudly'];

const EDITING_PLATFORMS = [
  'CapCut',
  'DaVinci Resolve',
  'Adobe Premiere',
  'iMovie',
];

interface Props {
  selected: SelectedPlatforms;
  onChange: (selected: SelectedPlatforms) => void;
}

function toggle(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function PlatformGroup({
  title,
  dotClass,
  platforms,
  selected,
  onToggle,
}: {
  title: string;
  dotClass: string;
  platforms: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="platform-group">
      <h3 className="platform-group-title">
        <span className={`dot ${dotClass}`} />
        {title}
        <span className="platform-group-count">{selected.length}/{platforms.length}</span>
      </h3>
      <div className="platform-pills-grid">
        {platforms.map((p) => {
          const isSelected = selected.includes(p);
          return (
            <button
              key={p}
              type="button"
              className={`platform-pill${isSelected ? ' platform-pill--selected' : ''}`}
              onClick={() => onToggle(p)}
            >
              <span className="platform-pill-check">
                {isSelected && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
              <span className="platform-pill-name">{p}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PlatformSelector({ selected, onChange }: Props) {
  return (
    <div className="platform-selector">
      <PlatformGroup
        title="Video Generation"
        dotClass="dot-video"
        platforms={VIDEO_PLATFORMS}
        selected={selected.video}
        onToggle={(v) => onChange({ ...selected, video: toggle(selected.video, v) })}
      />
      <div className="platform-divider" />
      <PlatformGroup
        title="Music Generation"
        dotClass="dot-music"
        platforms={MUSIC_PLATFORMS}
        selected={selected.music}
        onToggle={(v) => onChange({ ...selected, music: toggle(selected.music, v) })}
      />
      <div className="platform-divider" />
      <PlatformGroup
        title="Video Editing"
        dotClass="dot-edit"
        platforms={EDITING_PLATFORMS}
        selected={selected.editing}
        onToggle={(v) => onChange({ ...selected, editing: toggle(selected.editing, v) })}
      />
    </div>
  );
}
