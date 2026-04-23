/**
 * Master Guide Generator
 * Combines all generated prompts and instructions into a comprehensive recreation guide
 */

export interface MasterGuideData {
  projectTitle: string;
  videoMood: string;
  videoGenre: string;
  duration: number;
  higgsFieldPrompts: any[];
  capCutInstructions: any[];
  sunoMusicPrompt: any;
  sfxBreakdown: any[];
  coverArtUrl?: string;
}

/**
 * Generate a Markdown master guide
 */
export function generateMarkdownGuide(data: MasterGuideData): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${data.projectTitle} - Video Recreation Guide`);
  lines.push("");
  lines.push(`**Video Duration:** ${data.duration} seconds`);
  lines.push(`**Overall Mood:** ${data.videoMood}`);
  lines.push(`**Genre:** ${data.videoGenre}`);
  lines.push("");

  // Table of Contents
  lines.push("## Table of Contents");
  lines.push("");
  lines.push("1. [Project Overview](#overview)");
  lines.push("2. [Higgsfield Image Prompts](#higgsfield)");
  lines.push("3. [CapCut Editing Instructions](#capcut)");
  lines.push("4. [Suno Music Prompt](#suno)");
  lines.push("5. [Sound Effects Breakdown](#sfx)");
  if (data.coverArtUrl) {
    lines.push("6. [Cover Art](#coverart)");
  }
  lines.push("");

  // Overview
  lines.push("## Project Overview {#overview}");
  lines.push("");
  lines.push(`This is a comprehensive guide for recreating "${data.projectTitle}" using AI tools.`);
  lines.push("");
  lines.push("**Tools Required:**");
  lines.push("- Higgsfield (for motion and animation)");
  lines.push("- CapCut (for video editing)");
  lines.push("- Suno (for music generation)");
  lines.push("");

  // Higgsfield Prompts
  lines.push("## Higgsfield Image Prompts {#higgsfield}");
  lines.push("");
  lines.push("Use these prompts in Higgsfield to generate motion-enhanced images for each scene.");
  lines.push("");

  data.higgsFieldPrompts.forEach((prompt: any) => {
    lines.push(`### Scene ${prompt.sceneNumber}`);
    lines.push("");
    lines.push("**Image Prompt:**");
    lines.push(`\`\`\``);
    lines.push(prompt.prompt);
    lines.push(`\`\`\``);
    lines.push("");
    if (prompt.aiTwinTips) {
      lines.push("**AI Twin Integration Tips:**");
      lines.push(prompt.aiTwinTips);
      lines.push("");
    }
  });

  // CapCut Instructions
  lines.push("## CapCut Editing Instructions {#capcut}");
  lines.push("");
  lines.push("Follow these detailed instructions for editing each scene in CapCut.");
  lines.push("");

  data.capCutInstructions.forEach((instructions: any) => {
    lines.push(`### Scene ${instructions.sceneNumber}`);
    lines.push("");

    if (instructions.motionInstructions) {
      lines.push("**Motion Instructions:**");
      lines.push(instructions.motionInstructions);
      lines.push("");
    }

    if (instructions.colorGrading) {
      lines.push("**Color Grading:**");
      lines.push(instructions.colorGrading);
      lines.push("");
    }

    if (instructions.transitions) {
      lines.push("**Transitions:**");
      lines.push(instructions.transitions);
      lines.push("");
    }

    if (instructions.overlays) {
      lines.push("**Overlays & Effects:**");
      lines.push(instructions.overlays);
      lines.push("");
    }
  });

  // Suno Music Prompt
  lines.push("## Suno Music Prompt {#suno}");
  lines.push("");
  lines.push("Use this prompt to generate the background music for your video.");
  lines.push("");

  if (data.sunoMusicPrompt) {
    lines.push("**Main Music Prompt:**");
    lines.push(`\`\`\``);
    lines.push(data.sunoMusicPrompt.mainPrompt);
    lines.push(`\`\`\``);
    lines.push("");

    if (data.sunoMusicPrompt.estimatedDuration) {
      lines.push(`**Estimated Duration:** ${data.sunoMusicPrompt.estimatedDuration} seconds`);
      lines.push("");
    }

    if (data.sunoMusicPrompt.arrangementBreakdown && data.sunoMusicPrompt.arrangementBreakdown.length > 0) {
      lines.push("**Arrangement Breakdown:**");
      lines.push("");

      data.sunoMusicPrompt.arrangementBreakdown.forEach((section: any) => {
        lines.push(`- **${section.section}** (${section.timeRange})`);
        lines.push(`  - Intensity: ${section.intensity}/10`);
        lines.push(`  - ${section.description}`);
      });
      lines.push("");
    }
  }

  // SFX Breakdown
  lines.push("## Sound Effects Breakdown {#sfx}");
  lines.push("");
  lines.push("Add these sound effects to enhance your video in CapCut.");
  lines.push("");

  data.sfxBreakdown.forEach((sfx: any) => {
    lines.push(`### Scene ${sfx.sceneNumber}`);
    lines.push("");

    if (sfx.soundEffects && sfx.soundEffects.length > 0) {
      sfx.soundEffects.forEach((effect: any) => {
        lines.push(`- **${effect.name}** (${effect.volume})`);
        lines.push(`  - ${effect.description}`);
        lines.push(`  - Placement: ${effect.placement}`);
      });
    } else {
      lines.push("No sound effects for this scene.");
    }
    lines.push("");
  });

  // Cover Art
  if (data.coverArtUrl) {
    lines.push("## Cover Art {#coverart}");
    lines.push("");
    lines.push("Use this cover art image for your music on streaming platforms:");
    lines.push("");
    lines.push(`![Cover Art](${data.coverArtUrl})`);
    lines.push("");
  }

  // Footer
  lines.push("---");
  lines.push("");
  lines.push("**Generated with AI Video Recreator**");
  lines.push(`*Guide created on ${new Date().toLocaleDateString()}*`);

  return lines.join("\n");
}

