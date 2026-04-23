import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Star, Zap, TrendingUp, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function TemplatesPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();

  const { data: templates, isLoading: templatesLoading } = trpc.templates.listPublic.useQuery(
    { category: selectedCategory }
  );

  const { data: popularTemplates } = trpc.templates.getPopular.useQuery({ limit: 6 });
  const { data: topRatedTemplates } = trpc.templates.getTopRated.useQuery({ limit: 6 });

  const createProjectMutation = trpc.templates.createProjectFromTemplate.useMutation({
    onSuccess: (project) => {
      toast.success("Project created from template!");
      setLocation(`/project/${project.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const categories = ["cinematic", "music_video", "tutorial", "vlog", "documentary", "commercial"];

  const TemplateCard = ({ template }: { template: Record<string, any> }) => (
    <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
      <CardContent className="pt-6 flex-1 flex flex-col">
        {/* Thumbnail */}
        <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
          {template.thumbnail ? (
            <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover" />
          ) : (
            <div className="text-slate-400 text-center">
              <div className="text-3xl mb-2">🎬</div>
              <span className="text-sm">{template.category}</span>
            </div>
          )}
        </div>

        {/* Title & Description */}
        <h3 className="font-semibold text-slate-900 mb-2">{template.name}</h3>
        {template.description && (
          <p className="text-sm text-slate-600 mb-3 flex-1">{template.description}</p>
        )}

        {/* Metadata */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {template.defaultMood && (
            <Badge variant="secondary" className="text-xs">
              {template.defaultMood}
            </Badge>
          )}
          {template.defaultGenre && (
            <Badge variant="secondary" className="text-xs">
              {template.defaultGenre}
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-slate-600 mb-4 pb-4 border-b">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span>{template.rating?.toFixed(1) || "0"}</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            <span>{template.usageCount} uses</span>
          </div>
          {template.estimatedDuration && (
            <div className="flex items-center gap-1">
              <span>{Math.round(template.estimatedDuration / 60)}m</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <Button
          onClick={() => {
            if (!user) {
              toast.error("Please log in to create a project");
              return;
            }
            createProjectMutation.mutate({
              templateId: template.id,
              projectTitle: `${template.name} Project`,
              projectDescription: template.description,
            });
          }}
          disabled={createProjectMutation.isPending}
          className="w-full gap-2"
        >
          <Zap className="w-4 h-4" />
          Use Template
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Project Templates</h1>
          <p className="text-lg text-slate-600">
            Get started quickly with professionally designed templates for different video types.
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All Templates</TabsTrigger>
            <TabsTrigger value="popular">Popular</TabsTrigger>
            <TabsTrigger value="toprated">Top Rated</TabsTrigger>
            <TabsTrigger value="categories">By Category</TabsTrigger>
          </TabsList>

          {/* All Templates Tab */}
          <TabsContent value="all">
            {templatesLoading ? (
              <div className="text-center py-12">
                <p className="text-slate-600">Loading templates...</p>
              </div>
            ) : templates && templates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                {templates.map((template: any) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            ) : (
              <Card className="mt-6">
                <CardContent className="pt-6 text-center text-slate-600">
                  <p>No templates available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Popular Templates Tab */}
          <TabsContent value="popular">
            {popularTemplates && popularTemplates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                {popularTemplates.map((template: any) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            ) : (
              <Card className="mt-6">
                <CardContent className="pt-6 text-center text-slate-600">
                  <p>No popular templates yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Top Rated Templates Tab */}
          <TabsContent value="toprated">
            {topRatedTemplates && topRatedTemplates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                {topRatedTemplates.map((template: any) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            ) : (
              <Card className="mt-6">
                <CardContent className="pt-6 text-center text-slate-600">
                  <p>No top-rated templates yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories">
            <div className="mt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
                {categories.map((category) => (
                  <Button
                    key={category}
                    onClick={() => setSelectedCategory(selectedCategory === category ? undefined : category)}
                    variant={selectedCategory === category ? "default" : "outline"}
                    className="capitalize"
                  >
                    {category.replace("_", " ")}
                  </Button>
                ))}
              </div>

              {selectedCategory && templates && templates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {templates.map((template: any) => (
                    <TemplateCard key={template.id} template={template} />
                  ))}
                </div>
              ) : selectedCategory ? (
                <Card>
                  <CardContent className="pt-6 text-center text-slate-600">
                    <p>No templates in this category</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center text-slate-600">
                    <p>Select a category to view templates</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
