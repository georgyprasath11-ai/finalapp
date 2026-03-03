import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Clock3, ListChecks, Settings, Users } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { KEYBOARD_SHORTCUTS } from "@/constants/shortcuts";
import { useAppStore } from "@/store/app-store";

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
};

export function CommandPalette() {
  const navigate = useNavigate();
  const { data, startTimer } = useAppStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== KEYBOARD_SHORTCUTS.commandPalette) {
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      event.preventDefault();
      setOpen((previous) => !previous);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const subjectCommands = useMemo(
    () =>
      (data?.subjects ?? []).map((subject) => ({
        id: subject.id,
        name: subject.name,
      })),
    [data?.subjects],
  );

  const executeAndClose = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search commands..." aria-label="Command palette input" />
      <CommandList>
        <CommandEmpty>No matching command.</CommandEmpty>

        <CommandGroup heading="Quick Actions">
          <CommandItem
            onSelect={() =>
              executeAndClose(() => {
                navigate("/tasks?new=1");
              })
            }
          >
            <ListChecks className="mr-2 h-4 w-4" />
            Create Task
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              executeAndClose(() => {
                if (!isEditableTarget(document.activeElement)) {
                  startTimer();
                }
              })
            }
          >
            <Clock3 className="mr-2 h-4 w-4" />
            Start Timer
            <CommandShortcut>T</CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => executeAndClose(() => navigate("/analytics"))}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Open Analytics
          </CommandItem>

          <CommandItem onSelect={() => executeAndClose(() => navigate("/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            Open Settings
          </CommandItem>
        </CommandGroup>

        {subjectCommands.length > 0 ? (
          <CommandGroup heading="Jump To Subject">
            {subjectCommands.map((subject) => (
              <CommandItem
                key={subject.id}
                onSelect={() =>
                  executeAndClose(() => {
                    navigate(`/subjects?subjectId=${subject.id}`);
                  })
                }
              >
                <Users className="mr-2 h-4 w-4" />
                {subject.name}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
