import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface HiggsFieldPromptCardProps {
  sceneNumber: number;
  prompt: string;
  aiTwinTips: string;
}

export function HiggsFieldPromptCard({ sceneNumber, prompt, aiTwinTips }: HiggsFieldPromptCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast.success("Prompt copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">Scene {sceneNumber}</CardTitle>
            <CardDescription>Higgsfield Motion Prompt</CardDescription>
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
      <CardContent className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-sm text-slate-700 leading-relaxed">{prompt}</p>
        </div>

        {aiTwinTips && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">AI Twin Integration Tips</h4>
            <p className="text-sm text-blue-800 leading-relaxed">{aiTwinTips}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
