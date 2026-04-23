import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Volume2 } from "lucide-react";

interface SoundEffect {
  name: string;
  description: string;
  volume: "very_low" | "low" | "medium" | "medium_high" | "high";
  placement: string;
}

interface SFXBreakdownCardProps {
  sceneNumber: number;
  soundEffects: SoundEffect[];
}

export function SFXBreakdownCard({ sceneNumber, soundEffects }: SFXBreakdownCardProps) {
  const getVolumeColor = (volume: string) => {
    switch (volume) {
      case "very_low":
        return "bg-blue-100 text-blue-900";
      case "low":
        return "bg-cyan-100 text-cyan-900";
      case "medium":
        return "bg-yellow-100 text-yellow-900";
      case "medium_high":
        return "bg-orange-100 text-orange-900";
      case "high":
        return "bg-red-100 text-red-900";
      default:
        return "bg-slate-100 text-slate-900";
    }
  };

  const getVolumeLabel = (volume: string) => {
    return volume.replace("_", " ").toUpperCase();
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-green-600" />
          <div>
            <CardTitle className="text-lg">Scene {sceneNumber}</CardTitle>
            <CardDescription>Sound Effects Breakdown</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {soundEffects.length > 0 ? (
          <div className="space-y-3">
            {soundEffects.map((sfx, index) => (
              <div key={index} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-slate-900">{sfx.name}</h4>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getVolumeColor(sfx.volume)}`}>
                    {getVolumeLabel(sfx.volume)}
                  </span>
                </div>
                <p className="text-sm text-slate-700 mb-2">{sfx.description}</p>
                <p className="text-xs text-slate-600 italic">Placement: {sfx.placement}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600 text-center py-4">No sound effects for this scene</p>
        )}
      </CardContent>
    </Card>
  );
}
