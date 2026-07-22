"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

export type Theme = "dark" | "light" | "system";
export type Accent = "indigo" | "purple" | "emerald" | "amber" | "blue" | "rose";

const ACCENTS: Accent[] = ["indigo", "purple", "emerald", "amber", "blue", "rose"];

type ThemeContextType = {
  theme: Theme; // the raw preference (may be "system")
  setTheme: (theme: Theme) => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const ACCENT_KEY = "earngpt-accent";

function useHasMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

/** Resolve the raw theme preference to the concrete "dark"/"light" applied. */
function resolveTheme(theme: Theme): "dark" | "light" {
  if (theme === "system") {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: light)").matches
    ) {
      return "light";
    }
    return "dark";
  }
  return theme;
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "earngpt-theme",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const hasMounted = useHasMounted();

  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey) as Theme | null;
      if (stored === "dark" || stored === "light" || stored === "system") {
        return stored;
      }
    }
    return defaultTheme;
  });

  const [accent, setAccentState] = useState<Accent>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(ACCENT_KEY) as Accent | null;
      if (stored && ACCENTS.includes(stored)) return stored;
    }
    return "indigo";
  });

  const setTheme = (next: Theme) => {
    setThemeState(next);
    if (typeof window !== "undefined") localStorage.setItem(storageKey, next);
  };

  const setAccent = (next: Accent) => {
    setAccentState(next);
    if (typeof window !== "undefined") localStorage.setItem(ACCENT_KEY, next);
  };

  // Apply the resolved theme; when "system", follow OS changes live.
  useEffect(() => {
    if (!hasMounted) return;
    const apply = () =>
      document.documentElement.setAttribute("data-theme", resolveTheme(theme));
    apply();
    if (theme === "system" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme, hasMounted]);

  // Apply the accent as a data attribute (CSS remaps the brand ramp).
  useEffect(() => {
    if (hasMounted) {
      document.documentElement.setAttribute("data-accent", accent);
    }
  }, [accent, hasMounted]);

  if (!hasMounted) return null;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
