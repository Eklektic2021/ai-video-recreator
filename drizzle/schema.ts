import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, float } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// User Profiles Table
export const userProfiles = mysqlTable("userProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  bio: text("bio"),
  avatar: varchar("avatar", { length: 512 }),
  website: varchar("website", { length: 512 }),
  twitter: varchar("twitter", { length: 255 }),
  instagram: varchar("instagram", { length: 255 }),
  linkedin: varchar("linkedin", { length: 255 }),
  isPublic: mysqlEnum("isPublic", ["true", "false"]).default("true").notNull(),
  followerCount: int("followerCount").default(0).notNull(),
  followingCount: int("followingCount").default(0).notNull(),
  totalProjects: int("totalProjects").default(0).notNull(),
  totalShares: int("totalShares").default(0).notNull(),
  verificationBadge: mysqlEnum("verificationBadge", ["none", "verified", "featured"]).default("none").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

// User Followers Table  
export const userFollowers = mysqlTable("userFollowers", {
  id: int("id").autoincrement().primaryKey(),
  followerId: int("followerId").notNull(),
  followingId: int("followingId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserFollower = typeof userFollowers.$inferSelect;
export type InsertUserFollower = typeof userFollowers.$inferInsert;

// Portfolio Items Table (featured projects)
export const portfolioItems = mysqlTable("portfolioItems", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId").notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  featured: mysqlEnum("featured", ["true", "false"]).default("false").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PortfolioItem = typeof portfolioItems.$inferSelect;
export type InsertPortfolioItem = typeof portfolioItems.$inferInsert;

/**
 * Video recreation projects
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  videoUrl: text("videoUrl"), // S3 storage URL
  videoKey: text("videoKey"), // S3 storage key
  status: mysqlEnum("status", ["uploading", "analyzing", "analyzed", "generating", "completed"]).default("uploading").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Analyses table - stores AI analysis results for each project
 */
export const analyses = mysqlTable("analyses", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  analysisData: text("analysisData"), // JSON string of analysis results
  overallMood: varchar("overallMood", { length: 255 }),
  overallGenre: varchar("overallGenre", { length: 255 }),
  duration: int("duration"), // in seconds
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = typeof analyses.$inferInsert;

/**
 * Scenes table - stores individual scene data for each analysis
 */
export const scenes = mysqlTable("scenes", {
  id: int("id").autoincrement().primaryKey(),
  analysisId: int("analysisId").notNull().references(() => analyses.id, { onDelete: "cascade" }),
  sceneNumber: int("sceneNumber").notNull(),
  title: varchar("title", { length: 255 }),
  description: text("description"),
  timeStart: int("timeStart"), // in seconds
  timeEnd: int("timeEnd"), // in seconds
  higgsFieldPrompt: text("higgsFieldPrompt"),
  capCutInstructions: text("capCutInstructions"),
  sfxBreakdown: text("sfxBreakdown"), // JSON string
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Scene = typeof scenes.$inferSelect;
export type InsertScene = typeof scenes.$inferInsert;

/**
 * Prompts table - stores generated prompts for music, cover art, etc.
 */
export const prompts = mysqlTable("prompts", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  promptType: mysqlEnum("promptType", ["suno_music", "cover_art", "master_guide", "higgsfield_image", "capcut_instructions", "sfx_breakdown"]).notNull(),
  promptContent: text("promptContent"),
  generatedContent: text("generatedContent"), // URL or content
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Prompt = typeof prompts.$inferSelect;
export type InsertPrompt = typeof prompts.$inferInsert;

/**
 * Social Shares table - stores shared project links and metadata
 */
export const socialShares = mysqlTable("socialShares", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  shareToken: varchar("shareToken", { length: 64 }).notNull().unique(), // Unique token for public access
  title: varchar("title", { length: 255 }),
  description: text("description"),
  isPublic: int("isPublic").default(1).notNull(), // 1 = public, 0 = private
  expiresAt: timestamp("expiresAt"), // Optional expiration date
  viewCount: int("viewCount").default(0).notNull(),
  shareCount: int("shareCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SocialShare = typeof socialShares.$inferSelect;
export type InsertSocialShare = typeof socialShares.$inferInsert;

/**
 * Share Analytics table - tracks social media shares
 */
export const shareAnalytics = mysqlTable("shareAnalytics", {
  id: int("id").autoincrement().primaryKey(),
  shareId: int("shareId").notNull().references(() => socialShares.id, { onDelete: "cascade" }),
  platform: varchar("platform", { length: 50 }).notNull(), // twitter, facebook, linkedin, instagram, tiktok, pinterest, email
  sharedAt: timestamp("sharedAt").defaultNow().notNull(),
  clicks: int("clicks").default(0).notNull(),
  impressions: int("impressions").default(0).notNull(),
});

export type ShareAnalytic = typeof shareAnalytics.$inferSelect;
export type InsertShareAnalytic = typeof shareAnalytics.$inferInsert;

/**
 * Project Templates
 */
export const projectTemplates = mysqlTable("projectTemplates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(),
  thumbnail: varchar("thumbnail", { length: 512 }),
  defaultMood: varchar("defaultMood", { length: 100 }),
  defaultGenre: varchar("defaultGenre", { length: 100 }),
  estimatedDuration: int("estimatedDuration"),
  sceneCount: int("sceneCount").default(1).notNull(),
  isPublic: mysqlEnum("isPublic", ["true", "false"]).default("true").notNull(),
  rating: float("rating").default(0),
  ratingCount: int("ratingCount").default(0).notNull(),
  usageCount: int("usageCount").default(0).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProjectTemplate = typeof projectTemplates.$inferSelect;
export type InsertProjectTemplate = typeof projectTemplates.$inferInsert;

/**
 * Template Ratings
 */
export const templateRatings = mysqlTable("templateRatings", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  userId: int("userId").notNull(),
  rating: int("rating").notNull(),
  review: text("review"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TemplateRating = typeof templateRatings.$inferSelect;
export type InsertTemplateRating = typeof templateRatings.$inferInsert;


/**
 * Project Collaborators
 */
export const projectCollaborators = mysqlTable("projectCollaborators", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["viewer", "editor", "owner"]).default("viewer").notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type ProjectCollaborator = typeof projectCollaborators.$inferSelect;
export type InsertProjectCollaborator = typeof projectCollaborators.$inferInsert;

/**
 * Notifications
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  relatedProjectId: int("relatedProjectId"),
  isRead: mysqlEnum("isRead", ["true", "false"]).default("false").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * User Preferences (for dark mode, etc.)
 */
export const userPreferences = mysqlTable("userPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  theme: mysqlEnum("theme", ["light", "dark", "system"]).default("system").notNull(),
  emailNotifications: mysqlEnum("emailNotifications", ["true", "false"]).default("true").notNull(),
  inAppNotifications: mysqlEnum("inAppNotifications", ["true", "false"]).default("true").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;
