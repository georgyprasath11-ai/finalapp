import { SidebarNav } from "@/components/layout/SidebarNav";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return <SidebarNav>{children}</SidebarNav>;
}
