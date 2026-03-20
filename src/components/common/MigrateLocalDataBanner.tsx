import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { loadFromSupabase, syncToSupabase } from "@/lib/supabase-storage";

const MIGRATION_FLAG = "study-dashboard:migration-offered";
const DATA_PREFIX = "study-dashboard:data:";
const ALL_PREFIX = "study-dashboard:";

const hasLocalStudyData = (): boolean => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DATA_PREFIX)) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
};

export function MigrateLocalDataBanner() {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem(MIGRATION_FLAG)) return;
    if (!hasLocalStudyData()) return;
    setIsVisible(true);
  }, [user]);

  if (!user || !isVisible) {
    return null;
  }

  const finish = () => {
    localStorage.setItem(MIGRATION_FLAG, "true");
    setIsVisible(false);
  };

  const handleUpload = async () => {
    setIsUploading(true);
    try {
      const cloudData = await loadFromSupabase(user.id);
      if (Object.keys(cloudData).length === 0) {
        const tasks: Promise<void>[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith(ALL_PREFIX)) continue;
          const value = localStorage.getItem(key);
          if (value === null) continue;
          tasks.push(syncToSupabase(user.id, key, value));
        }
        await Promise.all(tasks);
      }
      toast.success("Data uploaded to your account.");
    } finally {
      setIsUploading(false);
      finish();
    }
  };

  return (
    <Card className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 shadow-soft">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-emerald-50">
          Study data found on this device. Upload it to your cloud account so it's safe everywhere.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={handleUpload} disabled={isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload now"
            )}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={finish}>
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
