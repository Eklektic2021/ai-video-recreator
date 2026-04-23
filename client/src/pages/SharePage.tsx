import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function SharePage() {
  const [, params] = useRoute("/share/:shareToken");
  const shareToken = params?.shareToken || "";

  const { data: sharedProject, isLoading, error } = trpc.socialSharing.getSharedProject.useQuery(
    { shareToken },
    { enabled: !!shareToken }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-indigo-600" />
          <p className="text-gray-600">Loading shared project...</p>
        </div>
      </div>
    );
  }

  if (error || !sharedProject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Share Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This shared project is not available or has expired.
              </AlertDescription>
            </Alert>
            <Button className="w-full mt-4" onClick={() => window.location.href = "/"}>
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {sharedProject.share.title}
          </h1>
          <p className="text-gray-600 text-lg">
            {sharedProject.share.description}
          </p>
        </div>

        {/* Project Details */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Project Info */}
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Project Title</p>
                <p className="text-lg font-semibold">{sharedProject.project.title}</p>
              </div>
              {sharedProject.project.description && (
                <div>
                  <p className="text-sm text-gray-600">Description</p>
                  <p className="text-gray-700">{sharedProject.project.description}</p>
                </div>
              )}
              {sharedProject.analysis && (
                <>
                  <div>
                    <p className="text-sm text-gray-600">Mood</p>
                    <p className="text-gray-700 capitalize">{sharedProject.analysis.mood}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Genre</p>
                    <p className="text-gray-700 capitalize">{sharedProject.analysis.genre}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Share Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Share Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Views</p>
                  <p className="text-3xl font-bold text-blue-600">{sharedProject.share.viewCount}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">Shares</p>
                  <p className="text-3xl font-bold text-purple-600">{sharedProject.share.shareCount}</p>
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600">Shared on</p>
                <p className="text-gray-700">
                  {new Date(sharedProject.share.createdAt).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Generated Prompts */}
        {sharedProject.prompts && sharedProject.prompts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Generated Prompts</CardTitle>
              <CardDescription>
                Recreation guides and prompts for this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sharedProject.prompts.map((prompt: any, index: number) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg border">
                    <p className="text-sm font-semibold text-gray-700 mb-2 capitalize">
                      {prompt.type.replace(/_/g, " ")}
                    </p>
                    <p className="text-gray-600 text-sm line-clamp-3">
                      {typeof prompt.content === 'string' ? prompt.content : JSON.stringify(prompt.content)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-4">
            Want to create your own AI video recreation?
          </p>
          <Button size="lg" onClick={() => window.location.href = "/"}>
            Get Started with AI Video Recreator
          </Button>
        </div>
      </div>
    </div>
  );
}
