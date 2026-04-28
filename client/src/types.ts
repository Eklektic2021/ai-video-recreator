export interface SceneAnalysis {
  scene: number;
  timestamp: string;
  description: string;
  cameraWork: string;
  lighting: string;
  mood: string;
  keyElements: string[];
}

export interface VideoPlatformPrompt {
  mainPrompt: string;
  negativePrompt?: string;
  technicalSettings: string;
  tips: string;
}

export interface MusicPrompt {
  prompt: string;
  genre: string;
  tempo: string;
  instruments: string;
  mood: string;
  duration: string;
}

export interface EditingInstructions {
  overview: string;
  steps: string[];
  keyEffects: string[];
  colorGrading: string;
  transitions: string;
  timing: string;
}

export interface SFXItem {
  timestamp: string;
  sound: string;
  type: string;
  intensity: string;
  notes: string;
}

export interface RemixIdea {
  title: string;
  concept: string;
  style: string;
  mood: string;
}

export interface AnalysisResult {
  sceneAnalysis: SceneAnalysis[];
  videoPlatformPrompts: Record<string, VideoPlatformPrompt>;
  musicPrompts: Record<string, MusicPrompt>;
  editingInstructions: Record<string, EditingInstructions>;
  sfxBreakdown: SFXItem[];
  coverArtPrompt: string;
  remixIdeas?: RemixIdea[];
}

export interface SelectedPlatforms {
  video: string[];
  music: string[];
  editing: string[];
}
