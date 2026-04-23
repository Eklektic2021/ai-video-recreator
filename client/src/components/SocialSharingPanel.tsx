import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Loader2, Copy, Share2, Twitter, Facebook, Linkedin, Mail } from "lucide-react";

interface SocialSharingPanelProps {
  projectId: number;
}

export default function SocialSharingPanel({ projectId }: SocialSharingPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const createShareMutation = trpc.socialSharing.createShareLink.useMutation();
  const getShareQuery = trpc.socialSharing.getShareLink.useQuery({ projectId });
  const trackShareMutation = trpc.socialSharing.trackShare.useMutation();
  const generateShareTextQuery = trpc.socialSharing.generateShareText.useQuery(
    { projectId, platform: "twitter" },
    { enabled: false }
  );

  const handleCreateShare = async () => {
    setIsCreating(true);
    try {
      const result = await createShareMutation.mutateAsync({
        projectId,
        title: "Check out my AI Video Recreation!",
        description: "I created this video using AI Video Recreator",
        isPublic: true,
      });

      setShareUrl(result.shareUrl);
      toast.success("Share link created!");
    } catch (error) {
      toast.error("Failed to create share link");
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}${shareUrl || getShareQuery.data?.shareUrl}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success("Share link copied to clipboard!");
  };

  const handleShareOnPlatform = async (platform: "twitter" | "facebook" | "linkedin" | "email") => {
    const url = shareUrl || getShareQuery.data?.shareUrl;
    if (!url) return;

    try {
      await trackShareMutation.mutateAsync({
        shareToken: url.split("/").pop() || "",
        platform,
      });

      const fullUrl = `${window.location.origin}${url}`;
      const text = `Check out my AI Video Recreation! ${fullUrl}`;

      switch (platform) {
        case "twitter":
          window.open(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
            "_blank"
          );
          break;
        case "facebook":
          window.open(
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`,
            "_blank"
          );
          break;
        case "linkedin":
          window.open(
            `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(fullUrl)}`,
            "_blank"
          );
          break;
        case "email":
          window.location.href = `mailto:?subject=Check out my AI Video Recreation&body=${encodeURIComponent(text)}`;
          break;
      }

      toast.success(`Shared on ${platform}!`);
    } catch (error) {
      toast.error("Failed to track share");
    }
  };

  const currentShare = shareUrl ? { shareUrl, shareToken: shareUrl.split('/').pop() || '', viewCount: 0, shareCount: 0, createdAt: new Date() } : getShareQuery.data;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="w-5 h-5" />
          Share Your Project
        </CardTitle>
        <CardDescription>
          Share your video recreation project on social media
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!currentShare ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Create a shareable link to showcase your project on social media
            </p>
            <Button
              onClick={handleCreateShare}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Share Link...
                </>
              ) : (
                "Create Share Link"
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Share Link Display */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Share Link</label>
              <div className="flex gap-2">
                <Input
                  value={`${window.location.origin}${currentShare.shareUrl}`}
                  readOnly
                  className="text-sm"
                />
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  size="icon"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Share Statistics */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-600">Views</p>
                <p className="text-2xl font-bold">{typeof currentShare === 'object' ? currentShare.viewCount || 0 : 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Shares</p>
                <p className="text-2xl font-bold">{typeof currentShare === 'object' ? currentShare.shareCount || 0 : 0}</p>
              </div>
            </div>

            {/* Social Media Buttons */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Share On</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => handleShareOnPlatform("twitter")}
                  variant="outline"
                  className="w-full"
                >
                  <Twitter className="w-4 h-4 mr-2" />
                  Twitter
                </Button>
                <Button
                  onClick={() => handleShareOnPlatform("facebook")}
                  variant="outline"
                  className="w-full"
                >
                  <Facebook className="w-4 h-4 mr-2" />
                  Facebook
                </Button>
                <Button
                  onClick={() => handleShareOnPlatform("linkedin")}
                  variant="outline"
                  className="w-full"
                >
                  <Linkedin className="w-4 h-4 mr-2" />
                  LinkedIn
                </Button>
                <Button
                  onClick={() => handleShareOnPlatform("email")}
                  variant="outline"
                  className="w-full"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
