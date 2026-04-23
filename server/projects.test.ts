import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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

describe("project management", () => {
  it("should create a new project", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.projects.create({
      title: "My First Video Recreation",
      description: "Testing the AI Video Recreator app",
    });

    expect(result).toBeDefined();
    expect(result.title).toBe("My First Video Recreation");
    expect(result.description).toBe("Testing the AI Video Recreator app");
    expect(result.status).toBe("uploading");
  });

  it("should list user projects", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    // Create a few projects
    await caller.projects.create({
      title: "Project 1",
      description: "First project",
    });

    await caller.projects.create({
      title: "Project 2",
      description: "Second project",
    });

    // List projects
    const projects = await caller.projects.list();

    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThanOrEqual(2);
  });

  it("should retrieve a specific project", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    // Create a project
    const created = await caller.projects.create({
      title: "Test Project",
      description: "Test description",
    });

    // Retrieve it
    const retrieved = await caller.projects.getById({
      projectId: (created as any).id,
    });

    expect(retrieved).toBeDefined();
    expect(retrieved?.title).toBe("Test Project");
  });

  it("should update project status", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    // Create a project
    const created = await caller.projects.create({
      title: "Status Test",
    });

    // Update status
    const updated = await caller.projects.updateStatus({
      projectId: (created as any).id,
      status: "analyzing",
    });

    expect(updated).toBeDefined();
    expect(updated?.status).toBe("analyzing");
  });

  it("should track project status transitions", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const created = await caller.projects.create({
      title: "Status Transition Test",
    });

    const projectId = (created as any).id;

    // Initial status
    let project = await caller.projects.getById({ projectId });
    expect(project?.status).toBe("uploading");

    // Transition to analyzing
    await caller.projects.updateStatus({
      projectId,
      status: "analyzing",
    });
    project = await caller.projects.getById({ projectId });
    expect(project?.status).toBe("analyzing");

    // Transition to analyzed
    await caller.projects.updateStatus({
      projectId,
      status: "analyzed",
    });
    project = await caller.projects.getById({ projectId });
    expect(project?.status).toBe("analyzed");

    // Transition to completed
    await caller.projects.updateStatus({
      projectId,
      status: "completed",
    });
    project = await caller.projects.getById({ projectId });
    expect(project?.status).toBe("completed");
  });

  it("should isolate projects between users", async () => {
    const user1Ctx = createAuthContext(1);
    const user2Ctx = createAuthContext(2);

    const caller1 = appRouter.createCaller(user1Ctx);
    const caller2 = appRouter.createCaller(user2Ctx);

    // User 1 creates a project
    const user1Project = await caller1.projects.create({
      title: "User 1 Project",
    });

    // User 2 creates a project
    const user2Project = await caller2.projects.create({
      title: "User 2 Project",
    });

    // User 1 should only see their project
    const user1Projects = await caller1.projects.list();
    expect(user1Projects.some((p: any) => p.title === "User 1 Project")).toBe(true);
    expect(user1Projects.some((p: any) => p.title === "User 2 Project")).toBe(false);

    // User 2 should only see their project
    const user2Projects = await caller2.projects.list();
    expect(user2Projects.some((p: any) => p.title === "User 2 Project")).toBe(true);
    expect(user2Projects.some((p: any) => p.title === "User 1 Project")).toBe(false);
  });

  it("should handle project with optional description", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.projects.create({
      title: "No Description Project",
    });

    expect(result).toBeDefined();
    expect(result.title).toBe("No Description Project");
  });

  it("should persist project data across retrieval", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const created = await caller.projects.create({
      title: "Persistence Test",
      description: "Testing data persistence",
    });

    const projectId = (created as any).id;

    // Retrieve multiple times
    const first = await caller.projects.getById({ projectId });
    const second = await caller.projects.getById({ projectId });

    expect(first?.title).toBe(second?.title);
    expect(first?.description).toBe(second?.description);
    expect(first?.createdAt).toEqual(second?.createdAt);
  });
});
