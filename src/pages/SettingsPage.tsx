import { ChangeEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Copy, Download, FileUp, Play, Plus, RefreshCcw, ShieldAlert, ShieldCheck, Trash2, Upload } from "lucide-react";
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

interface SettingsNotice {
  tone: "success" | "error";
  message: string;
}

const noticeToneClass: Record<SettingsNotice["tone"], string> = {
  success: "border-emerald-500/35 bg-emerald-500/12 text-emerald-200",
  error: "border-rose-500/35 bg-rose-500/12 text-rose-200",
};

export default function SettingsPage() {
  const reduceMotion = useReducedMotion();
  const {
    data,
    profiles,
    activeProfile,
    isViewerMode,
    parentViewer,
    createProfile,
    renameProfile,
    switchProfile,
    deleteProfile,
    updateSettings,
    setVacationMode,
    setTheme,
    generateParentAccessCode,
    refreshParentAccessCode,
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
  const [notice, setNotice] = useState<SettingsNotice | null>(null);
  const [vacationUpdating, setVacationUpdating] = useState(false);
  const [parentAction, setParentAction] = useState<"generate" | "refresh" | null>(null);
  const [latestParentCode, setLatestParentCode] = useState<{
    displayCode: string;
    expiresAt: string;
  } | null>(null);
  // Goal drafts
  const [dailyGoalDraft, setDailyGoalDraft] = useState<string>("");
  const [weeklyGoalDraft, setWeeklyGoalDraft] = useState<string>("");
  const [monthlyGoalDraft, setMonthlyGoalDraft] = useState<string>("");

  // Timer drafts
  const [focusMinutesDraft, setFocusMinutesDraft] = useState<string>("");
  const [shortBreakDraft, setShortBreakDraft] = useState<string>("");
  const [longBreakDraft, setLongBreakDraft] = useState<string>("");
  const [longBreakIntervalDraft, setLongBreakIntervalDraft] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const soundInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!data) return;
    setLocalSettings(data.settings);

    // Only reset drafts when no goal input is currently focused
    const activeEl = document.activeElement;
    const goalInputIds = ["daily-goal-input", "weekly-goal-input", "monthly-goal-input"];
    const isEditingGoal = goalInputIds.some(
      (id) => activeEl?.getAttribute("data-goal-id") === id,
    );

    if (!isEditingGoal) {
      setDailyGoalDraft(String(data.settings.goals.dailyHours));
      setWeeklyGoalDraft(String(data.settings.goals.weeklyHours));
      setMonthlyGoalDraft(String(data.settings.goals.monthlyHours));
    }

    setFocusMinutesDraft(String(data.settings.timer.focusMinutes));
    setShortBreakDraft(String(data.settings.timer.shortBreakMinutes));
    setLongBreakDraft(String(data.settings.timer.longBreakMinutes));
    setLongBreakIntervalDraft(String(data.settings.timer.longBreakInterval));
  }, [data]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setNotice((current) => (current?.message === notice.message ? null : current));
    }, 4_000);

    return () => window.clearTimeout(timeout);
  }, [notice]);

  if (!data || !localSettings) {
    return null;
  }

  const showNotice = (message: string, tone: SettingsNotice["tone"]) => {
    setNotice({ message, tone });
  };

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

  const handleVacationModeToggle = (enabled: boolean) => {
    if (vacationUpdating) {
      return;
    }

    setVacationUpdating(true);
    const result = setVacationMode(enabled);
    setVacationUpdating(false);

    if (!result.ok) {
      showNotice(result.error ?? "Unable to update Vacation Mode.", "error");
      return;
    }

    showNotice(
      enabled
        ? "Vacation Mode enabled. Study streak is protected."
        : "Vacation Mode disabled. Study streak behaves normally.",
      "success",
    );
  };

  const handleParentCodeAction = async (action: "generate" | "refresh") => {
    if (parentAction !== null) {
      return;
    }

    setParentAction(action);
    const result = action === "generate"
      ? await generateParentAccessCode()
      : await refreshParentAccessCode();
    setParentAction(null);

    if (!result.ok || !result.displayCode || !result.expiresAt) {
      showNotice(result.error ?? "Unable to generate parent access code.", "error");
      return;
    }

    setLatestParentCode({
      displayCode: result.displayCode,
      expiresAt: result.expiresAt,
    });

    showNotice(action === "generate" ? "Parent access code generated." : "Parent access code refreshed.", "success");
  };

  const copyParentCode = async () => {
    if (!latestParentCode?.displayCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(latestParentCode.displayCode);
      showNotice("Parent code copied to clipboard.", "success");
    } catch {
      showNotice("Clipboard access failed. Copy manually.", "error");
    }
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {notice ? (
          <motion.div
            key={notice.message}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.97 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={`rounded-xl border px-3 py-2 text-sm ${noticeToneClass[notice.tone]}`}
            role="status"
            aria-live="polite"
          >
            {notice.message}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Goals</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Daily goal (hours)</Label>
            <Input
              type="text"
              inputMode="decimal"
              data-goal-id="daily-goal-input"
              value={dailyGoalDraft}
              onChange={(event) => setDailyGoalDraft(event.target.value)}
              onBlur={() => {
                const parsed = parseFloat(dailyGoalDraft);
                const safe = isNaN(parsed) || parsed < 0 ? 0 : parsed;
                setDailyGoalDraft(String(safe));
                setLocalSettings((prev) =>
                  prev ? { ...prev, goals: { ...prev.goals, dailyHours: safe } } : prev,
                );
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Weekly goal (hours)</Label>
            <Input
              type="text"
              inputMode="decimal"
              data-goal-id="weekly-goal-input"
              value={weeklyGoalDraft}
              onChange={(event) => setWeeklyGoalDraft(event.target.value)}
              onBlur={() => {
                const parsed = parseFloat(weeklyGoalDraft);
                const safe = isNaN(parsed) || parsed < 0 ? 0 : parsed;
                setWeeklyGoalDraft(String(safe));
                setLocalSettings((prev) =>
                  prev ? { ...prev, goals: { ...prev.goals, weeklyHours: safe } } : prev,
                );
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Monthly goal (hours)</Label>
            <Input
              type="text"
              inputMode="decimal"
              data-goal-id="monthly-goal-input"
              value={monthlyGoalDraft}
              onChange={(event) => setMonthlyGoalDraft(event.target.value)}
              onBlur={() => {
                const parsed = parseFloat(monthlyGoalDraft);
                const safe = isNaN(parsed) || parsed < 0 ? 0 : parsed;
                setMonthlyGoalDraft(String(safe));
                setLocalSettings((prev) =>
                  prev ? { ...prev, goals: { ...prev.goals, monthlyHours: safe } } : prev,
                );
              }}
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
              value={focusMinutesDraft}
              onChange={(event) => setFocusMinutesDraft(event.target.value)}
              onBlur={() => {
                const parsed = parseInt(focusMinutesDraft, 10);
                const safe = isNaN(parsed) || parsed < 1 ? 1 : parsed;
                setFocusMinutesDraft(String(safe));
                setLocalSettings((prev) =>
                  prev ? { ...prev, timer: { ...prev.timer, focusMinutes: safe } } : prev,
                );
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Short break (min)</Label>
            <Input
              type="number"
              value={shortBreakDraft}
              onChange={(event) => setShortBreakDraft(event.target.value)}
              onBlur={() => {
                const parsed = parseInt(shortBreakDraft, 10);
                const safe = isNaN(parsed) || parsed < 1 ? 1 : parsed;
                setShortBreakDraft(String(safe));
                setLocalSettings((prev) =>
                  prev ? { ...prev, timer: { ...prev.timer, shortBreakMinutes: safe } } : prev,
                );
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Long break (min)</Label>
            <Input
              type="number"
              value={longBreakDraft}
              onChange={(event) => setLongBreakDraft(event.target.value)}
              onBlur={() => {
                const parsed = parseInt(longBreakDraft, 10);
                const safe = isNaN(parsed) || parsed < 1 ? 1 : parsed;
                setLongBreakDraft(String(safe));
                setLocalSettings((prev) =>
                  prev ? { ...prev, timer: { ...prev.timer, longBreakMinutes: safe } } : prev,
                );
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Long break interval</Label>
            <Input
              type="number"
              value={longBreakIntervalDraft}
              onChange={(event) => setLongBreakIntervalDraft(event.target.value)}
              onBlur={() => {
                const parsed = parseInt(longBreakIntervalDraft, 10);
                const safe = isNaN(parsed) || parsed < 1 ? 1 : parsed;
                setLongBreakIntervalDraft(String(safe));
                setLocalSettings((prev) =>
                  prev ? { ...prev, timer: { ...prev.timer, longBreakInterval: safe } } : prev,
                );
              }}
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
          <CardTitle className="text-base">Vacation Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/20 px-3 py-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Vacation Mode (Protect Study Streak)</p>
              <p className="text-xs text-muted-foreground">
                Prevents your study streak from breaking while you're away. Does not affect workout streaks.
              </p>
            </div>
            <Switch
              checked={Boolean(data.vacationMode.enabled)}
              onCheckedChange={handleVacationModeToggle}
              disabled={vacationUpdating || isViewerMode}
              aria-label="Vacation Mode (Protect Study Streak)"
            />
          </div>

          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <p>
              <span className="font-medium text-foreground">Started:</span>{" "}
              {data.vacationMode.startedAt ? new Date(data.vacationMode.startedAt).toLocaleString() : "Not active"}
            </p>
            <p>
              <span className="font-medium text-foreground">Expires:</span>{" "}
              {data.vacationMode.expiresAt ? new Date(data.vacationMode.expiresAt).toLocaleString() : "Not set"}
            </p>
            <p>
              <span className="font-medium text-foreground">Cooldown:</span>{" "}
              {data.vacationMode.cooldownUntil ? new Date(data.vacationMode.cooldownUntil).toLocaleString() : "None"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Parent Viewer Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate or refresh the one-time parent code. Parents can use it on the Parent View page for read-only access.
          </p>

          {isViewerMode ? (
            <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Viewer mode is currently active. Exit viewer mode to manage parent codes.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleParentCodeAction("generate")}
              disabled={parentAction !== null || isViewerMode}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              {parentAction === "generate" ? "Generating..." : "Generate Parent Access Code"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleParentCodeAction("refresh")}
              disabled={parentAction !== null || isViewerMode || !parentViewer?.otpHash}
            >
              <ShieldAlert className="mr-2 h-4 w-4" />
              {parentAction === "refresh" ? "Refreshing..." : "Refresh Parent Code"}
            </Button>
          </div>

          {latestParentCode ? (
            <div className="space-y-2 rounded-xl border border-border/60 bg-background/65 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Current one-time code</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-secondary/40 px-2 py-1 font-mono text-sm">{latestParentCode.displayCode}</code>
                <Button type="button" size="sm" variant="outline" onClick={() => void copyParentCode()}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Expires {new Date(latestParentCode.expiresAt).toLocaleString()}.
              </p>
            </div>
          ) : null}

          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <p>
              <span className="font-medium text-foreground">Last generated:</span>{" "}
              {parentViewer?.otpCreatedAt ? new Date(parentViewer.otpCreatedAt).toLocaleString() : "Never"}
            </p>
            <p>
              <span className="font-medium text-foreground">Expires:</span>{" "}
              {parentViewer?.otpExpiresAt ? new Date(parentViewer.otpExpiresAt).toLocaleString() : "Not set"}
            </p>
            <p>
              <span className="font-medium text-foreground">Last parent access:</span>{" "}
              {parentViewer?.lastAccessAt ? new Date(parentViewer.lastAccessAt).toLocaleString() : "Never"}
            </p>
            <p>
              <span className="font-medium text-foreground">Failed attempts:</span>{" "}
              {parentViewer?.failedAttempts ?? 0}
            </p>
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
