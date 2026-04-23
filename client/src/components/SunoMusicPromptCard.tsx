import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Music } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ArrangementSection {
  timeRange: string;
  section: string;
  description: string;
  intensity: number;
}

interface SunoMusicPromptCardProps {
  mainPrompt: string;
  arrangementBreakdown: ArrangementSection[];
  estimatedDuration: number;
}

export function SunoMusicPromptCard({
  mainPrompt,
  arrangementBreakdown,
  estimatedDuration,
}: SunoMusicPromptCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(mainPrompt);
    setCopied(true);
    toast.success("Music prompt copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const getIntensityColor = (intensity: number) => {
    if (intensity <= 3) return "bg-blue-100 text-blue-900";
    if (intensity <= 6) return "bg-yellow-100 text-yellow-900";
    return "bg-red-100 text-red-900";
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-purple-600" />
            <div>
              <CardTitle className="text-lg">Suno Music Prompt</CardTitle>
              <CardDescription>Duration: {estimatedDuration}s</CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-8 w-8 p-0"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Prompt */}
        <div>
          <h4 className="font-semibold text-slate-900 mb-2">Main Prompt</h4>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <p className="text-sm text-slate-700 leading-relaxed">{mainPrompt}</p>
          </div>
        </div>

        {/* Arrangement Breakdown */}
        {arrangementBreakdown.length > 0 && (
          <div>
            <h4 className="font-semibold text-slate-900 mb-3">Arrangement Breakdown</h4>
            <div className="space-y-3">
              {arrangementBreakdown.map((section, index) => (
                <div key={index} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{section.section}</p>
                      <p className="text-xs text-slate-600">{section.timeRange}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getIntensityColor(section.intensity)}`}>
                      Intensity: {section.intensity}/10
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">{section.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generate Button */}
        <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
          <Music className="w-4 h-4 mr-2" />
          Generate with Suno
        </Button>
      </CardContent>
    </Card>
  );
}
