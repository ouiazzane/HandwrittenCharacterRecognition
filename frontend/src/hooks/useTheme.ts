import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (localStorage.getItem("charvision-theme") as "dark" | "light" | null) ?? "dark",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("charvision-theme", theme);
  }, [theme]);

  return { theme, toggleTheme: () => setTheme((current) => current === "dark" ? "light" : "dark") };
}
