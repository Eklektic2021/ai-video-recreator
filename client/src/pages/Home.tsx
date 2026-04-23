import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Film, Sparkles } from "lucide-react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { data: projects, isLoading } = trpc.projects.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const createMutation = trpc.projects.create.useMutation({
    onSuccess: (result: any) => {
      setLocation(`/project/${result.id}`);
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 flex flex-col items-center justify-center px-4">
        <div className="max-w-md text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl shadow-lg">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-blue-900">MAISuite Flow</h1>
            <h2 className="text-xl font-semibold text-blue-700">Video Recreator</h2>
            <p className="text-lg text-blue-600">Transform any video into a complete recreation guide with AI-powered analysis and prompts for Higgsfield, CapCut, and Suno.</p>
          </div>
          <a href={getLoginUrl()}>
            <Button size="lg" className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold">
              Sign In to Get Started
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-cyan-200">
            <div>
              <h1 className="text-4xl font-bold text-blue-900">Welcome back, {user?.name || "Creator"}</h1>
              <p className="text-blue-600 mt-2">Analyze videos and generate complete recreation guides with MAISuite Flow</p>
            </div>
            <Button
              onClick={() => {
                createMutation.mutate({ title: "Untitled Project", description: "" });
              }}
              disabled={createMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full text-center py-12">
              <div className="inline-block animate-spin">
                <Sparkles className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 mt-2">Loading your projects...</p>
            </div>
          ) : projects && projects.length > 0 ? (
            projects.map((project: any) => (
              <Card
                key={project.id}
                className="hover:shadow-lg transition-all cursor-pointer group"
                onClick={() => setLocation(`/project/${project.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">{project.title}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="p-2 bg-slate-100 group-hover:bg-blue-50 rounded-lg transition-colors">
                      <Film className="w-4 h-4 text-slate-600 group-hover:text-blue-600" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all"
                        style={{
                          width: project.status === "completed" ? "100%" : project.status === "generating" ? "66%" : project.status === "analyzed" ? "33%" : "10%",
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-600 capitalize">{project.status}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full">
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="p-3 bg-slate-100 rounded-full mb-4">
                    <Film className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No projects yet</h3>
                  <p className="text-slate-600 text-center mb-6">Create your first video recreation project to get started</p>
                  <Button
                    onClick={() => {
                      createMutation.mutate({ title: "Untitled Project", description: "" });
                    }}
                    disabled={createMutation.isPending}
                    className="bg-gradient-to-r from-blue-600 to-purple-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Project
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
