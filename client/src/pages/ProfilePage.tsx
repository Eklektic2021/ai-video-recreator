import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MapPin, Link as LinkIcon, Twitter, Instagram, Linkedin, Users, Share2, Edit } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { useState } from "react";

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [, setLocation] = useLocation();
  const { user: currentUser } = useAuth();
  const numUserId = parseInt(userId || "0");
  const isOwnProfile = currentUser?.id === numUserId;

  const { data: profile, isLoading: profileLoading } = trpc.profiles.getProfile.useQuery(
    { userId: numUserId },
    { enabled: !!userId }
  );

  const { data: isFollowingData } = trpc.profiles.isFollowing.useQuery(
    { userId: numUserId },
    { enabled: !!currentUser && !isOwnProfile }
  );

  const { data: followers } = trpc.profiles.getFollowers.useQuery({ userId: numUserId });
  const { data: following } = trpc.profiles.getFollowing.useQuery({ userId: numUserId });
  const { data: portfolioItems } = trpc.profiles.getPortfolioItems.useQuery({ userId: numUserId });

  const followMutation = trpc.profiles.followUser.useMutation({
    onSuccess: () => {
      toast.success("Following user!");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const unfollowMutation = trpc.profiles.unfollowUser.useMutation({
    onSuccess: () => {
      toast.success("Unfollowed user");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-slate-600 mb-4">Profile not found</p>
            <Button onClick={() => setLocation("/")} variant="outline">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Profile Header */}
        <Card className="mb-8">
          <CardContent className="pt-8">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-6">
                {/* Avatar */}
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    "U"
                  )}
                </div>

                {/* Profile Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-slate-900">User Profile</h1>
                    {profile.verificationBadge === "verified" && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                        ✓ Verified
                      </span>
                    )}
                    {profile.verificationBadge === "featured" && (
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                        ⭐ Featured
                      </span>
                    )}
                  </div>

                  {profile.bio && <p className="text-slate-600 mb-3">{profile.bio}</p>}

                  {/* Social Links */}
                  <div className="flex gap-3 mb-4">
                    {profile.website && (
                      <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                        <LinkIcon className="w-5 h-5" />
                      </a>
                    )}
                    {profile.twitter && (
                      <a href={`https://twitter.com/${profile.twitter}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-500">
                        <Twitter className="w-5 h-5" />
                      </a>
                    )}
                    {profile.instagram && (
                      <a href={`https://instagram.com/${profile.instagram}`} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:text-pink-700">
                        <Instagram className="w-5 h-5" />
                      </a>
                    )}
                    {profile.linkedin && (
                      <a href={`https://linkedin.com/in/${profile.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-800">
                        <Linkedin className="w-5 h-5" />
                      </a>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex gap-6">
                    <div>
                      <p className="text-sm text-slate-600">Projects</p>
                      <p className="text-2xl font-bold text-slate-900">{profile.totalProjects}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Followers</p>
                      <p className="text-2xl font-bold text-slate-900">{profile.followerCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Following</p>
                      <p className="text-2xl font-bold text-slate-900">{profile.followingCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Total Shares</p>
                      <p className="text-2xl font-bold text-slate-900">{profile.totalShares}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {isOwnProfile ? (
                  <Button onClick={() => setLocation("/settings/profile")} className="gap-2">
                    <Edit className="w-4 h-4" />
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => {
                        if (isFollowingData) {
                          unfollowMutation.mutate({ userId: numUserId });
                        } else {
                          followMutation.mutate({ userId: numUserId });
                        }
                      }}
                      variant={isFollowingData ? "outline" : "default"}
                      disabled={followMutation.isPending || unfollowMutation.isPending}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      {isFollowingData ? "Following" : "Follow"}
                    </Button>
                    <Button variant="outline" className="gap-2">
                      <Share2 className="w-4 h-4" />
                      Share
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Portfolio & Followers Tabs */}
        <Tabs defaultValue="portfolio" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="portfolio">Portfolio ({portfolioItems?.length || 0})</TabsTrigger>
            <TabsTrigger value="followers">Followers ({followers?.length || 0})</TabsTrigger>
            <TabsTrigger value="following">Following ({following?.length || 0})</TabsTrigger>
          </TabsList>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio">
            {portfolioItems && portfolioItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {portfolioItems.map((item: any) => (
                  <Card key={item.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg mb-4 flex items-center justify-center">
                        <span className="text-slate-400">Project {item.projectId}</span>
                      </div>
                      <p className="font-semibold text-slate-900">Project #{item.projectId}</p>
                      {item.featured === "true" && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded mt-2 inline-block">
                          Featured
                        </span>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-slate-600">
                  <p>No portfolio items yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Followers Tab */}
          <TabsContent value="followers">
            {followers && followers.length > 0 ? (
              <div className="space-y-4">
                {followers.map((follower: any) => (
                  <Card key={follower.id}>
                    <CardContent className="pt-6">
                      <p className="text-slate-900 font-semibold">User #{follower.followerId}</p>
                      <p className="text-sm text-slate-600">Followed on {new Date(follower.createdAt).toLocaleDateString()}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-slate-600">
                  <p>No followers yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Following Tab */}
          <TabsContent value="following">
            {following && following.length > 0 ? (
              <div className="space-y-4">
                {following.map((f: any) => (
                  <Card key={f.id}>
                    <CardContent className="pt-6">
                      <p className="text-slate-900 font-semibold">User #{f.followingId}</p>
                      <p className="text-sm text-slate-600">Following since {new Date(f.createdAt).toLocaleDateString()}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-slate-600">
                  <p>Not following anyone yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
