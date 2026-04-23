import { describe, it, expect, vi, beforeEach } from "vitest";
import { socialSharingRouter } from "./socialSharing";
import * as db from "../db";

// Mock the database functions
vi.mock("../db", () => ({
  getProjectById: vi.fn(),
  getAnalysisByProjectId: vi.fn(),
  getPromptsByProjectId: vi.fn(),
  createSocialShare: vi.fn(),
  getSocialShareByToken: vi.fn(),
  getSocialSharesByProjectId: vi.fn(),
  updateShareViewCount: vi.fn(),
  incrementShareCount: vi.fn(),
  createShareAnalytic: vi.fn(),
  getShareAnalytics: vi.fn(),
}));

describe("Social Sharing Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createShareLink", () => {
    it("should create a share link for a project", async () => {
      const mockProject = {
        id: 1,
        userId: 1,
        title: "Test Project",
        description: "Test Description",
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.getProjectById).mockResolvedValue(mockProject as any);
      vi.mocked(db.createSocialShare).mockResolvedValue(undefined);

      const caller = socialSharingRouter.createCaller({
        user: {
          id: 1,
          openId: "test-user",
          email: "test@example.com",
          name: "Test User",
          loginMethod: "manus",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });

      const result = await caller.createShareLink({
        projectId: 1,
        title: "Check out my video!",
        description: "Amazing recreation",
        isPublic: true,
      });

      expect(result.success).toBe(true);
      expect(result.shareToken).toBeDefined();
      expect(result.shareUrl).toContain("/share/");
      expect(db.createSocialShare).toHaveBeenCalled();
    });

    it("should throw error if project not found", async () => {
      vi.mocked(db.getProjectById).mockResolvedValue(null);

      const caller = socialSharingRouter.createCaller({
        user: {
          id: 1,
          openId: "test-user",
          email: "test@example.com",
          name: "Test User",
          loginMethod: "manus",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });

      await expect(
        caller.createShareLink({
          projectId: 999,
          isPublic: true,
        })
      ).rejects.toThrow("Project not found");
    });
  });

  describe("getShareLink", () => {
    it("should retrieve share link for a project", async () => {
      const mockShare = {
        id: 1,
        projectId: 1,
        userId: 1,
        shareToken: "test-token-123",
        title: "Test Share",
        description: "Test Description",
        isPublic: 1,
        expiresAt: null,
        viewCount: 5,
        shareCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.getSocialSharesByProjectId).mockResolvedValue([mockShare] as any);

      const caller = socialSharingRouter.createCaller({
        user: {
          id: 1,
          openId: "test-user",
          email: "test@example.com",
          name: "Test User",
          loginMethod: "manus",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });

      const result = await caller.getShareLink({ projectId: 1 });

      expect(result).toBeDefined();
      expect(result?.shareToken).toBe("test-token-123");
      expect(result?.viewCount).toBe(5);
      expect(result?.shareCount).toBe(2);
    });

    it("should return null if no share link exists", async () => {
      vi.mocked(db.getSocialSharesByProjectId).mockResolvedValue([]);

      const caller = socialSharingRouter.createCaller({
        user: {
          id: 1,
          openId: "test-user",
          email: "test@example.com",
          name: "Test User",
          loginMethod: "manus",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });

      const result = await caller.getShareLink({ projectId: 1 });

      expect(result).toBeNull();
    });
  });

  describe("trackShare", () => {
    it("should track a social media share", async () => {
      const mockShare = {
        id: 1,
        projectId: 1,
        userId: 1,
        shareToken: "test-token-123",
        title: "Test Share",
        description: "Test Description",
        isPublic: 1,
        expiresAt: null,
        viewCount: 5,
        shareCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.getSocialShareByToken).mockResolvedValue(mockShare as any);
      vi.mocked(db.incrementShareCount).mockResolvedValue(undefined);
      vi.mocked(db.createShareAnalytic).mockResolvedValue(undefined);

      const caller = socialSharingRouter.createCaller({
        user: null,
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });

      const result = await caller.trackShare({
        shareToken: "test-token-123",
        platform: "twitter",
      });

      expect(result.success).toBe(true);
      expect(result.shareCount).toBe(3);
      expect(db.incrementShareCount).toHaveBeenCalledWith(1);
      expect(db.createShareAnalytic).toHaveBeenCalledWith(1, "twitter");
    });
  });

  describe("generateShareText", () => {
    it("should generate platform-specific share text", async () => {
      const mockProject = {
        id: 1,
        userId: 1,
        title: "My Amazing Video",
        description: "Test Description",
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockShare = {
        id: 1,
        projectId: 1,
        userId: 1,
        shareToken: "test-token-123",
        title: "Test Share",
        description: "Test Description",
        isPublic: 1,
        expiresAt: null,
        viewCount: 5,
        shareCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.getProjectById).mockResolvedValue(mockProject as any);
      vi.mocked(db.getSocialSharesByProjectId).mockResolvedValue([mockShare] as any);

      const caller = socialSharingRouter.createCaller({
        user: {
          id: 1,
          openId: "test-user",
          email: "test@example.com",
          name: "Test User",
          loginMethod: "manus",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "https", headers: {} } as any,
        res: {} as any,
      });

      const result = await caller.generateShareText({
        projectId: 1,
        platform: "twitter",
      });

      expect(result.platform).toBe("twitter");
      expect(result.text).toContain("AI Video Recreator");
      expect(result.url).toBe("/share/test-token-123");
    });
  });
});
