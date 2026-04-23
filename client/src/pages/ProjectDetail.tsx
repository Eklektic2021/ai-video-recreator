import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Upload, Sparkles, Music, Image as ImageIcon, Settings, Play } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { HiggsFieldPromptCard } from "@/components/HiggsFieldPromptCard";
import { CapCutInstructionsCard } from "@/components/CapCutInstructionsCard";
import { SunoMusicPromptCard } from "@/components/SunoMusicPromptCard";
import { SFXBreakdownCard } from "@/components/SFXBreakdownCard";
import { CoverArtGenerator } from "@/components/CoverArtGenerator";
import SocialSharingPanel from "@/components/SocialSharingPanel";

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, setLocation] = useLocation();
  const { data: project, isLoading: projectLoading } = trpc.projects.getById.useQuery({
    projectId: parseInt(projectId || "0"),
  });
  const { data: analysis, isLoading: analysisLoading } = trpc.analysis.getAnalysis.useQuery(
    { projectId: parseInt(projectId || "0") },
    { enabled: !!projectId }
  );
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analyzeMutation = trpc.analysis.analyzeVideo.useMutation({
    onSuccess: () => {
      toast.success("Video analysis complete!");
    },
    onError: (error) => {
      toast.error("Analysis failed: " + error.message);
    },
  });

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-2" />
          <p className="text-slate-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-slate-600 mb-4">Project not found</p>
            <Button onClick={() => setLocation("/")} variant="outline">
              Back to Projects
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024 * 1024) {
        toast.error("Video file must be less than 500MB");
        return;
      }
      setVideoFile(file);
      toast.success("Video selected. Ready to analyze!");
    }
  };

  const handleAnalyze = async () => {
    if (!videoFile) {
      toast.error("Please select a video first");
      return;
    }
    analyzeMutation.mutate({
      projectId: parseInt(projectId || "0"),
      videoUrl: videoFile.name,
      useAiTwin: true,
    });
  };

  const hasAnalysis = analysis?.analysis;
  let promptPackage: any = null;
  if (hasAnalysis) {
    try {
      const sunoPrompt = analysis.prompts?.find((p: any) => p.promptType === 'suno_music');
      const parsedSuno = sunoPrompt?.promptContent ? JSON.parse(sunoPrompt.promptContent) : null;
      promptPackage = {
        higgsFieldPrompts: analysis.scenes?.map((s: any, idx: number) => ({
          sceneNumber: s.sceneNumber,
          prompt: s.higgsFieldPrompt || '',
          aiTwinTips: `Tips for Scene ${s.sceneNumber}`,
        })) || [],
        capCutInstructions: analysis.scenes?.map((s: any) => ({
          sceneNumber: s.sceneNumber,
          motionInstructions: s.capCutInstructions || '',
          colorGrading: 'Color grading instructions',
          transitions: 'Transition recommendations',
          overlays: 'Overlay suggestions',
        })) || [],
        sunoMusicPrompt: parsedSuno || {},
        sfxBreakdown: analysis.scenes?.map((s: any) => ({
          sceneNumber: s.sceneNumber,
          soundEffects: s.sfxBreakdown ? JSON.parse(s.sfxBreakdown) : [],
        })) || [],
      };
    } catch (e) {
      console.error('Error parsing prompts:', e);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Projects
          </button>
          <h1 className="text-3xl font-bold text-slate-900">{project.title}</h1>
          <p className="text-slate-600 mt-2">Status: <span className="capitalize font-semibold text-blue-600">{project.status}</span></p>
        </div>

        {/* Main Content */}
        <Tabs defaultValue={hasAnalysis ? "prompts" : "upload"} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="analysis" disabled={!hasAnalysis}>Analysis</TabsTrigger>
            <TabsTrigger value="prompts" disabled={!hasAnalysis}>Prompts</TabsTrigger>
            <TabsTrigger value="guide" disabled={!hasAnalysis}>Guide</TabsTrigger>
            <TabsTrigger value="share" disabled={!hasAnalysis}>Share</TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Upload Video</CardTitle>
                <CardDescription>Upload your video file for AI analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="hidden"
                  />
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {videoFile ? videoFile.name : "Drop your video here"}
                  </h3>
                  <p className="text-slate-600 mb-4">
                    or click to browse (Max 500MB)
                  </p>
                  {videoFile && (
                    <div className="mt-6 space-y-4">
                      <Button
                        onClick={handleAnalyze}
                        disabled={analyzeMutation.isPending}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {analyzeMutation.isPending ? "Analyzing..." : "Analyze Video"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setVideoFile(null)}
                      >
                        Clear Selection
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="analysis">
            <Card>
              <CardHeader>
                <CardTitle>Scene Analysis</CardTitle>
                <CardDescription>AI-powered breakdown of your video</CardDescription>
              </CardHeader>
              <CardContent>
                {analysisLoading ? (
                  <div className="text-center py-12">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 animate-spin text-slate-400" />
                    <p className="text-slate-600">Loading analysis...</p>
                  </div>
                ) : analysis?.scenes && analysis.scenes.length > 0 ? (
                  <div className="space-y-4">
                    {analysis.scenes.map((scene: any) => (
                      <Card key={scene.id} className="bg-slate-50">
                        <CardContent className="pt-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-slate-600 uppercase">Scene {scene.sceneNumber}</p>
                              <p className="font-semibold text-slate-900">{scene.title}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600 uppercase">Duration</p>
                              <p className="font-semibold text-slate-900">{scene.timeEnd - scene.timeStart}s</p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-sm text-slate-700">{scene.description}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-600">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Upload and analyze your video to see the scene breakdown</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Prompts Tab */}
          <TabsContent value="prompts">
            <div className="space-y-8">
              {/* Higgsfield Prompts */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <ImageIcon className="w-6 h-6" />
                  Higgsfield Image Prompts
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {promptPackage?.higgsFieldPrompts?.map((prompt: any) => (
                    <HiggsFieldPromptCard
                      key={prompt.sceneNumber}
                      sceneNumber={prompt.sceneNumber}
                      prompt={prompt.prompt}
                      aiTwinTips={prompt.aiTwinTips}
                    />
                  ))}
                </div>
              </div>

              {/* CapCut Instructions */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Settings className="w-6 h-6" />
                  CapCut Editing Instructions
                </h2>
                <div className="grid grid-cols-1 gap-6">
                  {promptPackage?.capCutInstructions?.map((instructions: any) => (
                    <CapCutInstructionsCard
                      key={instructions.sceneNumber}
                      sceneNumber={instructions.sceneNumber}
                      motionInstructions={instructions.motionInstructions}
                      colorGrading={instructions.colorGrading}
                      transitions={instructions.transitions}
                      overlays={instructions.overlays}
                    />
                  ))}
                </div>
              </div>

              {/* Suno Music Prompt & Cover Art */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Music className="w-6 h-6" />
                  Suno Music Prompt & Cover Art
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {promptPackage?.sunoMusicPrompt && (
                    <SunoMusicPromptCard
                      mainPrompt={promptPackage.sunoMusicPrompt.mainPrompt}
                      arrangementBreakdown={promptPackage.sunoMusicPrompt.arrangementBreakdown}
                      estimatedDuration={promptPackage.sunoMusicPrompt.estimatedDuration}
                    />
                  )}
                  {promptPackage?.sunoMusicPrompt && analysis?.analysis && (
                    <CoverArtGenerator
                      projectId={parseInt(projectId || "0")}
                      musicPrompt={promptPackage.sunoMusicPrompt.mainPrompt}
                      videoMood={analysis.analysis.overallMood || "cinematic"}
                      videoGenre={analysis.analysis.overallGenre || "drama"}
                      videoTitle={project?.title || "Untitled"}
                    />
                  )}
                </div>
              </div>

              {/* SFX Breakdown */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Sound Effects Breakdown</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {promptPackage?.sfxBreakdown?.map((sfx: any) => (
                    <SFXBreakdownCard
                      key={sfx.sceneNumber}
                      sceneNumber={sfx.sceneNumber}
                      soundEffects={sfx.soundEffects}
                    />
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Guide Tab */}
          <TabsContent value="guide">
            <Card>
              <CardHeader>
                <CardTitle>Master Recreation Guide</CardTitle>
                <CardDescription>Complete step-by-step instructions for recreating your video</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-slate-600">
                  <p>Your guide will be generated after all prompts are created</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Share Tab */}
          <TabsContent value="share">
            <SocialSharingPanel projectId={parseInt(projectId || "0")} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
