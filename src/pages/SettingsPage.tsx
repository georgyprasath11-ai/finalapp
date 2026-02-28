import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Download, FileUp, Play, Plus, RefreshCcw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useDailyTaskStore } from "@/store/daily-task-store";
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
    exportLovableProfileData,
    importCurrentProfileData,
    resetCurrentProfileData,
  } = useAppStore();
  const {
    checkboxSounds,
    selectedSound,
    selectedSoundId,
    uploadCheckboxSound,
    selectCheckboxSound,
    deleteCheckboxSound,
    previewCheckboxSound,
  } = useDailyTaskStore();

  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});
  const [soundMessage, setSoundMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const soundInputRef = useRef<HTMLInputElement | null>(null);

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

  const downloadLovableExport = () => {
    const payload = exportLovableProfileData();
    if (!payload) {
      return;
    }

    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lovable-export-${activeProfile?.name ?? "profile"}-${new Date().toISOString().slice(0, 10)}.json`;
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

  const handleSoundUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const result = await uploadCheckboxSound(file);
    setSoundMessage(result.ok ? "Sound uploaded successfully." : (result.error ?? "Failed to upload sound."));
    event.target.value = "";
  };

  const uploadedSounds = checkboxSounds.filter((sound) => sound.source === "uploaded");

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Goals</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Daily goal (hours)</Label>
            <Input
              type="number"
              step="0.25"
              min="0"
              value={localSettings.goals.dailyHours}
              onChange={(event) =>
                setLocalSettings((prev) =>
                  prev ? { ...prev, goals: { ...prev.goals, dailyHours: Number(event.target.value) || 0 } } : prev,
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Weekly goal (hours)</Label>
            <Input
              type="number"
              step="0.25"
              min="0"
              value={localSettings.goals.weeklyHours}
              onChange={(event) =>
                setLocalSettings((prev) =>
                  prev ? { ...prev, goals: { ...prev.goals, weeklyHours: Number(event.target.value) || 0 } } : prev,
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Monthly goal (hours)</Label>
            <Input
              type="number"
              step="0.25"
              min="0"
              value={localSettings.goals.monthlyHours}
              onChange={(event) =>
                setLocalSettings((prev) =>
                  prev ? { ...prev, goals: { ...prev.goals, monthlyHours: Number(event.target.value) || 0 } } : prev,
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
          <CardTitle className="text-base">Checkbox Sound</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end">
            <div className="space-y-1.5">
              <Label>Active sound</Label>
              <Select
                value={selectedSoundId ?? ""}
                onValueChange={(value) => {
                  selectCheckboxSound(value);
                  setSoundMessage("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose checkbox sound" />
                </SelectTrigger>
                <SelectContent>
                  {checkboxSounds.map((sound) => (
                    <SelectItem key={sound.id} value={sound.id}>
                      {sound.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <input
              ref={soundInputRef}
              type="file"
              accept="audio/mpeg,.mp3"
              className="hidden"
              onChange={handleSoundUpload}
            />
            <Button type="button" variant="outline" onClick={() => soundInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Upload MP3
            </Button>
            <Button type="button" variant="outline" onClick={() => previewCheckboxSound()} disabled={!selectedSound}>
              <Play className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (selectedSound?.source === "uploaded") {
                  deleteCheckboxSound(selectedSound.id);
                  setSoundMessage("Uploaded sound deleted.");
                }
              }}
              disabled={selectedSound?.source !== "uploaded"}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Dropdown labels show file names without the .mp3 extension. Built-in sounds are auto-detected from project assets.
          </p>

          {uploadedSounds.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-border/60 bg-background/65 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Uploaded Sounds</p>
              {uploadedSounds.map((sound) => (
                <div key={sound.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm">{sound.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => deleteCheckboxSound(sound.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          {soundMessage ? (
            <p className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
              {soundMessage}
            </p>
          ) : null}
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
          <Button variant="outline" onClick={downloadLovableExport}>
            <Download className="mr-2 h-4 w-4" />
            Export for Lovable
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
