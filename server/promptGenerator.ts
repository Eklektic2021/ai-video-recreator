import { invokeLLM } from "./_core/llm";

export interface VideoAnalysisResult {
  scenes: SceneData[];
  overallMood: string;
  overallGenre: string;
  duration: number;
  title: string;
}

export interface SceneData {
  sceneNumber: number;
  timeStart: number;
  timeEnd: number;
  description: string;
  visualStyle: string;
  lighting: string;
  cameraMovement: string;
  characterActions: string;
  mood: string;
}

export interface PromptPackage {
  higgsFieldPrompts: HiggsFieldPrompt[];
  capCutInstructions: CapCutInstructions[];
  sunoMusicPrompt: SunoMusicPrompt;
  sfxBreakdown: SFXBreakdown[];
}

export interface HiggsFieldPrompt {
  sceneNumber: number;
  prompt: string;
  aiTwinTips: string;
}

export interface CapCutInstructions {
  sceneNumber: number;
  motionInstructions: string;
  colorGrading: string;
  transitions: string;
  overlays: string;
}

export interface SunoMusicPrompt {
  mainPrompt: string;
  arrangementBreakdown: ArrangementSection[];
  estimatedDuration: number;
}

export interface ArrangementSection {
  timeRange: string;
  section: string;
  description: string;
  intensity: number;
}

export interface SFXBreakdown {
  sceneNumber: number;
  soundEffects: SoundEffect[];
}

export interface SoundEffect {
  name: string;
  description: string;
  volume: "very_low" | "low" | "medium" | "medium_high" | "high";
  placement: string;
}

/**
 * Generate Higgsfield image prompts for each scene
 */
export async function generateHiggsFieldPrompts(
  analysis: VideoAnalysisResult,
  useAiTwin: boolean = true
): Promise<HiggsFieldPrompt[]> {
  const prompts: HiggsFieldPrompt[] = [];

  for (const scene of analysis.scenes) {
    const systemPrompt = `You are an expert AI video prompt engineer specializing in Higgsfield motion generation. 
Create detailed, cinematic prompts that capture the exact visual style, mood, and character actions from the scene description.
${useAiTwin ? "The main character should be referred to as 'my AI Twin' to integrate the user's AI Twin model." : ""}
Focus on: visual style, lighting, camera movements, character expressions, and emotional tone.`;

    const userPrompt = `Generate a Higgsfield motion prompt for this scene:
    
Scene ${scene.sceneNumber} (${scene.timeStart}s - ${scene.timeEnd}s):
Description: ${scene.description}
Visual Style: ${scene.visualStyle}
Lighting: ${scene.lighting}
Camera Movement: ${scene.cameraMovement}
Character Actions: ${scene.characterActions}
Mood: ${scene.mood}

Create a detailed prompt that would generate a cinematic video clip for this scene. Include specific instructions for motion, expressions, and emotional delivery.
${useAiTwin ? "Include tips for integrating the user's AI Twin as the main character." : ""}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = typeof response.choices[0]?.message.content === "string" 
      ? response.choices[0].message.content 
      : "";
    const [prompt, ...tipsArray] = content.split("\n\n");
    const aiTwinTips = tipsArray.join("\n\n");

    prompts.push({
      sceneNumber: scene.sceneNumber,
      prompt: prompt.trim(),
      aiTwinTips: aiTwinTips.trim(),
    });
  }

  return prompts;
}

/**
 * Generate CapCut editing instructions for each scene
 */
export async function generateCapCutInstructions(
  analysis: VideoAnalysisResult
): Promise<CapCutInstructions[]> {
  const instructions: CapCutInstructions[] = [];

  for (const scene of analysis.scenes) {
    const systemPrompt = `You are an expert CapCut video editor specializing in cinematic editing.
Provide detailed, step-by-step editing instructions for each scene including color grading, transitions, and visual effects.
Focus on creating a cohesive, professional-looking video with consistent visual style.`;

    const userPrompt = `Generate CapCut editing instructions for this scene:

Scene ${scene.sceneNumber} (${scene.timeStart}s - ${scene.timeEnd}s):
Description: ${scene.description}
Visual Style: ${scene.visualStyle}
Lighting: ${scene.lighting}
Mood: ${scene.mood}
Overall Video Mood: ${analysis.overallMood}

Provide:
1. Motion instructions (camera pans, zooms, etc.)
2. Color grading (filters, brightness, contrast, saturation adjustments)
3. Transitions to use for this scene
4. Overlays or effects to enhance the mood`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = typeof response.choices[0]?.message.content === "string" 
      ? response.choices[0].message.content 
      : "";
    const sections = content.split("\n\n");

    instructions.push({
      sceneNumber: scene.sceneNumber,
      motionInstructions: sections[0] || "",
      colorGrading: sections[1] || "",
      transitions: sections[2] || "",
      overlays: sections[3] || "",
    });
  }

  return instructions;
}

/**
 * Generate Suno music prompt with arrangement breakdown
 */
export async function generateSunoMusicPrompt(
  analysis: VideoAnalysisResult
): Promise<SunoMusicPrompt> {
  const systemPrompt = `You are an expert music producer and composer specializing in creating detailed Suno AI music prompts.
Create comprehensive, structured prompts that include genre, mood, instrumentation, and a detailed arrangement breakdown with timestamps.
The prompt should guide Suno to generate music that perfectly matches the video's emotional arc and visual style.`;

  const userPrompt = `Generate a detailed Suno music prompt for a video with these characteristics:

Title: ${analysis.title}
Overall Mood: ${analysis.overallMood}
Genre: ${analysis.overallGenre}
Duration: ${analysis.duration} seconds
Number of Scenes: ${analysis.scenes.length}

Scene Breakdown:
${analysis.scenes.map((s) => `- Scene ${s.sceneNumber} (${s.timeStart}s-${s.timeEnd}s): ${s.mood} - ${s.description}`).join("\n")}

Create a comprehensive Suno prompt that includes:
1. Main music prompt (genre, mood, instrumentation, style)
2. Detailed arrangement breakdown with timestamps and intensity levels for each section
3. Specific musical elements that match the video's emotional journey

Format the response as:
MAIN PROMPT:
[Your detailed Suno prompt here]

ARRANGEMENT BREAKDOWN:
[mm:ss - mm:ss] Section Name: Description (Intensity: X/10)
[Continue for each section]`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = typeof response.choices[0]?.message.content === "string" 
      ? response.choices[0].message.content 
      : "";
    const [mainSection, arrangementSection] = content.split("ARRANGEMENT BREAKDOWN:");

    const mainPrompt = mainSection.replace("MAIN PROMPT:", "").trim();
    const arrangementLines = arrangementSection
      ?.trim()
      .split("\n")
      .filter((line) => line.includes("[") && line.includes("]")) || [];

    const arrangementBreakdown: ArrangementSection[] = arrangementLines.map((line) => {
      const timeMatch = line.match(/\[([^\]]+)\]/);
      const sectionMatch = line.match(/\]\s*([^:]+):/);
      const descMatch = line.match(/:\s*([^(]+)/);
      const intensityMatch = line.match(/Intensity:\s*(\d+)/);

      return {
        timeRange: timeMatch?.[1] || "",
        section: sectionMatch?.[1]?.trim() || "",
        description: descMatch?.[1]?.trim() || "",
        intensity: parseInt(intensityMatch?.[1] || "5"),
      };
    });

    return {
      mainPrompt,
      arrangementBreakdown,
      estimatedDuration: analysis.duration,
    };
  }

