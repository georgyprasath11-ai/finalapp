import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { KEYBOARD_SHORTCUTS } from "@/constants/shortcuts";
import { useAppStore } from "@/store/app-store";

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
};

const withQueryFlag = (path: string, key: string, value: string): string => {
  const url = new URL(path, window.location.origin);
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
};

export function GlobalShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data, startTimer, pauseTimer, resumeTimer } = useAppStore();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === KEYBOARD_SHORTCUTS.newTask) {
        event.preventDefault();
        navigate(withQueryFlag("/tasks", "new", "1"));
        return;
      }

      if (key === KEYBOARD_SHORTCUTS.timerToggle) {
        event.preventDefault();
        if (!data) {
          return;
        }

        if (data.timer.isRunning) {
          pauseTimer();
          return;
        }

        const activeSession = data.sessions.find((session) => session.isActive === true);
        if (activeSession?.status === "paused") {
          resumeTimer();
          return;
        }

        startTimer();
        return;
      }

      if (key === KEYBOARD_SHORTCUTS.focusSearch) {
        event.preventDefault();
        if (location.pathname !== "/tasks") {
          navigate(withQueryFlag("/tasks", "focus", "search"));
          return;
        }

        const input = document.getElementById("tasks-search-input") as HTMLInputElement | null;
        input?.focus();
        input?.select();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [data, location.pathname, navigate, pauseTimer, resumeTimer, startTimer]);

  return null;
}
