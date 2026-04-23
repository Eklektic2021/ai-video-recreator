import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, projects, analyses, scenes, prompts, userProfiles, InsertUserProfile, userFollowers, portfolioItems, projectTemplates, InsertProjectTemplate, templateRatings, projectCollaborators, notifications, userPreferences, InsertUserPreference } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Projects
export async function createProject(userId: number, title: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(projects).values({ userId, title, description, status: "uploading" });
  return result;
}

export async function getUserProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.userId, userId));
}

export async function getProjectById(projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  return result[0];
}

export async function updateProjectStatus(projectId: number, status: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(projects).set({ status: status as any }).where(eq(projects.id, projectId));
}

// Analyses
export async function createAnalysis(projectId: number, analysisData: string, overallMood?: string, overallGenre?: string, duration?: number) {
  const db = await getDb();
  if (!db) return;
  return db.insert(analyses).values({ projectId, analysisData, overallMood, overallGenre, duration });
}

export async function getAnalysisByProjectId(projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(analyses).where(eq(analyses.projectId, projectId)).limit(1);
  return result[0];
}

// Scenes
export async function createScene(analysisId: number, sceneNumber: number, sceneData: any) {
  const db = await getDb();
  if (!db) return;
  return db.insert(scenes).values({
    analysisId,
    sceneNumber,
    title: sceneData.title || `Scene ${sceneNumber}`,
    description: sceneData.description || "",
    timeStart: sceneData.timeStart || 0,
    timeEnd: sceneData.timeEnd || 0,
    higgsFieldPrompt: sceneData.higgsFieldPrompt || null,
    capCutInstructions: sceneData.capCutInstructions || null,
    sfxBreakdown: sceneData.sfxBreakdown ? JSON.stringify(sceneData.sfxBreakdown) : null,
  });
}

export async function getScenesByAnalysisId(analysisId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scenes).where(eq(scenes.analysisId, analysisId));
}

// Prompts
export async function createPrompt(projectId: number, promptType: string, promptContent: string, generatedContent?: string) {
  const db = await getDb();
  if (!db) return;
  return db.insert(prompts).values({ projectId, promptType: promptType as any, promptContent, generatedContent });
}

export async function getPromptsByProjectId(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(prompts).where(eq(prompts.projectId, projectId));
}


// Social Sharing
import { socialShares, shareAnalytics } from "../drizzle/schema";
import { sql } from "drizzle-orm";

export async function createSocialShare(projectId: number, userId: number, shareToken: string, title?: string, description?: string) {
  const db = await getDb();
  if (!db) return;
  return db.insert(socialShares).values({
    projectId,
    userId,
    shareToken,
    title: title || "",
    description: description || "",
    isPublic: 1,
  });
}

export async function getSocialShareByToken(shareToken: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(socialShares).where(eq(socialShares.shareToken, shareToken)).limit(1);
  return result[0] || null;
}

export async function getSocialSharesByProjectId(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(socialShares).where(eq(socialShares.projectId, projectId));
}

export async function updateShareViewCount(shareId: number) {
  const db = await getDb();
  if (!db) return;
  return db.update(socialShares).set({ viewCount: sql`${socialShares.viewCount} + 1` }).where(eq(socialShares.id, shareId));
}

export async function incrementShareCount(shareId: number) {
  const db = await getDb();
  if (!db) return;
  return db.update(socialShares).set({ shareCount: sql`${socialShares.shareCount} + 1` }).where(eq(socialShares.id, shareId));
}

export async function createShareAnalytic(shareId: number, platform: string) {
  const db = await getDb();
  if (!db) return;
  return db.insert(shareAnalytics).values({
    shareId,
    platform,
  });
}

export async function getShareAnalytics(shareId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareAnalytics).where(eq(shareAnalytics.shareId, shareId));
}


// User Profile Helpers
export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createOrUpdateUserProfile(userId: number, profile: Partial<InsertUserProfile>) {
  const db = await getDb();
  if (!db) return undefined;
  
  const existing = await getUserProfile(userId);
  
  if (existing) {
    await db.update(userProfiles).set(profile).where(eq(userProfiles.userId, userId));
  } else {
    await db.insert(userProfiles).values({ userId, ...profile });
  }
  
  return await getUserProfile(userId);
}

export async function followUser(followerId: number, followingId: number) {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db.insert(userFollowers).values({ followerId, followingId });
    
    // Update follower/following counts
    const followerProfile = await getUserProfile(followingId);
    const followerCount = (followerProfile?.followerCount || 0) + 1;
    await db.update(userProfiles).set({ followerCount }).where(eq(userProfiles.userId, followingId));
    
    const followingProfile = await getUserProfile(followerId);
    const followingCount = (followingProfile?.followingCount || 0) + 1;
    await db.update(userProfiles).set({ followingCount }).where(eq(userProfiles.userId, followerId));
    
    return true;
  } catch (error) {
    console.error("Error following user:", error);
    return false;
  }
}

export async function unfollowUser(followerId: number, followingId: number) {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db.delete(userFollowers).where(
      and(eq(userFollowers.followerId, followerId), eq(userFollowers.followingId, followingId))
    );
    
    // Update follower/following counts
    const followerProfile = await getUserProfile(followingId);
    const followerCount = Math.max(0, (followerProfile?.followerCount || 1) - 1);
    await db.update(userProfiles).set({ followerCount }).where(eq(userProfiles.userId, followingId));
    
    const followingProfile = await getUserProfile(followerId);
    const followingCount = Math.max(0, (followingProfile?.followingCount || 1) - 1);
    await db.update(userProfiles).set({ followingCount }).where(eq(userProfiles.userId, followerId));
    
    return true;
  } catch (error) {
    console.error("Error unfollowing user:", error);
    return false;
  }
}

