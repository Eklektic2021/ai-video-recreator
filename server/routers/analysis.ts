import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { createAnalysis, createScene, createPrompt, getAnalysisByProjectId, getScenesByAnalysisId, getPromptsByProjectId } from "../db";
import { generateCompletePromptPackage, VideoAnalysisResult } from "../promptGenerator";
import { updateProjectStatus } from "../db";
import { generateCoverArt } from "../coverArtGenerator";

export const analysisRouter = router({
  /**
   * Analyze a video and generate all prompts
   */
  analyzeVideo: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        videoUrl: z.string(),
        useAiTwin: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Update project status to analyzing
        await updateProjectStatus(input.projectId, "analyzing");

        // Parse the video analysis (this would normally call manus-analyze-video)
        // For now, we'll create a mock analysis structure
        const mockAnalysis: VideoAnalysisResult = {
          title: "Video Analysis",
          duration: 180,
          overallMood: "emotional and introspective",
          overallGenre: "cinematic drama",
          scenes: [
            {
              sceneNumber: 1,
              timeStart: 0,
              timeEnd: 30,
              description: "Opening scene with character reflection",
              visualStyle: "cinematic, warm color grading",
              lighting: "soft golden hour lighting",
              cameraMovement: "slow pan across landscape",
              characterActions: "character looking contemplatively at horizon",
              mood: "contemplative and peaceful",
            },
            {
              sceneNumber: 2,
              timeStart: 30,
              timeEnd: 60,
              description: "Character in intimate indoor setting",
              visualStyle: "moody, desaturated tones",
              lighting: "dim ambient lighting with accent light",
              cameraMovement: "slow tracking shot",
              characterActions: "character moving through space, touching objects",
              mood: "melancholic and introspective",
            },
            {
              sceneNumber: 3,
              timeStart: 60,
              timeEnd: 90,
              description: "Emotional climax moment",
              visualStyle: "high contrast, dramatic lighting",
              lighting: "strong directional light creating shadows",
              cameraMovement: "push in on character",
              characterActions: "character showing vulnerability and emotion",
              mood: "intense and vulnerable",
            },
            {
              sceneNumber: 4,
              timeStart: 90,
              timeEnd: 120,
              description: "Resolution and acceptance",
              visualStyle: "warm, hopeful color palette",
              lighting: "natural diffused lighting",
              cameraMovement: "wide establishing shot",
              characterActions: "character finding peace and acceptance",
              mood: "hopeful and resolved",
            },
            {
              sceneNumber: 5,
              timeStart: 120,
              timeEnd: 180,
              description: "Closing sequence with new perspective",
              visualStyle: "cinematic, balanced composition",
              lighting: "golden hour transitioning to evening",
              cameraMovement: "slow crane shot revealing landscape",
              characterActions: "character looking forward with determination",
              mood: "empowered and forward-looking",
            },
          ],
        };

        // Create analysis record
        const analysisResult = await createAnalysis(
          input.projectId,
          JSON.stringify(mockAnalysis),
          mockAnalysis.overallMood,
          mockAnalysis.overallGenre,
          mockAnalysis.duration
        );

        if (!analysisResult) {
          throw new Error("Failed to create analysis record");
        }

        // Get the analysis ID from the result
        const analysisId = (analysisResult as any).insertId || (analysisResult as any)[0];

        // Create scene records
        for (const scene of mockAnalysis.scenes) {
          await createScene(analysisId, scene.sceneNumber, scene);
        }

        // Generate complete prompt package
        const promptPackage = await generateCompletePromptPackage(mockAnalysis, input.useAiTwin);

        // Save Suno music prompt
        await createPrompt(
          input.projectId,
          "suno_music",
          JSON.stringify(promptPackage.sunoMusicPrompt),
          ""
        );

        // Save Higgsfield prompts
        for (const higgsPrompt of promptPackage.higgsFieldPrompts) {
          await createPrompt(
            input.projectId,
            "higgsfield_image",
            JSON.stringify(higgsPrompt),
            ""
          );
        }

        // Save CapCut instructions
        for (const capCutInstructions of promptPackage.capCutInstructions) {
          await createPrompt(
            input.projectId,
            "capcut_instructions",
            JSON.stringify(capCutInstructions),
            ""
          );
        }

        // Save SFX breakdown
        for (const sfxBreakdown of promptPackage.sfxBreakdown) {
          await createPrompt(
            input.projectId,
            "sfx_breakdown",
            JSON.stringify(sfxBreakdown),
            ""
          );
        }

        // Automatically generate cover art based on music prompt and video theme
        let coverArtUrl = "";
        try {
          const coverArt = await generateCoverArt({
            musicPrompt: promptPackage.sunoMusicPrompt.mainPrompt,
            videoMood: mockAnalysis.overallMood,
            videoGenre: mockAnalysis.overallGenre,
            videoTitle: `Project ${input.projectId}`,
          });

          coverArtUrl = coverArt.url;

          // Save cover art
          await createPrompt(
            input.projectId,
            "cover_art",
            JSON.stringify({ url: coverArtUrl, generatedAt: new Date() }),
            coverArtUrl
          );
        } catch (coverArtError) {
          console.error("Cover art generation failed, continuing without it:", coverArtError);
          // Don't fail the entire analysis if cover art generation fails
        }

        // Update project status to completed
        await updateProjectStatus(input.projectId, "completed");

        return {
          success: true,
          analysisId,
          promptPackage: {
            ...promptPackage,
            coverArtUrl,
          },
          scenes: mockAnalysis.scenes,
        };
      } catch (error) {
        console.error("Analysis error:", error);
        // Don't update status to error since it's not in the enum
        throw error;
      }
    }),

  /**
   * Get analysis for a project
   */
  getAnalysis: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const analysis = await getAnalysisByProjectId(input.projectId);
      if (!analysis) return null;

      const scenes = await getScenesByAnalysisId(analysis.id);
      const prompts = await getPromptsByProjectId(input.projectId);

      return {
        analysis: analysis,
        scenes: scenes,
        prompts: prompts,
      };
    }),
});
