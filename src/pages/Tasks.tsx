import { useState } from 'react';
import { format } from 'date-fns';
import { CheckSquare, Plus, Pencil, Trash2, Clock, Archive, Calendar as CalendarIcon } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { TaskCard } from '@/components/TaskCard';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useTasks } from '@/hooks/useTasks';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useCategories } from '@/hooks/useCategories';
import { formatTime } from '@/lib/stats';

const TasksPage = () => {
  const { isRunning } = useStudyTimer();
  const {
    tasks,
    activeTasks,
    completedTasks,
    backlogTasks,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    uncompleteTask,
    moveToBacklog,
    rescheduleTask,
    getActiveTasksByCategory,
    getCategoryTotalTime,
  } = useTasks();
  const { categories, categoryNames, addCategory, renameCategory, deleteCategory } = useCategories();

  const [activeTab, setActiveTab] = useState(categoryNames[0] || 'all');
  const [newTabName, setNewTabName] = useState('');
  const [addTabOpen, setAddTabOpen] = useState(false);
  const [editingTab, setEditingTab] = useState<{ id: string; name: string } | null>(null);
  const [editTabName, setEditTabName] = useState('');

  const handleAddTab = () => {
    if (newTabName.trim()) {
      addCategory(newTabName.trim());
      setNewTabName('');
      setAddTabOpen(false);
    }
  };

  const handleRenameTab = () => {
    if (editingTab && editTabName.trim()) {
      // Update all tasks with old category name to new name
      const oldName = editingTab.name;
      const newName = editTabName.trim();
      tasks.forEach((t) => {
        if (t.category === oldName) {
          updateTask(t.id, { category: newName });
        }
      });
      renameCategory(editingTab.id, newName);
      if (activeTab === oldName) setActiveTab(newName);
      setEditingTab(null);
      setEditTabName('');
    }
  };

  const handleDeleteTab = (id: string, name: string) => {
    deleteCategory(id);
    if (activeTab === name) setActiveTab(categoryNames[0] || 'all');
  };

  const currentCategoryTasks = activeTab === 'all'
    ? activeTasks
    : getActiveTasksByCategory(activeTab);

  const currentCategoryBacklog = activeTab === 'all'
    ? backlogTasks
    : backlogTasks.filter((t) => t.category === activeTab);

  const currentCategoryCompleted = activeTab === 'all'
    ? completedTasks
    : tasks.filter((t) => t.category === activeTab && t.completed);

  const totalTime = activeTab === 'all'
    ? tasks.reduce((sum, t) => sum + (t.accumulatedTime || 0), 0)
    : getCategoryTotalTime(activeTab);

  return (
    <div className="min-h-screen bg-background flex">
      <Navigation timerActive={isRunning} />

      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-display text-3xl font-bold mb-2">Tasks</h1>
              <p className="text-muted-foreground">Manage your study tasks by category</p>
            </div>
            <AddTaskDialog onAdd={addTask} categoryNames={categoryNames} defaultCategory={activeTab !== 'all' ? activeTab : undefined} />
          </div>

          {/* Total Time Banner */}
          <div className="stat-card mb-6">
            <div className="relative z-10 flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Total Time Studied for {activeTab === 'all' ? 'All Tasks' : activeTab}
                </p>
                <p className="font-display text-2xl font-bold font-mono text-primary">
                  {formatTime(totalTime)}
                </p>
              </div>
            </div>
          </div>

          {/* Category Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
              <TabsList className="flex-shrink-0">
                <TabsTrigger value="all">All ({activeTasks.length})</TabsTrigger>
                {categoryNames.map((cat) => (
                  <TabsTrigger key={cat} value={cat} className="group relative">
                    {cat} ({getActiveTasksByCategory(cat).length})
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Add Tab Button */}
              <Dialog open={addTabOpen} onOpenChange={setAddTabOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader><DialogTitle>Add New Tab</DialogTitle></DialogHeader>
                  <div className="space-y-3 pt-2">
                    <Input
                      value={newTabName}
                      onChange={(e) => setNewTabName(e.target.value)}
                      placeholder="Tab name (e.g., Tuition)"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTab()}
                    />
                    <Button onClick={handleAddTab} className="w-full gradient-primary border-0">Add Tab</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Tab Management (when a specific tab is selected) */}
            {activeTab !== 'all' && (
              <div className="flex items-center gap-2 mb-4">
                {/* Rename */}
                <Dialog open={!!editingTab} onOpenChange={(open) => !open && setEditingTab(null)}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const cat = categories.find((c) => c.name === activeTab);
                        if (cat) { setEditingTab(cat); setEditTabName(cat.name); }
                      }}
                    >
                      <Pencil className="w-3 h-3 mr-1" />Rename
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-sm">
                    <DialogHeader><DialogTitle>Rename Tab</DialogTitle></DialogHeader>
                    <div className="space-y-3 pt-2">
                      <Input
                        value={editTabName}
                        onChange={(e) => setEditTabName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameTab()}
                      />
                      <Button onClick={handleRenameTab} className="w-full gradient-primary border-0">Rename</Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Delete */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    const cat = categories.find((c) => c.name === activeTab);
                    if (cat) handleDeleteTab(cat.id, cat.name);
                  }}
                >
                  <Trash2 className="w-3 h-3 mr-1" />Delete Tab
                </Button>
              </div>
            )}

            {/* Task Lists */}
            <div className="space-y-6">
              {/* Active Tasks */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Active ({currentCategoryTasks.length})
                </h3>
                {currentCategoryTasks.length === 0 ? (
                  <div className="text-center py-8 bg-card rounded-xl border">
                    <CheckSquare className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground text-sm">No active tasks{activeTab !== 'all' ? ` in ${activeTab}` : ''}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentCategoryTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onUpdate={updateTask}
                        onDelete={deleteTask}
                        onComplete={completeTask}
                        onUncomplete={uncompleteTask}
                        onMoveToBacklog={moveToBacklog}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Backlog Tasks */}
              {currentCategoryBacklog.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Archive className="w-4 h-4" />
                    Backlog ({currentCategoryBacklog.length})
                  </h3>
                  <div className="space-y-3">
                    {currentCategoryBacklog.map((task) => (
                      <div key={task.id} className="relative">
                        <div className="absolute top-2 right-12 z-10">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            Backlog{task.originalDate ? ` · ${format(new Date(task.originalDate), 'MMM d')}` : ''}
                          </span>
                        </div>
                        <TaskCard
                          task={task}
                          onUpdate={updateTask}
                          onDelete={deleteTask}
                          onComplete={completeTask}
                          onUncomplete={uncompleteTask}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed */}
              {currentCategoryCompleted.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Completed ({currentCategoryCompleted.length})
                  </h3>
                  <div className="space-y-3">
                    {currentCategoryCompleted.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onUpdate={updateTask}
                        onDelete={deleteTask}
                        onComplete={completeTask}
                        onUncomplete={uncompleteTask}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default TasksPage;