/**
 * Generate scene-by-scene SFX breakdown
 */
export async function generateSFXBreakdown(
  analysis: VideoAnalysisResult
): Promise<SFXBreakdown[]> {
  const breakdowns: SFXBreakdown[] = [];

  for (const scene of analysis.scenes) {
    const systemPrompt = `You are an expert sound designer specializing in cinematic audio.
Create detailed sound effect recommendations for each scene, including specific effects, volume levels, and placement guidance for CapCut.
Focus on enhancing the emotional impact and immersion of the video.`;

    const userPrompt = `Generate sound effects breakdown for this scene:

Scene ${scene.sceneNumber} (${scene.timeStart}s - ${scene.timeEnd}s):
Description: ${scene.description}
Visual Style: ${scene.visualStyle}
Mood: ${scene.mood}
Overall Video Mood: ${analysis.overallMood}

Recommend specific sound effects with:
1. Sound effect name
2. Description of what it should sound like
3. Volume level (very_low, low, medium, medium_high, high)
4. Placement instructions for CapCut

Format as a list of sound effects.`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = typeof response.choices[0]?.message.content === "string" 
      ? response.choices[0].message.content 
      : "";
    const sfxLines = content.split("\n").filter((line: string) => line.trim().length > 0);

    const soundEffects: SoundEffect[] = sfxLines.map((line: string) => {
      const volumeMatch = line.match(/\((very_low|low|medium|medium_high|high)\)/i);
      const volume = (volumeMatch?.[1]?.toLowerCase() || "medium") as any;

      return {
        name: line.split("-")[0]?.trim() || "Sound Effect",
        description: line.split("-")[1]?.split("(")[0]?.trim() || "",
        volume,
        placement: line.split("Placement:")[1]?.trim() || "Throughout scene",
      };
    });

    breakdowns.push({
      sceneNumber: scene.sceneNumber,
      soundEffects,
    });
  }

  return breakdowns;
}

/**
 * Generate complete prompt package from video analysis
 */
export async function generateCompletePromptPackage(
  analysis: VideoAnalysisResult,
  useAiTwin: boolean = true
): Promise<PromptPackage> {
  const [higgsFieldPrompts, capCutInstructions, sunoMusicPrompt, sfxBreakdown] = await Promise.all([
    generateHiggsFieldPrompts(analysis, useAiTwin),
    generateCapCutInstructions(analysis),
    generateSunoMusicPrompt(analysis),
    generateSFXBreakdown(analysis),
  ]);

  return {
    higgsFieldPrompts,
    capCutInstructions,
    sunoMusicPrompt,
    sfxBreakdown,
  };
}
