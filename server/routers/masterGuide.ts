import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { generateMarkdownGuide, generateTextGuide } from "../masterGuideGenerator";
import { getAnalysisByProjectId, getScenesByAnalysisId, getPromptsByProjectId, getProjectById } from "../db";

export const masterGuideRouter = router({
  /**
   * Generate a master guide in Markdown format
   */
  generateMarkdown: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      try {
        const project = await getProjectById(input.projectId);
        if (!project) {
          throw new Error("Project not found");
        }

        const analysis = await getAnalysisByProjectId(input.projectId);
        if (!analysis) {
          throw new Error("Analysis not found for project");
        }

        const scenes = await getScenesByAnalysisId(analysis.id);
        const prompts = await getPromptsByProjectId(input.projectId);

        // Parse analysis data
        let analysisData: any = {};
        try {
          analysisData = JSON.parse(analysis.analysisData || "{}");
        } catch (e) {
          console.error("Failed to parse analysis data:", e);
        }

        // Extract prompts by type
        const higgsFieldPrompts = prompts
          .filter((p: any) => p.promptType === "higgsfield_image")
          .map((p: any) => {
            try {
              return JSON.parse(p.promptContent || "{}");
            } catch {
              return {};
            }
          });

        const capCutInstructions = prompts
          .filter((p: any) => p.promptType === "capcut_instructions")
          .map((p: any) => {
            try {
              return JSON.parse(p.promptContent || "{}");
            } catch {
              return {};
            }
          });

        const sunoMusicPrompt = prompts.find((p: any) => p.promptType === "suno_music");
        let parsedSuno: any = {};
        if (sunoMusicPrompt) {
          try {
            parsedSuno = JSON.parse(sunoMusicPrompt.promptContent || "{}");
          } catch {
            parsedSuno = { mainPrompt: sunoMusicPrompt.promptContent || "" };
          }
        }

        const sfxBreakdown = prompts
          .filter((p: any) => p.promptType === "sfx_breakdown")
          .map((p: any) => {
            try {
              return JSON.parse(p.promptContent || "{}");
            } catch {
              return {};
            }
          });

        const coverArtPrompt = prompts.find((p: any) => p.promptType === "cover_art");
        let coverArtUrl: string | undefined;
        if (coverArtPrompt) {
          try {
            const parsed = JSON.parse(coverArtPrompt.promptContent || "{}");
            coverArtUrl = parsed.url || coverArtPrompt.generatedContent || undefined;
          } catch {
            coverArtUrl = coverArtPrompt.generatedContent || undefined;
          }
        }

        const guideData = {
          projectTitle: project.title,
          videoMood: analysis.overallMood || "cinematic",
          videoGenre: analysis.overallGenre || "drama",
          duration: analysis.duration || 0,
          higgsFieldPrompts,
          capCutInstructions,
          sunoMusicPrompt: parsedSuno,
          sfxBreakdown,
          coverArtUrl,
        };

        const markdown = generateMarkdownGuide(guideData);

        return {
          success: true,
          content: markdown,
          filename: `${project.title.replace(/\s+/g, "-")}-recreation-guide.md`,
        };
      } catch (error) {
        console.error("Master guide generation error:", error);
        throw error;
      }
    }),

  /**
   * Generate a master guide in plain text format
   */
  generateText: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      try {
        const project = await getProjectById(input.projectId);
        if (!project) {
          throw new Error("Project not found");
        }

        const analysis = await getAnalysisByProjectId(input.projectId);
        if (!analysis) {
          throw new Error("Analysis not found for project");
        }

        const prompts = await getPromptsByProjectId(input.projectId);

        // Parse analysis data
        let analysisData: any = {};
        try {
          analysisData = JSON.parse(analysis.analysisData || "{}");
        } catch (e) {
          console.error("Failed to parse analysis data:", e);
        }

        // Extract prompts by type
        const higgsFieldPrompts = prompts
          .filter((p: any) => p.promptType === "higgsfield_image")
          .map((p: any) => {
            try {
              return JSON.parse(p.promptContent || "{}");
            } catch {
              return {};
            }
          });

        const capCutInstructions = prompts
          .filter((p: any) => p.promptType === "capcut_instructions")
          .map((p: any) => {
            try {
              return JSON.parse(p.promptContent || "{}");
            } catch {
              return {};
            }
          });

        const sunoMusicPrompt = prompts.find((p: any) => p.promptType === "suno_music");
        let parsedSuno: any = {};
        if (sunoMusicPrompt) {
          try {
            parsedSuno = JSON.parse(sunoMusicPrompt.promptContent || "{}");
          } catch {
            parsedSuno = { mainPrompt: sunoMusicPrompt.promptContent || "" };
          }
        }

        const sfxBreakdown = prompts
          .filter((p: any) => p.promptType === "sfx_breakdown")
          .map((p: any) => {
            try {
              return JSON.parse(p.promptContent || "{}");
            } catch {
              return {};
            }
          });

        const guideData = {
          projectTitle: project.title,
          videoMood: analysis.overallMood || "cinematic",
          videoGenre: analysis.overallGenre || "drama",
          duration: analysis.duration || 0,
          higgsFieldPrompts,
          capCutInstructions,
          sunoMusicPrompt: parsedSuno,
          sfxBreakdown,
        };

        const text = generateTextGuide(guideData);

        return {
          success: true,
          content: text,
          filename: `${project.title.replace(/\s+/g, "-")}-recreation-guide.txt`,
        };
      } catch (error) {
        console.error("Master guide generation error:", error);
        throw error;
      }
    }),
});
