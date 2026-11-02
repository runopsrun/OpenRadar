import { useEffect } from "react";
import { useSettingsStore } from "@/store/settingsStore";

function applyTheme(resolved: "light" | "dark"): void {
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#060a12" : "#eef3f9");
}

/** Applies the theme preference (including live OS changes) to the document. */
export function useTheme(): void {
  const preference = useSettingsStore((state) => state.theme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved =
        preference === "system" ? (media.matches ? "dark" : "light") : preference;
      applyTheme(resolved);
    };

    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);
}

/** Toggle the currently rendered theme and persist it as an explicit choice. */
export function toggleTheme(): void {
  const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  useSettingsStore.getState().update({ theme: current === "light" ? "dark" : "light" });
}
