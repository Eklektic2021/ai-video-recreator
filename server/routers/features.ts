import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

export const featuresRouter = router({
  // Collaboration
  addCollaborator: protectedProcedure
    .input(z.object({ projectId: z.number(), userId: z.number(), role: z.enum(["viewer", "editor", "owner"]) }))
    .mutation(async ({ input }) => {
      const success = await db.addCollaborator(input.projectId, input.userId, input.role);
      if (!success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { success: true };
    }),

  getCollaborators: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      return await db.getProjectCollaborators(input.projectId);
    }),

  removeCollaborator: protectedProcedure
    .input(z.object({ projectId: z.number(), userId: z.number() }))
    .mutation(async ({ input }) => {
      const success = await db.removeCollaborator(input.projectId, input.userId);
      if (!success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { success: true };
    }),

  // Notifications
  getNotifications: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUserNotifications(ctx.user.id);
  }),

  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ input }) => {
      const success = await db.markNotificationAsRead(input.notificationId);
      if (!success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { success: true };
    }),

  // User Preferences
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await db.getUserPreferences(ctx.user.id);
    return prefs || { userId: ctx.user.id, theme: "system", emailNotifications: "true", inAppNotifications: "true" };
  }),

  updatePreferences: protectedProcedure
    .input(
      z.object({
        theme: z.enum(["light", "dark", "system"]).optional(),
        emailNotifications: z.boolean().optional(),
        inAppNotifications: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const prefs = await db.createOrUpdateUserPreferences(ctx.user.id, {
        theme: input.theme,
        emailNotifications: input.emailNotifications ? "true" : "false",
        inAppNotifications: input.inAppNotifications ? "true" : "false",
      });
      if (!prefs) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return prefs;
    }),
});