export async function isFollowing(followerId: number, followingId: number) {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.select().from(userFollowers)
    .where(and(eq(userFollowers.followerId, followerId), eq(userFollowers.followingId, followingId)))
    .limit(1);
  
  return result.length > 0;
}

export async function getFollowers(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(userFollowers).where(eq(userFollowers.followingId, userId));
}

export async function getFollowing(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(userFollowers).where(eq(userFollowers.followerId, userId));
}

// Portfolio Helpers
export async function addToPortfolio(userId: number, projectId: number, featured: boolean = false) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.insert(portfolioItems).values({
    userId,
    projectId,
    featured: featured ? "true" : "false",
  });
  
  return result;
}

export async function removeFromPortfolio(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db.delete(portfolioItems).where(
      and(eq(portfolioItems.userId, userId), eq(portfolioItems.projectId, projectId))
    );
    return true;
  } catch (error) {
    console.error("Error removing from portfolio:", error);
    return false;
  }
}

export async function getPortfolioItems(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(portfolioItems)
    .where(eq(portfolioItems.userId, userId))
    .orderBy(portfolioItems.displayOrder);
}

export async function updatePortfolioItemOrder(portfolioItemId: number, displayOrder: number) {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db.update(portfolioItems).set({ displayOrder }).where(eq(portfolioItems.id, portfolioItemId));
    return true;
  } catch (error) {
    console.error("Error updating portfolio item order:", error);
    return false;
  }
}


// Project Template Helpers
export async function getProjectTemplates(category?: string) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(projectTemplates).where(eq(projectTemplates.isPublic, "true"));
  
  if (category) {
    query = db.select().from(projectTemplates)
      .where(and(eq(projectTemplates.isPublic, "true"), eq(projectTemplates.category, category)));
  }
  
  return await query;
}

export async function getTemplateById(templateId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(projectTemplates).where(eq(projectTemplates.id, templateId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createProjectTemplate(template: InsertProjectTemplate) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.insert(projectTemplates).values(template);
  return result;
}

export async function rateTemplate(templateId: number, userId: number, rating: number, review?: string) {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db.insert(templateRatings).values({ templateId, userId, rating, review });
    
    // Update template rating
    const ratings = await db.select().from(templateRatings).where(eq(templateRatings.templateId, templateId));
    const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
    
    await db.update(projectTemplates)
      .set({ rating: avgRating, ratingCount: ratings.length })
      .where(eq(projectTemplates.id, templateId));
    
    return true;
  } catch (error) {
    console.error("Error rating template:", error);
    return false;
  }
}

export async function getTemplateRatings(templateId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(templateRatings).where(eq(templateRatings.templateId, templateId));
}

export async function incrementTemplateUsage(templateId: number) {
  const db = await getDb();
  if (!db) return false;
  
  try {
    const template = await getTemplateById(templateId);
    if (!template) return false;
    
    await db.update(projectTemplates)
      .set({ usageCount: (template.usageCount || 0) + 1 })
      .where(eq(projectTemplates.id, templateId));
    
    return true;
  } catch (error) {
    console.error("Error incrementing template usage:", error);
    return false;
  }
}

export async function getPopularTemplates(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(projectTemplates)
    .where(eq(projectTemplates.isPublic, "true"))
    .orderBy(projectTemplates.usageCount)
    .limit(limit);
}

export async function getTopRatedTemplates(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(projectTemplates)
    .where(eq(projectTemplates.isPublic, "true"))
    .orderBy(projectTemplates.rating)
    .limit(limit);
}


// Collaboration Helpers
export async function addCollaborator(projectId: number, userId: number, role: "viewer" | "editor" | "owner" = "viewer") {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db.insert(projectCollaborators).values({ projectId, userId, role });
    return true;
  } catch (error) {
    console.error("Error adding collaborator:", error);
    return false;
  }
}

export async function getProjectCollaborators(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(projectCollaborators).where(eq(projectCollaborators.projectId, projectId));
}

export async function removeCollaborator(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db.delete(projectCollaborators).where(
      and(eq(projectCollaborators.projectId, projectId), eq(projectCollaborators.userId, userId))
    );
    return true;
  } catch (error) {
    console.error("Error removing collaborator:", error);
    return false;
  }
}

// Notification Helpers
export async function createNotification(userId: number, type: string, title: string, message?: string, relatedProjectId?: number) {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db.insert(notifications).values({ userId, type, title, message, relatedProjectId });
    return true;
  } catch (error) {
    console.error("Error creating notification:", error);
    return false;
  }
}

export async function getUserNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(notifications).where(eq(notifications.userId, userId));
}

export async function markNotificationAsRead(notificationId: number) {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db.update(notifications).set({ isRead: "true" }).where(eq(notifications.id, notificationId));
    return true;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return false;
  }
}

// User Preferences Helpers
export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createOrUpdateUserPreferences(userId: number, prefs: Partial<InsertUserPreference>) {
  const db = await getDb();
  if (!db) return undefined;
  
  const existing = await getUserPreferences(userId);
  
  if (existing) {
    await db.update(userPreferences).set(prefs).where(eq(userPreferences.userId, userId));
  } else {
    await db.insert(userPreferences).values({ userId, ...prefs });
  }
  
  return await getUserPreferences(userId);
}
