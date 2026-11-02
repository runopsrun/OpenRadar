import { useEffect, useRef } from "react";
import { useRadarStore } from "@/store/radarStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";
import type { TimelineModel } from "@/hooks/useTimeline";

const FORM_TAGS = new Set(["input", "textarea", "select"]);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return FORM_TAGS.has(target.tagName.toLowerCase()) || target.isContentEditable;
}

/**
 * Global keyboard shortcuts. Inputs and buttons keep their native keyboard
 * behaviour; shortcuts only fire when the map/body has focus.
 */
export function useKeyboardShortcuts(timeline: TimelineModel): void {
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const typing = isTypingTarget(target);
      const tag = target instanceof HTMLElement ? target.tagName.toLowerCase() : "";

      if (event.key === "Escape") {
        const ui = useUiStore.getState();
        ui.setPanel(null);
        ui.setAboutOpen(false);
        return;
      }

      if (
        typing ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      // Let a focused button handle Space/Enter itself.
      if (tag === "button" && (event.key === " " || event.key === "Enter")) {
        return;
      }

      switch (event.key) {
        case " ": {
          event.preventDefault();
          if (!event.repeat) timelineRef.current.togglePlay();
          break;
        }
        case "ArrowLeft": {
          event.preventDefault();
          timelineRef.current.step(-1);
          break;
        }
        case "ArrowRight": {
          event.preventDefault();
          timelineRef.current.step(1);
          break;
        }
        case "?": {
          event.preventDefault();
          useUiStore.getState().setAboutOpen(true);
          break;
        }
        case "/": {
          event.preventDefault();
          window.dispatchEvent(new CustomEvent("openradar:focus-search"));
          break;
        }
        case "l":
        case "L": {
          event.preventDefault();
          const settings = useSettingsStore.getState();
          settings.update({ loop: !settings.loop });
          break;
        }
        case "r":
        case "R": {
          event.preventDefault();
          useRadarStore.getState().requestRefresh();
          break;
        }
        case "t":
        case "T": {
          event.preventDefault();
          const current =
            document.documentElement.dataset.theme === "light" ? "light" : "dark";
          useSettingsStore
            .getState()
            .update({ theme: current === "light" ? "dark" : "light" });
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
