import { generateImage } from "./_core/imageGeneration";

export interface CoverArtRequest {
  musicPrompt: string;
  videoMood: string;
  videoGenre: string;
  videoTitle: string;
  colorPalette?: string;
}

export interface CoverArtResult {
  url: string;
  prompt: string;
  generatedAt: Date;
}

/**
 * Generate a cover art image based on music prompt and video theme
 */
export async function generateCoverArt(request: CoverArtRequest): Promise<CoverArtResult> {
  // Create a detailed prompt for cover art generation
  const coverArtPrompt = buildCoverArtPrompt(request);

  try {
    const result = await generateImage({
      prompt: coverArtPrompt,
    });

    return {
      url: result.url || "",
      prompt: coverArtPrompt,
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error("Cover art generation error:", error);
    throw new Error("Failed to generate cover art: " + (error instanceof Error ? error.message : "Unknown error"));
  }
}

/**
 * Build a detailed prompt for cover art generation
 */
function buildCoverArtPrompt(request: CoverArtRequest): string {
  const { musicPrompt, videoMood, videoGenre, videoTitle, colorPalette } = request;

  // Extract key elements from the music prompt
  const musicElements = extractMusicElements(musicPrompt);

  // Create a sophisticated cover art prompt
  const prompt = `
Create a professional, album cover-style artwork for: "${videoTitle}"

Musical Style: ${musicElements.genre}
Mood: ${videoMood}
Genre: ${videoGenre}
${colorPalette ? `Color Palette: ${colorPalette}` : ""}

Key Musical Elements:
- Instrumentation: ${musicElements.instruments}
- Tempo: ${musicElements.tempo}
- Emotional Tone: ${musicElements.emotionalTone}

Design Requirements:
- Professional album cover composition
- Cinematic and emotionally evocative
- High contrast and visually striking
- Suitable for music streaming platforms
- Modern, elegant aesthetic
- 1:1 square aspect ratio
- ${colorPalette ? `Incorporate ${colorPalette} color scheme` : "Harmonious color palette"}
- Visual representation of the emotional journey
- Sophisticated typography-ready design

The artwork should feel like a premium music album cover that captures the essence of both the video's narrative and the musical composition. It should be immediately recognizable and emotionally impactful.
  `.trim();

  return prompt;
}

/**
 * Extract key musical elements from a music prompt
 */
function extractMusicElements(musicPrompt: string): {
  genre: string;
  instruments: string;
  tempo: string;
  emotionalTone: string;
} {
  // Simple extraction logic - in production, this could use NLP
  const lowerPrompt = musicPrompt.toLowerCase();

  // Detect genre
  let genre = "Electronic";
  if (lowerPrompt.includes("jazz")) genre = "Jazz";
  if (lowerPrompt.includes("classical")) genre = "Classical";
  if (lowerPrompt.includes("ambient")) genre = "Ambient";
  if (lowerPrompt.includes("orchestral")) genre = "Orchestral";
  if (lowerPrompt.includes("soul") || lowerPrompt.includes("r&b")) genre = "Soul/R&B";
  if (lowerPrompt.includes("cinematic")) genre = "Cinematic";

  // Detect instruments
  let instruments = "Synthesizers, Strings";
  if (lowerPrompt.includes("piano")) instruments = "Piano, Strings";
  if (lowerPrompt.includes("guitar")) instruments = "Guitar, Drums";
  if (lowerPrompt.includes("orchestral") || lowerPrompt.includes("symphony")) instruments = "Full Orchestra";
  if (lowerPrompt.includes("acoustic")) instruments = "Acoustic Instruments";

  // Detect tempo
  let tempo = "Moderate";
  if (lowerPrompt.includes("slow") || lowerPrompt.includes("ballad")) tempo = "Slow";
  if (lowerPrompt.includes("fast") || lowerPrompt.includes("upbeat") || lowerPrompt.includes("energetic")) tempo = "Fast";

  // Detect emotional tone
  let emotionalTone = "Contemplative";
  if (lowerPrompt.includes("joyful") || lowerPrompt.includes("happy")) emotionalTone = "Joyful";
  if (lowerPrompt.includes("melancholic") || lowerPrompt.includes("sad")) emotionalTone = "Melancholic";
  if (lowerPrompt.includes("intense") || lowerPrompt.includes("dramatic")) emotionalTone = "Intense";
  if (lowerPrompt.includes("peaceful") || lowerPrompt.includes("calm")) emotionalTone = "Peaceful";
  if (lowerPrompt.includes("energetic") || lowerPrompt.includes("powerful")) emotionalTone = "Powerful";

  return { genre, instruments, tempo, emotionalTone };
}

/**
 * Generate multiple cover art variations
 */
export async function generateCoverArtVariations(
  request: CoverArtRequest,
  count: number = 3
): Promise<CoverArtResult[]> {
  const variations: CoverArtResult[] = [];

  for (let i = 0; i < count; i++) {
    try {
      // Slightly modify the prompt for each variation
      const modifiedRequest = {
        ...request,
        colorPalette: getColorPaletteVariation(request.colorPalette, i),
      };

      const result = await generateCoverArt(modifiedRequest);
      variations.push(result);

      // Add a small delay between requests to avoid rate limiting
      if (i < count - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Failed to generate variation ${i + 1}:`, error);
    }
  }

  return variations;
}

/**
 * Get different color palette variations
 */
function getColorPaletteVariation(basePalette: string | undefined, index: number): string {
  const palettes = [
    "Deep blues and purples with gold accents",
    "Warm oranges and reds with cool shadows",
    "Monochromatic blacks and whites with neon highlights",
    "Earthy tones with vibrant emerald accents",
    "Cool teals and cyans with warm amber",
  ];

  if (basePalette) {
    return basePalette;
  }

  return palettes[index % palettes.length];
}
