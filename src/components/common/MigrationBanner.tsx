import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "migrationBannerDismissed";

const isDismissed = (): boolean => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
};

export function MigrationBanner() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<boolean>(() => isDismissed());

  if (dismissed) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-sky-400/35 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          📦 Looks like you have existing study data but no Notes, Habits, or Weekly Review data yet. If you exported
          from a previous deployment, you can import it in Settings.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate("/settings")}>
            Go to Settings
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              try {
                localStorage.setItem(DISMISSED_KEY, "true");
              } catch {
                // Ignore localStorage write failures.
              }
              setDismissed(true);
            }}
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
