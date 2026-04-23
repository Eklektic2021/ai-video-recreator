import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CapCutInstructionsCardProps {
  sceneNumber: number;
  motionInstructions: string;
  colorGrading: string;
  transitions: string;
  overlays: string;
}

export function CapCutInstructionsCard({
  sceneNumber,
  motionInstructions,
  colorGrading,
  transitions,
  overlays,
}: CapCutInstructionsCardProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopied(section);
    toast.success(`${section} copied!`);
    setTimeout(() => setCopied(null), 2000);
  };

  const InstructionSection = ({ title, content }: { title: string; content: string }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-900">{title}</h4>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleCopy(content, title)}
          className="h-8 w-8 p-0"
        >
          {copied === title ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      </div>
      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Scene {sceneNumber}</CardTitle>
        <CardDescription>CapCut Editing Instructions</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="motion" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="motion" className="text-xs">Motion</TabsTrigger>
            <TabsTrigger value="color" className="text-xs">Color</TabsTrigger>
            <TabsTrigger value="transitions" className="text-xs">Transitions</TabsTrigger>
            <TabsTrigger value="overlays" className="text-xs">Overlays</TabsTrigger>
          </TabsList>

          <TabsContent value="motion" className="space-y-3">
            <InstructionSection title="Motion Instructions" content={motionInstructions} />
          </TabsContent>

          <TabsContent value="color" className="space-y-3">
            <InstructionSection title="Color Grading" content={colorGrading} />
          </TabsContent>

          <TabsContent value="transitions" className="space-y-3">
            <InstructionSection title="Transitions" content={transitions} />
          </TabsContent>

          <TabsContent value="overlays" className="space-y-3">
            <InstructionSection title="Overlays & Effects" content={overlays} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
