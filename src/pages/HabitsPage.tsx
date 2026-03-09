import { FormEvent, useMemo, useState } from "react";
import { Archive, CalendarCheck, MoreVertical, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { addDays, toLocalIsoDate } from "@/utils/date";
import { useHabitStore } from "@/store/zustand";
import { Habit } from "@/types/models";

interface HabitDraft {
  name: string;
  emoji: string;
  color: string;
}

const COLOR_SWATCHES = [
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#f43f5e",
  "#10b981",
  "#f97316",
  "#0ea5e9",
] as const;

const DEFAULT_DRAFT: HabitDraft = {
  name: "",
  emoji: "✅",
  color: COLOR_SWATCHES[0],
};

const normalizeEmoji = (value: string): string => value.trim().slice(0, 2);

const buildHeatmapDays = (todayIso: string): string[] =>
  Array.from({ length: 30 }, (_, index) => addDays(todayIso, index - 29));

export default function HabitsPage() {
  const habits = useHabitStore((state) => state.habits);
  const addHabit = useHabitStore((state) => state.addHabit);
  const toggleHabitDay = useHabitStore((state) => state.toggleHabitDay);
  const editHabit = useHabitStore((state) => state.editHabit);
  const archiveHabit = useHabitStore((state) => state.archiveHabit);
  const restoreHabit = useHabitStore((state) => state.restoreHabit);
  const deleteHabit = useHabitStore((state) => state.deleteHabit);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [draft, setDraft] = useState<HabitDraft>(DEFAULT_DRAFT);
  const [showArchived, setShowArchived] = useState(false);

  const todayIso = toLocalIsoDate();
  const heatmapDays = useMemo(() => buildHeatmapDays(todayIso), [todayIso]);

  const activeHabits = habits.filter((habit) => habit.archivedAt === null);
  const archivedHabits = habits.filter((habit) => habit.archivedAt !== null);

  const openAddDialog = () => {
    setEditingHabitId(null);
    setDraft(DEFAULT_DRAFT);
    setIsDialogOpen(true);
  };

  const openEditDialog = (habit: Habit) => {
    setEditingHabitId(habit.id);
    setDraft({
      name: habit.name,
      emoji: habit.emoji,
      color: habit.color,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingHabitId(null);
    setDraft(DEFAULT_DRAFT);
  };

  const onSaveHabit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = draft.name.trim();
    if (!name) {
      return;
    }

    const nextPatch = {
      name,
      emoji: normalizeEmoji(draft.emoji) || "✅",
      color: draft.color,
    };

    if (editingHabitId) {
      editHabit(editingHabitId, nextPatch);
    } else {
      addHabit(nextPatch);
    }

    closeDialog();
  };

  return (
    <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <Card className="rounded-[20px] border-border/60 bg-card/90">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="h-4 w-4" />
              Habits
            </CardTitle>
            <Button onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Habit
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card className="rounded-[20px] border-border/60 bg-card/90">
        <CardHeader>
          <CardTitle className="text-base">Today</CardTitle>
          <p className="text-sm text-muted-foreground">{todayIso}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeHabits.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
              No active habits yet.
            </p>
          ) : (
            activeHabits.map((habit) => {
              const checked = habit.completions.includes(todayIso);

              return (
                <div
                  key={habit.id}
                  className={`flex items-center gap-3 rounded-2xl border border-border/60 bg-background/65 px-3 py-3 ${checked ? "opacity-70" : ""}`}
                >
                  <span className="text-2xl leading-none">{habit.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${checked ? "line-through text-muted-foreground" : ""}`}>
                      {habit.name}
                    </p>
                  </div>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) => toggleHabitDay(habit.id, todayIso)}
                    aria-label={`Toggle ${habit.name} for today`}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Open actions for ${habit.name}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(habit)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => archiveHabit(habit.id)}>
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteHabit(habit.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {activeHabits.map((habit) => (
          <Card key={`${habit.id}-heatmap`} className="rounded-[20px] border-border/60 bg-card/90">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {habit.emoji} {habit.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1.5">
                {heatmapDays.map((isoDate, index) => {
                  const completed = habit.completions.includes(isoDate);
                  const isToday = index === heatmapDays.length - 1;

                  return (
                    <div key={`${habit.id}-${isoDate}`} className="relative">
                      <div
                        className={`h-4 w-4 rounded-sm ${completed ? "" : "bg-muted/40"}`}
                        style={completed ? { backgroundColor: habit.color, opacity: 0.9 } : undefined}
                        title={`${isoDate}${isToday ? " (Today)" : ""}`}
                      />
                      {isToday ? (
                        <span className="absolute left-1/2 top-5 -translate-x-1/2 text-[10px] text-muted-foreground">
                          Today
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-[20px] border-border/60 bg-card/90">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Archived Habits</CardTitle>
            <Button type="button" variant="outline" onClick={() => setShowArchived((value) => !value)}>
              {showArchived ? "Hide archived" : "Show archived"}
            </Button>
          </div>
        </CardHeader>
        {showArchived ? (
          <CardContent className="space-y-2">
            {archivedHabits.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 bg-background/60 p-3 text-sm text-muted-foreground">
                No archived habits.
              </p>
            ) : (
              archivedHabits.map((habit) => (
                <div key={habit.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/65 px-3 py-2">
                  <p className="text-sm text-muted-foreground">
                    {habit.emoji} {habit.name}
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={() => restoreHabit(habit.id)}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Restore
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        ) : null}
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-2xl border-border/70 bg-card/90">
          <DialogHeader>
            <DialogTitle>{editingHabitId ? "Edit Habit" : "Add Habit"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSaveHabit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="habit-name" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Name
              </label>
              <Input
                id="habit-name"
                value={draft.name}
                onChange={(event) => setDraft((previous) => ({ ...previous, name: event.target.value }))}
                placeholder="Drink 8 glasses of water"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="habit-emoji" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Emoji
              </label>
              <Input
                id="habit-emoji"
                maxLength={2}
                value={draft.emoji}
                onChange={(event) => setDraft((previous) => ({ ...previous, emoji: normalizeEmoji(event.target.value) }))}
                placeholder="💧"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Color</p>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    className={`h-7 w-7 rounded-full ${draft.color === swatch ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                    style={{ backgroundColor: swatch }}
                    aria-label={`Select color ${swatch}`}
                    onClick={() => setDraft((previous) => ({ ...previous, color: swatch }))}
                  />
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={!draft.name.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
