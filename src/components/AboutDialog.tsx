import { useEffect, useRef } from "react";
import {
  Cpu,
  Database,
  Globe2,
  Keyboard,
  Map as MapIcon,
  Radar,
  Scale,
  Search,
  X,
} from "lucide-react";
import { APP_NAME, APP_VERSION } from "@/config/constants";
import { useUiStore } from "@/store/uiStore";
import { ExternalLink } from "@/components/ui";
import { LogoMark } from "@/components/Logo";

const SHORTCUTS: Array<[keys: string, action: string]> = [
  ["Space", "Play or pause the radar loop"],
  ["← / →", "Step one frame back or forward"],
  ["R", "Refresh the radar catalog"],
  ["L", "Toggle loop playback"],
  ["T", "Switch light / dark theme"],
  ["/", "Focus place search"],
  ["?", "Open this dialog"],
  ["Esc", "Close a panel or dialog"],
];

interface SourceRow {
  icon: typeof Radar;
  name: string;
  detail: string;
  href: string;
  license: string;
}

const SOURCES: SourceRow[] = [
  {
    icon: Radar,
    name: "LibreWXR",
    detail:
      "Global radar composites, short-range nowcast, satellite, alerts, and tile extras. Default public API; fully self-hostable.",
    href: "https://github.com/JoshuaKimsey/LibreWXR",
    license: "AGPL-3.0 server · CC-BY-4.0 data",
  },
  {
    icon: Radar,
    name: "RainViewer",
    detail:
      "Compatibility fallback for radar metadata and tiles. No alerts or LibreWXR tile extensions.",
    href: "https://www.rainviewer.com/api.html",
    license: "RainViewer API terms",
  },
  {
    icon: MapIcon,
    name: "OpenFreeMap",
    detail:
      "Keyless vector base maps (dark, positron, liberty) rendered with MapLibre GL JS.",
    href: "https://openfreemap.org",
    license: "Free service; OpenMapTiles schema",
  },
  {
    icon: Globe2,
    name: "OpenStreetMap",
    detail:
      "Map data behind every vector basemap and the place-search index.",
    href: "https://www.openstreetmap.org/copyright",
    license: "© OpenStreetMap contributors · ODbL",
  },
  {
    icon: Database,
    name: "Esri World Imagery",
    detail:
      "Optional satellite base map. Included for situational context and not distributed as open data. Review Esri's terms before production use.",
    href: "https://www.esri.com/en-us/arcgis/products/arcgis-online",
    license: "Esri / Maxar / Earthstar terms — not open data",
  },
  {
    icon: Globe2,
    name: "NOAA GMGSI",
    detail:
      "Hourly global infrared satellite imagery served through LibreWXR.",
    href: "https://www.noaa.gov/",
    license: "U.S. Government work · public domain",
  },
  {
    icon: Search,
    name: "Nominatim",
    detail:
      "Forward geocoding for place search. Requests are debounced and cached; run your own instance for heavy use.",
    href: "https://nominatim.openstreetmap.org/",
    license: "OSMF usage policy",
  },
  {
    icon: Cpu,
    name: "Tauri & MapLibre",
    detail:
      "Native shell, file persistence, tray, and PNG export (Tauri). Map rendering and custom tile protocol (MapLibre GL JS).",
    href: "https://tauri.app",
    license: "MIT / Apache-2.0 / BSD",
  },
];

export function AboutDialog() {
  const open = useUiStore((state) => state.aboutOpen);
  const setOpen = useUiStore((state) => state.setAboutOpen);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey, true);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="about-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <div
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="about__header">
          <div className="about__brand">
            <LogoMark />
            <div>
              <p className="about__eyebrow">About</p>
              <h2 id="about-title">{APP_NAME}</h2>
              <p className="about__version">Version {APP_VERSION} · desktop weather radar</p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={() => setOpen(false)}
            aria-label="Close about dialog"
          >
            <X size={18} />
          </button>
        </header>

        <div className="about__body">
          <p className="about__lede">
            A lightweight, map-first radar viewer built with Tauri, React, and
            MapLibre. It plays past observations and short-range nowcast frames,
            with optional satellite, CAP alerts, lightning, storm cells, and
            motion arrows.
          </p>

          <section className="about__section" aria-labelledby="about-sources">
            <div className="about__section-heading">
              <Scale size={15} />
              <h3 id="about-sources">Data sources & licenses</h3>
            </div>
            <ul className="about__sources">
              {SOURCES.map((source) => {
                const Icon = source.icon;
                return (
                  <li key={source.name} className="about__source">
                    <span className="about__source-icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <div>
                      <p className="about__source-name">
                        <ExternalLink href={source.href}>{source.name}</ExternalLink>
                        <span className="about__license">{source.license}</span>
                      </p>
                      <p className="about__source-detail">{source.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="about__section" aria-labelledby="about-keys">
            <div className="about__section-heading">
              <Keyboard size={15} />
              <h3 id="about-keys">Keyboard shortcuts</h3>
            </div>
            <dl className="about__shortcuts">
              {SHORTCUTS.map(([keys, action]) => (
                <div key={keys}>
                  <dt><kbd>{keys}</kbd></dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="about__section about__section--note" aria-labelledby="about-note">
            <div className="about__section-heading">
              <Database size={15} />
              <h3 id="about-note">Self-hosting & privacy</h3>
            </div>
            <p>
              OpenRadar ships with the public LibreWXR API but every request can
              be pointed at your own LibreWXR instance in Settings. The app keeps
              settings locally, sends only map viewport bounds to the alerts API,
              and never includes analytics or advertising. Place names are sent
              to Nominatim only when you search.
            </p>
          </section>

          <p className="about__disclaimer">
            Weather data is provided by third parties and may be delayed,
            incomplete, or inaccurate. Do not use OpenRadar as the sole source
            for life-safety decisions. OpenRadar is an independent project and
            is not affiliated with LibreWXR, RainViewer, Esri, NOAA, or
            OpenStreetMap.
          </p>
        </div>

        <footer className="about__footer">
          <span>Built with open data and open-source software.</span>
          <button type="button" className="button button--primary button--small" onClick={() => setOpen(false)}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
