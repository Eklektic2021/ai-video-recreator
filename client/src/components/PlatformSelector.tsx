import { SelectedPlatforms } from '../types';

const VIDEO_PLATFORMS = [
  'Higgsfield',
  'Runway ML',
  'Kling AI',
  'Pika Labs',
  'Sora',
  'Luma Dream Machine',
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
  platforms,
  selected,
  onToggle,
}: {
  title: string;
  platforms: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="platform-group">
      <h3 className="platform-group-title">{title}</h3>
      <div className="platform-checkboxes">
        {platforms.map((p) => (
          <label key={p} className="platform-checkbox">
            <input
              type="checkbox"
              checked={selected.includes(p)}
              onChange={() => onToggle(p)}
            />
            <span className="checkmark" />
            <span className="platform-name">{p}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function PlatformSelector({ selected, onChange }: Props) {
  return (
    <div className="platform-selector">
      <PlatformGroup
        title="Video Generation"
        platforms={VIDEO_PLATFORMS}
        selected={selected.video}
        onToggle={(v) => onChange({ ...selected, video: toggle(selected.video, v) })}
      />
      <PlatformGroup
        title="Music Generation"
        platforms={MUSIC_PLATFORMS}
        selected={selected.music}
        onToggle={(v) => onChange({ ...selected, music: toggle(selected.music, v) })}
      />
      <PlatformGroup
        title="Video Editing"
        platforms={EDITING_PLATFORMS}
        selected={selected.editing}
        onToggle={(v) =>
          onChange({ ...selected, editing: toggle(selected.editing, v) })
        }
      />
    </div>
  );
}
