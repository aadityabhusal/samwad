import { useUiConfigStore } from "@/lib/store";
import { IUiConfig } from "@/lib/types";
import { createContext, useContext, useLayoutEffect, useMemo } from "react";

type ThemeProviderProps = {
  children: React.ReactNode;
};

type ThemeProviderState = {
  theme?: IUiConfig["theme"];
  toggleTheme: () => void;
};

const initialState: ThemeProviderState = {
  toggleTheme: () => {},
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useUiConfigStore((s) => s.theme);
  const setUiConfig = useUiConfigStore((s) => s.setUiConfig);

  const resolvedTheme = useMemo(() => {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    return theme || (prefersDark ? "dark" : "light");
  }, [theme]);

  useLayoutEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  const value = {
    theme,
    toggleTheme: () =>
      setUiConfig({ theme: resolvedTheme === "dark" ? "light" : "dark" }),
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
