import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

export const profilesRouter = router({
  // Get user profile
  getProfile: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const profile = await db.getUserProfile(input.userId);
      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
      }
      return profile;
    }),

  // Get current user's profile
  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    const profile = await db.getUserProfile(ctx.user.id);
    if (!profile) {
      // Create default profile if it doesn't exist
      return await db.createOrUpdateUserProfile(ctx.user.id, {
        bio: "",
        avatar: null,
        website: null,
        twitter: null,
        instagram: null,
        linkedin: null,
        isPublic: "true",
      });
    }
    return profile;
  }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        bio: z.string().optional(),
        avatar: z.string().optional(),
        website: z.string().optional(),
        twitter: z.string().optional(),
        instagram: z.string().optional(),
        linkedin: z.string().optional(),
        isPublic: z.enum(["true", "false"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await db.createOrUpdateUserProfile(ctx.user.id, input);
      if (!updated) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update profile" });
      }
      return updated;
    }),

  // Follow user
  followUser: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot follow yourself" });
      }

      const success = await db.followUser(ctx.user.id, input.userId);
      if (!success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to follow user" });
      }

      return { success: true };
    }),

  // Unfollow user
  unfollowUser: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const success = await db.unfollowUser(ctx.user.id, input.userId);
      if (!success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to unfollow user" });
      }

      return { success: true };
    }),

  // Check if following user
  isFollowing: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await db.isFollowing(ctx.user.id, input.userId);
    }),

  // Get followers
  getFollowers: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      return await db.getFollowers(input.userId);
    }),

  // Get following
  getFollowing: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      return await db.getFollowing(input.userId);
    }),

  // Add project to portfolio
  addToPortfolio: protectedProcedure
    .input(z.object({ projectId: z.number(), featured: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.addToPortfolio(ctx.user.id, input.projectId, input.featured);
      if (!result) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to add to portfolio" });
      }
      return { success: true };
    }),

  // Remove project from portfolio
  removeFromPortfolio: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const success = await db.removeFromPortfolio(ctx.user.id, input.projectId);
      if (!success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to remove from portfolio" });
      }
      return { success: true };
    }),

  // Get portfolio items
  getPortfolioItems: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      return await db.getPortfolioItems(input.userId);
    }),

  // Update portfolio item order
  updatePortfolioItemOrder: protectedProcedure
    .input(z.object({ portfolioItemId: z.number(), displayOrder: z.number() }))
    .mutation(async ({ input }) => {
      const success = await db.updatePortfolioItemOrder(input.portfolioItemId, input.displayOrder);
      if (!success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update portfolio item order" });
      }
      return { success: true };
    }),
});
