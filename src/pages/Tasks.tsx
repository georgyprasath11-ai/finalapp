import { useState } from 'react';
import { CheckSquare, Filter } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { TaskCard } from '@/components/TaskCard';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTasks } from '@/hooks/useTasks';
import { useStudyTimer } from '@/hooks/useStudyTimer';

const TasksPage = () => {
  const { isRunning } = useStudyTimer();
  const {
    activeTasks,
    completedTasks,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    uncompleteTask,
  } = useTasks();

  return (
    <div className="min-h-screen bg-background flex">
      <Navigation timerActive={isRunning} />

      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold mb-2">Tasks</h1>
              <p className="text-muted-foreground">
                Manage your study tasks
              </p>
            </div>
            <AddTaskDialog onAdd={addTask} />
          </div>

          {/* Task Tabs */}
          <Tabs defaultValue="active" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="active" className="gap-2">
                <CheckSquare className="w-4 h-4" />
                Active ({activeTasks.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="gap-2">
                Completed ({completedTasks.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-3">
              {activeTasks.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-xl border">
                  <CheckSquare className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-display font-semibold text-lg mb-2">No active tasks</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first task to get started
                  </p>
                  <AddTaskDialog onAdd={addTask} />
                </div>
              ) : (
                activeTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onUpdate={updateTask}
                    onDelete={deleteTask}
                    onComplete={completeTask}
                    onUncomplete={uncompleteTask}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-3">
              {completedTasks.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-xl border">
                  <CheckSquare className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-display font-semibold text-lg mb-2">No completed tasks yet</h3>
                  <p className="text-muted-foreground">
                    Complete some tasks to see them here
                  </p>
                </div>
              ) : (
                completedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onUpdate={updateTask}
                    onDelete={deleteTask}
                    onComplete={completeTask}
                    onUncomplete={uncompleteTask}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default TasksPage;
