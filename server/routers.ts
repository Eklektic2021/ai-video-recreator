import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { createProject, getUserProjects, getProjectById, updateProjectStatus } from "./db";
import { analysisRouter } from "./routers/analysis";
import { coverArtRouter } from "./routers/coverArt";
import { masterGuideRouter } from "./routers/masterGuide";
import { socialSharingRouter } from "./routers/socialSharing";
import { profilesRouter } from "./routers/profiles";
import { templatesRouter } from "./routers/templates";
import { featuresRouter } from "./routers/features";

const projectsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userProjects = await getUserProjects(ctx.user.id);
    return userProjects || [];
  }),
  create: protectedProcedure
    .input(z.object({ title: z.string(), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return createProject(ctx.user.id, input.title, input.description);
    }),
  getById: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      return getProjectById(input.projectId);
    }),
  updateStatus: protectedProcedure
    .input(z.object({ projectId: z.number(), status: z.string() }))
    .mutation(async ({ input }) => {
      return updateProjectStatus(input.projectId, input.status);
    }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  projects: projectsRouter,
  analysis: analysisRouter,
  coverArt: coverArtRouter,
  masterGuide: masterGuideRouter,
  socialSharing: socialSharingRouter,
  profiles: profilesRouter,
  templates: templatesRouter,
  features: featuresRouter,
});

export type AppRouter = typeof appRouter;
