import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

export const templatesRouter = router({
  // Get all public templates
  listPublic: publicProcedure
    .input(z.object({ category: z.string().optional() }))
    .query(async ({ input }) => {
      return await db.getProjectTemplates(input.category);
    }),

  // Get template by ID
  getById: publicProcedure
    .input(z.object({ templateId: z.number() }))
    .query(async ({ input }) => {
      const template = await db.getTemplateById(input.templateId);
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      return template;
    }),

  // Get popular templates
  getPopular: publicProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ input }) => {
      return await db.getPopularTemplates(input.limit);
    }),

  // Get top-rated templates
  getTopRated: publicProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ input }) => {
      return await db.getTopRatedTemplates(input.limit);
    }),

  // Create template (admin only)
  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        category: z.string(),
        thumbnail: z.string().optional(),
        defaultMood: z.string().optional(),
        defaultGenre: z.string().optional(),
        estimatedDuration: z.number().optional(),
        sceneCount: z.number().default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only allow admins to create templates
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can create templates" });
      }

      const result = await db.createProjectTemplate({
        ...input,
        createdBy: ctx.user.id,
      });

      if (!result) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create template" });
      }

      return { success: true };
    }),

  // Rate template
  rate: protectedProcedure
    .input(
      z.object({
        templateId: z.number(),
        rating: z.number().min(1).max(5),
        review: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const success = await db.rateTemplate(input.templateId, ctx.user.id, input.rating, input.review);
      if (!success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to rate template" });
      }
      return { success: true };
    }),

  // Get template ratings
  getRatings: publicProcedure
    .input(z.object({ templateId: z.number() }))
    .query(async ({ input }) => {
      return await db.getTemplateRatings(input.templateId);
    }),

  // Create project from template
  createProjectFromTemplate: protectedProcedure
    .input(
      z.object({
        templateId: z.number(),
        projectTitle: z.string(),
        projectDescription: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const template = await db.getTemplateById(input.templateId);
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      // Create new project based on template
      const project = await db.createProject(
        ctx.user.id,
        input.projectTitle || template.name,
        input.projectDescription || template.description || undefined
      );

      // Increment template usage
      await db.incrementTemplateUsage(input.templateId);

      if (!project) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create project" });
      }

      return project;
    }),
});
