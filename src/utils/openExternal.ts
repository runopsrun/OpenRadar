import { isTauri } from "@/services/storage";

/**
 * Open a link outside the webview. In Tauri, system links should go to the
 * user's browser rather than replacing the app UI; in the browser we use a
 * regular new tab.
 */
export async function openExternal(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) return;

  if (isTauri) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch (error) {
      console.warn("Native opener failed; falling back to window.open.", error);
    }
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
