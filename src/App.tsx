import { useSettingsHydrated } from "@/store/settingsStore";
import { useRadarStore } from "@/store/radarStore";
import { useTheme } from "@/hooks/useTheme";
import { useRadarMetadata } from "@/hooks/useRadarMetadata";
import { useTauriEvents } from "@/hooks/useTauriEvents";
import { useTimeline } from "@/hooks/useTimeline";
import { useAnimation } from "@/hooks/useAnimation";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { MapProvider } from "@/map/MapContext";
import { MapView } from "@/map/MapView";
import { TopBar } from "@/components/TopBar";
import { SidePanel } from "@/components/SidePanel";
import { Timeline } from "@/components/Timeline";
import { LocationPrompt } from "@/components/LocationPrompt";
import { MapControls } from "@/components/MapControls";
import { AttributionBar } from "@/components/AttributionBar";
import { StatusBanner } from "@/components/StatusBanner";
import { ErrorState } from "@/components/ErrorState";
import { ToastViewport } from "@/components/ToastViewport";
import { AboutDialog } from "@/components/AboutDialog";
import { SplashScreen } from "@/components/SplashScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/**
 * Everything inside the provider can use the map instance. Data lifecycle and
 * playback hooks live here (not in MapView) so the shell and the map share the
 * exact same timeline model.
 */
function AppShell() {
  useRadarMetadata();
  useTauriEvents();

  const timeline = useTimeline();
  useAnimation(timeline.frames);
  useKeyboardShortcuts(timeline);

  const metadata = useRadarStore((state) => state.metadata);
  const status = useRadarStore((state) => state.status);
  const initialLoading =
    !metadata && (status === "idle" || status === "loading");

  return (
    <div className="app-shell">
      <TopBar />

      <main className="map-stage" aria-label="Weather map">
        <MapView />
        <StatusBanner />
        <LocationPrompt />
        <MapControls />
        <ErrorState />
        <AttributionBar />
        <Timeline timeline={timeline} />
      </main>

      <SidePanel />
      <ToastViewport />
      <AboutDialog />

      {initialLoading && (
        <SplashScreen
          overlay
          message={
            status === "loading"
              ? "Loading radar frames…"
              : "Preparing your radar…"
          }
        />
      )}
    </div>
  );
}

export default function App() {
  useTheme();
  const hydrated = useSettingsHydrated();

  if (!hydrated) {
    return <SplashScreen message="Restoring your settings…" />;
  }

  return (
    <ErrorBoundary>
      <MapProvider>
        <AppShell />
      </MapProvider>
    </ErrorBoundary>
  );
}
