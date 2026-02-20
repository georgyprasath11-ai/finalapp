import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false,
  );

  React.useEffect(() => {
    const mediaQueryList = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const listener = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    mediaQueryList.addEventListener("change", listener);
    listener();
    return () => mediaQueryList.removeEventListener("change", listener);
  }, []);

  return isMobile;
}
