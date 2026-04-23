import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { generateCoverArt, generateCoverArtVariations } from "../coverArtGenerator";
import { createPrompt, getPromptsByProjectId } from "../db";

export const coverArtRouter = router({
  /**
   * Generate cover art for a project based on music prompt
   */
  generate: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        musicPrompt: z.string(),
        videoMood: z.string(),
        videoGenre: z.string(),
        videoTitle: z.string(),
        colorPalette: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const coverArt = await generateCoverArt({
          musicPrompt: input.musicPrompt,
          videoMood: input.videoMood,
          videoGenre: input.videoGenre,
          videoTitle: input.videoTitle,
          colorPalette: input.colorPalette,
        });

        // Save to database
        await createPrompt(
          input.projectId,
          "cover_art",
          input.musicPrompt,
          coverArt.url
        );

        return {
          success: true,
          coverArt,
        };
      } catch (error) {
        console.error("Cover art generation error:", error);
        throw error;
      }
    }),

  /**
   * Generate multiple cover art variations
   */
  generateVariations: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        musicPrompt: z.string(),
        videoMood: z.string(),
        videoGenre: z.string(),
        videoTitle: z.string(),
        count: z.number().min(1).max(5).default(3),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const variations = await generateCoverArtVariations(
          {
            musicPrompt: input.musicPrompt,
            videoMood: input.videoMood,
            videoGenre: input.videoGenre,
            videoTitle: input.videoTitle,
          },
          input.count
        );

        // Save the first variation as the main cover art
        if (variations.length > 0) {
          await createPrompt(
            input.projectId,
            "cover_art",
            input.musicPrompt,
            variations[0].url
          );
        }

        return {
          success: true,
          variations,
        };
      } catch (error) {
        console.error("Cover art variations generation error:", error);
        throw error;
      }
    }),

  /**
   * Get cover art for a project
   */
  get: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const prompts = await getPromptsByProjectId(input.projectId);
      const coverArtPrompt = prompts.find((p: any) => p.promptType === "cover_art");
      return coverArtPrompt || null;
    }),

  /**
   * Delete cover art for a project
   */
  delete: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input }) => {
      // In a real app, you would delete from the database
      // For now, we'll just return success
      return { success: true };
    }),
});
