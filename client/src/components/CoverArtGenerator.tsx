import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Sparkles, RefreshCw, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface CoverArtGeneratorProps {
  projectId: number;
  musicPrompt: string;
  videoMood: string;
  videoGenre: string;
  videoTitle: string;
}

export function CoverArtGenerator({
  projectId,
  musicPrompt,
  videoMood,
  videoGenre,
  videoTitle,
}: CoverArtGeneratorProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [variations, setVariations] = useState<any[]>([]);
  const generateMutation = trpc.coverArt.generate.useMutation({
    onSuccess: (result) => {
      setSelectedImage(result.coverArt.url);
      toast.success("Cover art generated successfully!");
    },
    onError: (error) => {
      toast.error("Failed to generate cover art: " + error.message);
    },
  });

  const variationsMutation = trpc.coverArt.generateVariations.useMutation({
    onSuccess: (result) => {
      setVariations(result.variations);
      if (result.variations.length > 0) {
        setSelectedImage(result.variations[0].url);
      }
      toast.success("Cover art variations generated!");
    },
    onError: (error) => {
      toast.error("Failed to generate variations: " + error.message);
    },
  });

  const handleGenerateCoverArt = () => {
    if (!musicPrompt) {
      toast.error("Music prompt is required");
      return;
    }
    generateMutation.mutate({
      projectId,
      musicPrompt,
      videoMood,
      videoGenre,
      videoTitle,
    });
  };

  const handleGenerateVariations = () => {
    if (!musicPrompt) {
      toast.error("Music prompt is required");
      return;
    }
    variationsMutation.mutate({
      projectId,
      musicPrompt,
      videoMood,
      videoGenre,
      videoTitle,
      count: 3,
    });
  };

  const handleDownload = async () => {
    if (!selectedImage) {
      toast.error("No image to download");
      return;
    }

    try {
      const response = await fetch(selectedImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${videoTitle}-cover-art.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Cover art downloaded!");
    } catch (error) {
      toast.error("Failed to download image");
    }
  };

  const isLoading = generateMutation.isPending || variationsMutation.isPending;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-pink-600" />
          <div>
            <CardTitle className="text-lg">Cover Art</CardTitle>
            <CardDescription>AI-generated album cover for your music</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview */}
        {selectedImage ? (
          <div className="space-y-3">
            <div className="relative group">
              <img
                src={selectedImage}
                alt="Cover Art"
                className="w-full aspect-square object-cover rounded-lg border-2 border-slate-200 group-hover:border-pink-400 transition-colors"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-all" />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleDownload}
                variant="outline"
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button
                onClick={handleGenerateVariations}
                disabled={isLoading}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Variations
              </Button>
            </div>
          </div>
        ) : (
          <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center">
            <div className="text-center">
              <ImageIcon className="w-12 h-12 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600">No cover art yet</p>
            </div>
          </div>
        )}

        {/* Variations Grid */}
        {variations.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-2">Variations</h4>
            <div className="grid grid-cols-3 gap-2">
              {variations.map((variation, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(variation.url)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-all hover:border-pink-400 ${
                    selectedImage === variation.url
                      ? "border-pink-600 ring-2 ring-pink-300"
                      : "border-slate-200"
                  }`}
                >
                  <img
                    src={variation.url}
                    alt={`Variation ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Generate Button */}
        <Button
          onClick={handleGenerateCoverArt}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700"
        >
          <Sparkles className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "Generating..." : "Generate Cover Art"}
        </Button>
      </CardContent>
    </Card>
  );
}
