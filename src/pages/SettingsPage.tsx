import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Download, FileUp, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/store/app-store";
import { AppSettings } from "@/types/models";
import { formatMinutes } from "@/utils/format";

export default function SettingsPage() {
  const {
    data,
    profiles,
    activeProfile,
    createProfile,
    renameProfile,
    switchProfile,
    deleteProfile,
    updateSettings,
    setTheme,
    exportCurrentProfileData,
    importCurrentProfileData,
    resetCurrentProfileData,
  } = useAppStore();

  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!data) {
      return;
    }
    setLocalSettings(data.settings);
  }, [data]);

  if (!data || !localSettings) {
    return null;
  }

  const saveSettings = () => {
    updateSettings(() => localSettings);
  };

  const workoutMinutes = Math.round(
    data.workout.sessions.reduce((total, session) => total + session.durationMs, 0) / 60_000,
  );

  const downloadExport = () => {
    const payload = exportCurrentProfileData();
    if (!payload) {
      return;
    }

    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `study-dashboard-${activeProfile?.name ?? "profile"}-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : "";
      const ok = importCurrentProfileData(raw);
      if (!ok) {
        window.alert("Import failed. File schema did not match.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Goals</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Daily goal (min)</Label>
            <Input
              type="number"
              value={localSettings.goals.dailyMinutes}
              onChange={(event) =>
                setLocalSettings((prev) =>
                  prev ? { ...prev, goals: { ...prev.goals, dailyMinutes: Number(event.target.value) || 0 } } : prev,
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Weekly goal (min)</Label>
            <Input
              type="number"
              value={localSettings.goals.weeklyMinutes}
              onChange={(event) =>
                setLocalSettings((prev) =>
                  prev ? { ...prev, goals: { ...prev.goals, weeklyMinutes: Number(event.target.value) || 0 } } : prev,
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Monthly goal (min)</Label>
            <Input
              type="number"
              value={localSettings.goals.monthlyMinutes}
              onChange={(event) =>
                setLocalSettings((prev) =>
                  prev ? { ...prev, goals: { ...prev.goals, monthlyMinutes: Number(event.target.value) || 0 } } : prev,
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Timer Preferences</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Focus (min)</Label>
            <Input
              type="number"
              value={localSettings.timer.focusMinutes}
              onChange={(event) =>
                setLocalSettings((prev) =>
                  prev ? { ...prev, timer: { ...prev.timer, focusMinutes: Number(event.target.value) || 1 } } : prev,
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Short break (min)</Label>
            <Input
              type="number"
              value={localSettings.timer.shortBreakMinutes}
              onChange={(event) =>
                setLocalSettings((prev) =>
                  prev ? { ...prev, timer: { ...prev.timer, shortBreakMinutes: Number(event.target.value) || 1 } } : prev,
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Long break (min)</Label>
            <Input
              type="number"
              value={localSettings.timer.longBreakMinutes}
              onChange={(event) =>
                setLocalSettings((prev) =>
                  prev ? { ...prev, timer: { ...prev.timer, longBreakMinutes: Number(event.target.value) || 1 } } : prev,
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Long break interval</Label>
            <Input
              type="number"
              value={localSettings.timer.longBreakInterval}
              onChange={(event) =>
                setLocalSettings((prev) =>
                  prev ? { ...prev, timer: { ...prev.timer, longBreakInterval: Number(event.target.value) || 1 } } : prev,
                )
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/20 px-3 py-2">
            <Label>Auto-start next phase</Label>
            <Switch
              checked={localSettings.timer.autoStartNextPhase}
              onCheckedChange={(checked) =>
                setLocalSettings((prev) =>
                  prev ? { ...prev, timer: { ...prev.timer, autoStartNextPhase: checked } } : prev,
                )
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/20 px-3 py-2">
            <Label>Sound toggle</Label>
            <Switch
              checked={localSettings.timer.soundEnabled}
              onCheckedChange={(checked) =>
                setLocalSettings((prev) =>
                  prev ? { ...prev, timer: { ...prev.timer, soundEnabled: checked } } : prev,
                )
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/20 px-3 py-2">
            <Label>Prevent accidental reset</Label>
            <Switch
              checked={localSettings.timer.preventAccidentalReset}
              onCheckedChange={(checked) =>
                setLocalSettings((prev) =>
                  prev ? { ...prev, timer: { ...prev.timer, preventAccidentalReset: checked } } : prev,
                )
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label>Theme</Label>
            <Select
              value={localSettings.theme}
              onValueChange={(theme) => {
                const mode = theme as AppSettings["theme"];
                setLocalSettings((prev) => (prev ? { ...prev, theme: mode } : prev));
                setTheme(mode);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Profile Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              value={newProfileName}
              onChange={(event) => setNewProfileName(event.target.value)}
              placeholder="Create new profile"
              className="max-w-xs"
            />
            <Button
              onClick={() => {
                createProfile(newProfileName);
                setNewProfileName("");
              }}
              disabled={!newProfileName.trim()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create
            </Button>
          </div>

          <div className="space-y-2">
            {profiles.map((profile) => (
              <div key={profile.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/70 p-2">
                <Input
                  value={renameDraft[profile.id] ?? profile.name}
                  onChange={(event) =>
                    setRenameDraft((prev) => ({
                      ...prev,
                      [profile.id]: event.target.value,
                    }))
                  }
                  className="max-w-xs"
                />
                <Button size="sm" variant="outline" onClick={() => renameProfile(profile.id, renameDraft[profile.id] ?? profile.name)}>
                  Rename
                </Button>
                <Button size="sm" variant="outline" onClick={() => switchProfile(profile.id)}>
                  {activeProfile?.id === profile.id ? "Active" : "Switch"}
                </Button>
                {profiles.length > 1 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(`Delete profile "${profile.name}" and all its local data?`)) {
                        deleteProfile(profile.id);
                      }
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Data Controls</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>

          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <FileUp className="mr-2 h-4 w-4" />
            Import Data
          </Button>

          <Button
            variant="destructive"
            onClick={() => {
              if (window.confirm("Reset all data for this profile? This cannot be undone.")) {
                resetCurrentProfileData();
              }
            }}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Reset Profile Data
          </Button>

          <Button onClick={saveSettings}>Save Settings</Button>
        </CardContent>
        {data.workout.sessions.length > 0 || data.workout.markedDays.length > 0 ? (
          <CardContent className="pt-0">
            <div className="rounded-xl border border-border/60 bg-secondary/20 px-3 py-2 text-sm text-muted-foreground">
              Imported workout data: {data.workout.sessions.length} session(s), {formatMinutes(workoutMinutes)} total,
              {` ${data.workout.markedDays.length}`} marked day(s).
            </div>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
