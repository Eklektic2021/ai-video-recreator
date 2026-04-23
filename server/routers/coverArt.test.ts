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

describe("coverArt router", () => {
  // Skip image generation tests as they require external API
  const skipImageTests = process.env.SKIP_IMAGE_TESTS !== "false";
  it.skipIf(skipImageTests)("should generate cover art for a project", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coverArt.generate({
      projectId: 1,
      musicPrompt: "Cinematic orchestral piece with emotional depth",
      videoMood: "melancholic and introspective",
      videoGenre: "drama",
      videoTitle: "Test Project",
    });

    expect(result.success).toBe(true);
    expect(result.coverArt).toBeDefined();
    expect(result.coverArt.url).toBeDefined();
    expect(result.coverArt.prompt).toBeDefined();
    expect(result.coverArt.generatedAt).toBeInstanceOf(Date);
  });

  it.skipIf(skipImageTests)("should generate multiple cover art variations", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coverArt.generateVariations({
      projectId: 1,
      musicPrompt: "Upbeat electronic dance music",
      videoMood: "energetic and joyful",
      videoGenre: "music video",
      videoTitle: "Dance Project",
      count: 3,
    });

    expect(result.success).toBe(true);
    expect(result.variations).toBeDefined();
    expect(result.variations.length).toBeGreaterThan(0);
    expect(result.variations.length).toBeLessThanOrEqual(3);

    result.variations.forEach((variation) => {
      expect(variation.url).toBeDefined();
      expect(variation.prompt).toBeDefined();
      expect(variation.generatedAt).toBeInstanceOf(Date);
    });
  });

  it("should retrieve cover art for a project", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // First generate cover art
    await caller.coverArt.generate({
      projectId: 1,
      musicPrompt: "Ambient electronic music",
      videoMood: "peaceful",
      videoGenre: "ambient",
      videoTitle: "Ambient Project",
    });

    // Then retrieve it
    const result = await caller.coverArt.get({
      projectId: 1,
    });

    expect(result).toBeDefined();
    if (result) {
      expect(result.promptType).toBe("cover_art");
      expect(result.promptContent).toBeDefined();
    }
  });

  it("should handle missing cover art gracefully", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coverArt.get({
      projectId: 9999, // Non-existent project
    });

    expect(result).toBeNull();
  });

  it("should delete cover art for a project", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coverArt.delete({
      projectId: 1,
    });

    expect(result.success).toBe(true);
  });

  it.skipIf(skipImageTests)("should extract correct musical elements from prompt", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Test with jazz prompt
    const jazzResult = await caller.coverArt.generate({
      projectId: 1,
      musicPrompt: "Smooth jazz with piano and saxophone",
      videoMood: "sophisticated",
      videoGenre: "jazz",
      videoTitle: "Jazz Project",
    });

    expect(jazzResult.coverArt.prompt).toContain("Jazz");

    // Test with orchestral prompt
    const orchestralResult = await caller.coverArt.generate({
      projectId: 2,
      musicPrompt: "Full orchestral symphony with strings and brass",
      videoMood: "grand",
      videoGenre: "classical",
      videoTitle: "Classical Project",
    });

    expect(orchestralResult.coverArt.prompt).toContain("Orchestral");
  });

  it.skipIf(skipImageTests)("should support custom color palettes", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coverArt.generate({
      projectId: 1,
      musicPrompt: "Cinematic orchestral piece",
      videoMood: "dramatic",
      videoGenre: "drama",
      videoTitle: "Test Project",
      colorPalette: "Deep blues and purples with gold accents",
    });

    expect(result.success).toBe(true);
    expect(result.coverArt.prompt).toContain("Deep blues and purples with gold accents");
  });
});
