import { useState } from 'react';
import { Settings as SettingsIcon, Palette, Plus, Pencil, Trash2, Check, X, Dumbbell } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useSubjects } from '@/hooks/useSubjects';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useSettings } from '@/hooks/useSettings';

const PRESET_COLORS = [
  '220 70% 55%', '200 70% 50%', '280 60% 55%', '142 72% 45%',
  '38 92% 55%', '330 70% 55%', '170 60% 45%', '258 60% 55%',
  '15 80% 55%', '300 60% 55%', '340 65% 55%', '160 10% 50%',
  '0 72% 55%', '50 90% 50%', '180 60% 45%', '240 60% 60%',
];

const SettingsPage = () => {
  const { isRunning } = useStudyTimer();
  const { subjects, addSubject, updateSubject, deleteSubject } = useSubjects();
  const { settings, toggleWorkout } = useSettings();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('220 70% 55%');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleAdd = () => {
    if (newName.trim()) {
      addSubject(newName.trim(), newColor);
      setNewName('');
    }
  };

  const startEdit = (id: string, name: string, color: string) => {
    setEditingId(id);
    setEditName(name);
    setEditColor(color);
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      updateSubject(editingId, { name: editName.trim(), color: editColor });
      setEditingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Navigation timerActive={isRunning} />
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-auto">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold mb-2 flex items-center gap-3">
              <SettingsIcon className="w-8 h-8 text-primary" />
              Settings
            </h1>
            <p className="text-muted-foreground">Manage subjects and optional features</p>
          </div>

          {/* Subject Management */}
          <section className="mb-10">
            <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              Subjects
            </h2>

            {/* Add New Subject */}
            <div className="stat-card mb-6">
              <div className="relative z-10">
                <h3 className="font-display font-semibold mb-3">Add Subject</h3>
                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Subject name"
                      onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-1 flex-wrap max-w-[200px]">
                      {PRESET_COLORS.slice(0, 8).map((c) => (
                        <button
                          key={c}
                          className="w-6 h-6 rounded-full border-2 transition-all"
                          style={{
                            backgroundColor: `hsl(${c})`,
                            borderColor: c === newColor ? 'hsl(var(--foreground))' : 'transparent',
                          }}
                          onClick={() => setNewColor(c)}
                        />
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleAdd} disabled={!newName.trim()} className="gradient-primary border-0">
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Subject List */}
            <div className="space-y-2">
              {subjects.map((subject) => (
                <div key={subject.id} className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:shadow-md transition-all group">
                  {editingId === subject.id ? (
                    <>
                      <div
                        className="w-5 h-5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: `hsl(${editColor})` }}
                      />
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 h-8"
                      />
                      <div className="flex gap-1">
                        {PRESET_COLORS.slice(0, 8).map((c) => (
                          <button
                            key={c}
                            className="w-5 h-5 rounded-full border-2 transition-all"
                            style={{
                              backgroundColor: `hsl(${c})`,
                              borderColor: c === editColor ? 'hsl(var(--foreground))' : 'transparent',
                            }}
                            onClick={() => setEditColor(c)}
                          />
                        ))}
                      </div>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={saveEdit}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingId(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div
                        className="w-5 h-5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: `hsl(${subject.color})` }}
                      />
                      <span className="flex-1 font-medium">{subject.name}</span>
                      <Button
                        size="sm" variant="ghost"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => startEdit(subject.id, subject.name, subject.color)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                        onClick={() => deleteSubject(subject.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Optional Settings */}
          <section>
            <h2 className="font-display text-xl font-semibold mb-4">Optional Settings</h2>
            <div className="stat-card">
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Dumbbell className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">Enable Workout Tracker</p>
                    <p className="text-sm text-muted-foreground">Track workouts, streaks, and muscle groups separately</p>
                  </div>
                </div>
                <Switch checked={settings.workoutEnabled} onCheckedChange={toggleWorkout} />
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
