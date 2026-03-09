import { type ReactNode, createContext, useContext, useState } from "react";

export interface FocusModeState {
  isFocusMode: boolean;
  enterFocusMode: () => void;
  exitFocusMode: () => void;
}

const FocusModeContext = createContext<FocusModeState | null>(null);

export function useFocusMode() {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const enterFocusMode = () => setIsFocusMode(true);
  const exitFocusMode = () => setIsFocusMode(false);
  return { isFocusMode, enterFocusMode, exitFocusMode };
}

export function FocusModeProvider({
  value,
  children,
}: {
  value: FocusModeState;
  children: ReactNode;
}) {
  return <FocusModeContext.Provider value={value}>{children}</FocusModeContext.Provider>;
}

export function useFocusModeContext(): FocusModeState {
  const context = useContext(FocusModeContext);
  if (!context) {
    throw new Error("useFocusModeContext must be used inside FocusModeProvider.");
  }

  return context;
}

