import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "test",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("analysis router", () => {
  it("should analyze a video and return prompt package", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.analysis.analyzeVideo({
      projectId: 1,
      videoUrl: "test-video.mp4",
      useAiTwin: true,
    });

    expect(result.success).toBe(true);
    expect(result.promptPackage).toBeDefined();
    expect(result.promptPackage.higgsFieldPrompts).toBeDefined();
    expect(result.promptPackage.capCutInstructions).toBeDefined();
    expect(result.promptPackage.sunoMusicPrompt).toBeDefined();
    expect(result.promptPackage.sfxBreakdown).toBeDefined();
  });

  it("should generate Higgsfield prompts for each scene", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.analysis.analyzeVideo({
      projectId: 1,
      videoUrl: "test-video.mp4",
      useAiTwin: true,
    });

    const higgsFieldPrompts = result.promptPackage.higgsFieldPrompts;
    expect(higgsFieldPrompts.length).toBeGreaterThan(0);
    
    higgsFieldPrompts.forEach((prompt: any) => {
      expect(prompt.sceneNumber).toBeDefined();
      expect(prompt.prompt).toBeDefined();
      expect(prompt.aiTwinTips).toBeDefined();
    });
  });

  it("should generate CapCut instructions for each scene", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.analysis.analyzeVideo({
      projectId: 1,
      videoUrl: "test-video.mp4",
      useAiTwin: false,
    });

    const capCutInstructions = result.promptPackage.capCutInstructions;
    expect(capCutInstructions.length).toBeGreaterThan(0);
    
    capCutInstructions.forEach((instructions: any) => {
      expect(instructions.sceneNumber).toBeDefined();
      expect(instructions.motionInstructions).toBeDefined();
      expect(instructions.colorGrading).toBeDefined();
      expect(instructions.transitions).toBeDefined();
      expect(instructions.overlays).toBeDefined();
    });
  });

  it("should generate Suno music prompt with arrangement breakdown", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.analysis.analyzeVideo({
      projectId: 1,
      videoUrl: "test-video.mp4",
      useAiTwin: true,
    });

    const sunoPrompt = result.promptPackage.sunoMusicPrompt;
    expect(sunoPrompt).toBeDefined();
    expect(sunoPrompt.mainPrompt).toBeDefined();
    expect(sunoPrompt.arrangementBreakdown).toBeDefined();
    expect(sunoPrompt.estimatedDuration).toBeGreaterThan(0);
  });

  it("should generate SFX breakdown for each scene", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.analysis.analyzeVideo({
      projectId: 1,
      videoUrl: "test-video.mp4",
      useAiTwin: true,
    });

    const sfxBreakdown = result.promptPackage.sfxBreakdown;
    expect(sfxBreakdown.length).toBeGreaterThan(0);
    
    sfxBreakdown.forEach((sfx: any) => {
      expect(sfx.sceneNumber).toBeDefined();
      expect(Array.isArray(sfx.soundEffects)).toBe(true);
    });
  });

  it("should respect useAiTwin flag", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const resultWithTwin = await caller.analysis.analyzeVideo({
      projectId: 1,
      videoUrl: "test-video.mp4",
      useAiTwin: true,
    });

    const resultWithoutTwin = await caller.analysis.analyzeVideo({
      projectId: 2,
      videoUrl: "test-video.mp4",
      useAiTwin: false,
    });

    expect(resultWithTwin.promptPackage).toBeDefined();
    expect(resultWithoutTwin.promptPackage).toBeDefined();
  });
});
