import { SidebarNav } from "@/components/layout/SidebarNav";
import { FocusModeOverlay } from "@/components/timer/FocusModeOverlay";
import { FocusModeProvider, useFocusMode } from "@/hooks/useFocusMode";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const focusMode = useFocusMode();

  return (
    <FocusModeProvider value={focusMode}>
      <SidebarNav>{children}</SidebarNav>
      {focusMode.isFocusMode ? <FocusModeOverlay exitFocusMode={focusMode.exitFocusMode} /> : null}
    </FocusModeProvider>
  );
}
