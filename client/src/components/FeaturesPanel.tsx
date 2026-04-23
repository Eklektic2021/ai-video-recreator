import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Moon, Sun, Monitor, Search, Download, Share2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";

export function NotificationsPanel() {
  const { data: notifications } = trpc.features.getNotifications.useQuery();
  const markAsReadMutation = trpc.features.markAsRead.useMutation();

  const unreadCount = notifications?.filter((n) => n.isRead === "false").length || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Notifications ({unreadCount} unread)</h3>
      </div>

      {notifications && notifications.length > 0 ? (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${notif.isRead === "false" ? "bg-blue-50" : ""}`}
              onClick={() => {
                if (notif.isRead === "false") {
                  markAsReadMutation.mutate({ notificationId: notif.id });
                }
              }}
            >
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-slate-900">{notif.title}</p>
                    {notif.message && <p className="text-sm text-slate-600 mt-1">{notif.message}</p>}
                    <p className="text-xs text-slate-500 mt-2">{new Date(notif.createdAt).toLocaleString()}</p>
                  </div>
                  {notif.isRead === "false" && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1"></div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-slate-600">
            <p>No notifications yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">Theme</h3>

      <div className="grid grid-cols-3 gap-3">
        <Button
          onClick={() => setTheme?.("light")}
          variant={theme === "light" ? "default" : "outline"}
          className="gap-2 flex flex-col h-auto py-4"
        >
          <Sun className="w-5 h-5" />
          <span className="text-xs">Light</span>
        </Button>

        <Button
          onClick={() => setTheme?.("dark")}
          variant={theme === "dark" ? "default" : "outline"}
          className="gap-2 flex flex-col h-auto py-4"
        >
          <Moon className="w-5 h-5" />
          <span className="text-xs">Dark</span>
        </Button>

        <Button
          onClick={() => setTheme?.("system")}
          variant={theme === "system" ? "default" : "outline"}
          className="gap-2 flex flex-col h-auto py-4"
        >
          <Monitor className="w-5 h-5" />
          <span className="text-xs">System</span>
        </Button>
      </div>
    </div>
  );
}

export function ExportOptions() {
  const exportOptions = [
    { label: "Export as PDF", icon: "📄", format: "pdf" },
    { label: "Export as Markdown", icon: "📝", format: "markdown" },
    { label: "Export as JSON", icon: "⚙️", format: "json" },
    { label: "Export as ZIP", icon: "📦", format: "zip" },
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">Export Project</h3>

      <div className="grid grid-cols-2 gap-3">
        {exportOptions.map((option) => (
          <Button
            key={option.format}
            onClick={() => toast.success(`Exporting as ${option.format.toUpperCase()}...`)}
            variant="outline"
            className="gap-2 flex flex-col h-auto py-4"
          >
            <span className="text-2xl">{option.icon}</span>
            <span className="text-xs text-center">{option.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

export function SearchPanel() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">Search</h3>

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search projects, templates, users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {searchQuery && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">Search results for "{searchQuery}"</p>
          <Card>
            <CardContent className="pt-6 text-center text-slate-600">
              <p>No results found</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export function FeaturesPanel() {
  return (
    <Tabs defaultValue="notifications" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="notifications" className="gap-2">
          <Bell className="w-4 h-4" />
          <span className="hidden sm:inline">Notifications</span>
        </TabsTrigger>
        <TabsTrigger value="theme" className="gap-2">
          <Moon className="w-4 h-4" />
          <span className="hidden sm:inline">Theme</span>
        </TabsTrigger>
        <TabsTrigger value="search" className="gap-2">
          <Search className="w-4 h-4" />
          <span className="hidden sm:inline">Search</span>
        </TabsTrigger>
        <TabsTrigger value="export" className="gap-2">
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Export</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="notifications" className="mt-6">
        <NotificationsPanel />
      </TabsContent>

      <TabsContent value="theme" className="mt-6">
        <ThemeSelector />
      </TabsContent>

      <TabsContent value="search" className="mt-6">
        <SearchPanel />
      </TabsContent>

      <TabsContent value="export" className="mt-6">
        <ExportOptions />
      </TabsContent>
    </Tabs>
  );
}
