import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { createSocialShare, getSocialShareByToken, getSocialSharesByProjectId, updateShareViewCount, incrementShareCount, createShareAnalytic, getShareAnalytics, getProjectById, getAnalysisByProjectId, getPromptsByProjectId } from "../db";
import { nanoid } from "nanoid";

export const socialSharingRouter = router({
  /**
   * Create a shareable link for a project
   */
  createShareLink: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        isPublic: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const project = await getProjectById(input.projectId);
        if (!project) {
          throw new Error("Project not found");
        }

        // Generate unique share token
        const shareToken = nanoid(32);

        // Create social share record
        await createSocialShare(
          input.projectId,
          ctx.user.id,
          shareToken,
          input.title || project.title,
          input.description || project.description || ""
        );

        return {
          success: true,
          shareToken,
          shareUrl: `/share/${shareToken}`,
        };
      } catch (error) {
        console.error("Share link creation error:", error);
        throw error;
      }
    }),

  /**
   * Get share link for a project
   */
  getShareLink: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      try {
        const shares = await getSocialSharesByProjectId(input.projectId);
        if (shares && shares.length > 0) {
          const share = shares[0];
          return {
            shareToken: share.shareToken,
            shareUrl: `/share/${share.shareToken}`,
            viewCount: share.viewCount,
            shareCount: share.shareCount,
            createdAt: share.createdAt,
          };
        }
        return null;
      } catch (error) {
        console.error("Get share link error:", error);
        throw error;
      }
    }),

  /**
   * Get shared project details (public endpoint)
   */
  getSharedProject: publicProcedure
    .input(z.object({ shareToken: z.string() }))
    .query(async ({ input }) => {
      try {
        const share = await getSocialShareByToken(input.shareToken);
        if (!share) {
          throw new Error("Share not found");
        }

        // Check if share is public and not expired
        if (!share.isPublic || (share.expiresAt && new Date(share.expiresAt) < new Date())) {
          throw new Error("Share is not available");
        }

        // Increment view count
        await updateShareViewCount(share.id);

        // Get project details
        const project = await getProjectById(share.projectId);
        const analysis = await getAnalysisByProjectId(share.projectId);
        const prompts = await getPromptsByProjectId(share.projectId);

        return {
          share: {
            title: share.title,
            description: share.description,
            viewCount: share.viewCount + 1,
            shareCount: share.shareCount,
            createdAt: share.createdAt,
          },
          project: {
            title: project?.title,
            description: project?.description,
          },
          analysis: analysis ? {
            mood: analysis.overallMood,
            genre: analysis.overallGenre,
            duration: analysis.duration,
          } : null,
          prompts: prompts ? prompts.map((p: any) => ({
            type: p.promptType,
            content: p.promptContent,
          })) : [],
        };
      } catch (error) {
        console.error("Get shared project error:", error);
        throw error;
      }
    }),

  /**
   * Track social media share
   */
  trackShare: publicProcedure
    .input(
      z.object({
        shareToken: z.string(),
        platform: z.enum(["twitter", "facebook", "linkedin", "instagram", "tiktok", "pinterest", "email", "copy"]),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const share = await getSocialShareByToken(input.shareToken);
        if (!share) {
          throw new Error("Share not found");
        }

        // Increment share count
        await incrementShareCount(share.id);

        // Create analytics record
        await createShareAnalytic(share.id, input.platform);

        return {
          success: true,
          shareCount: share.shareCount + 1,
        };
      } catch (error) {
        console.error("Track share error:", error);
        throw error;
      }
    }),

  /**
   * Get share analytics
   */
  getShareAnalytics: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      try {
        const shares = await getSocialSharesByProjectId(input.projectId);
        if (!shares || shares.length === 0) {
          return null;
        }

        const share = shares[0];
        const analytics = await getShareAnalytics(share.id);

        // Group analytics by platform
        const platformStats: Record<string, number> = {};
        analytics.forEach((analytic: any) => {
          platformStats[analytic.platform] = (platformStats[analytic.platform] || 0) + 1;
        });

        return {
          viewCount: share.viewCount,
          shareCount: share.shareCount,
          platformStats,
          createdAt: share.createdAt,
          updatedAt: share.updatedAt,
        };
      } catch (error) {
        console.error("Get share analytics error:", error);
        throw error;
      }
    }),

  /**
   * Generate social media share text
   */
  generateShareText: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        platform: z.enum(["twitter", "facebook", "linkedin", "instagram", "tiktok", "pinterest"]),
      })
    )
    .query(async ({ input }) => {
      try {
        const project = await getProjectById(input.projectId);
        if (!project) {
          throw new Error("Project not found");
        }

        const shares = await getSocialSharesByProjectId(input.projectId);
        const shareUrl = shares && shares.length > 0 ? `/share/${shares[0].shareToken}` : "";

        const texts: Record<string, string> = {
          twitter: `Check out my AI-powered video recreation! I used AI Video Recreator to analyze and recreate this video with Higgsfield, CapCut, and Suno. ${shareUrl} #AIVideo #VideoCreation`,
          facebook: `I just created an amazing video recreation using AI Video Recreator! 🎬 See how I used AI to analyze and recreate this video with professional tools. ${shareUrl}`,
          linkedin: `Excited to share my latest video recreation project created with AI Video Recreator. This tool helped me generate professional prompts for Higgsfield, CapCut, and Suno. Check it out: ${shareUrl}`,
          instagram: `New video recreation! 🎥✨ Created with AI Video Recreator - generating prompts for Higgsfield, CapCut & Suno. Link in bio! ${shareUrl}`,
          tiktok: `POV: You just discovered AI Video Recreator 🎬 Watch how I recreated this video using AI-generated prompts! ${shareUrl}`,
          pinterest: `AI Video Recreation Tutorial - Learn how to use AI Video Recreator to generate professional video recreation guides. ${shareUrl}`,
        };

        return {
          platform: input.platform,
          text: texts[input.platform],
          url: shareUrl,
        };
      } catch (error) {
        console.error("Generate share text error:", error);
        throw error;
      }
    }),
});