/**
 * Generate a plain text master guide
 */
export function generateTextGuide(data: MasterGuideData): string {
  const lines: string[] = [];

  lines.push("=".repeat(80));
  lines.push(`${data.projectTitle} - VIDEO RECREATION GUIDE`.padStart(50));
  lines.push("=".repeat(80));
  lines.push("");

  lines.push(`Video Duration: ${data.duration} seconds`);
  lines.push(`Overall Mood: ${data.videoMood}`);
  lines.push(`Genre: ${data.videoGenre}`);
  lines.push("");

  // Higgsfield
  lines.push("-".repeat(80));
  lines.push("HIGGSFIELD IMAGE PROMPTS");
  lines.push("-".repeat(80));
  lines.push("");

  data.higgsFieldPrompts.forEach((prompt: any) => {
    lines.push(`SCENE ${prompt.sceneNumber}:`);
    lines.push(prompt.prompt);
    if (prompt.aiTwinTips) {
      lines.push(`AI Twin Tips: ${prompt.aiTwinTips}`);
    }
    lines.push("");
  });

  // CapCut
  lines.push("-".repeat(80));
  lines.push("CAPCUT EDITING INSTRUCTIONS");
  lines.push("-".repeat(80));
  lines.push("");

  data.capCutInstructions.forEach((instructions: any) => {
    lines.push(`SCENE ${instructions.sceneNumber}:`);
    if (instructions.motionInstructions) lines.push(`Motion: ${instructions.motionInstructions}`);
    if (instructions.colorGrading) lines.push(`Color: ${instructions.colorGrading}`);
    if (instructions.transitions) lines.push(`Transitions: ${instructions.transitions}`);
    if (instructions.overlays) lines.push(`Overlays: ${instructions.overlays}`);
    lines.push("");
  });

  // Suno
  lines.push("-".repeat(80));
  lines.push("SUNO MUSIC PROMPT");
  lines.push("-".repeat(80));
  lines.push("");

  if (data.sunoMusicPrompt) {
    lines.push(data.sunoMusicPrompt.mainPrompt);
    lines.push(`Duration: ${data.sunoMusicPrompt.estimatedDuration}s`);
    lines.push("");
  }

  // SFX
  lines.push("-".repeat(80));
  lines.push("SOUND EFFECTS BREAKDOWN");
  lines.push("-".repeat(80));
  lines.push("");

  data.sfxBreakdown.forEach((sfx: any) => {
    lines.push(`SCENE ${sfx.sceneNumber}:`);
    if (sfx.soundEffects && sfx.soundEffects.length > 0) {
      sfx.soundEffects.forEach((effect: any) => {
        lines.push(`- ${effect.name} (${effect.volume}): ${effect.description}`);
      });
    }
    lines.push("");
  });

  return lines.join("\n");
}
