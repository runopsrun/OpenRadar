import { X } from "lucide-react";
import { useUiStore, type PanelId } from "@/store/uiStore";
import { cx } from "@/utils/cx";
import { LayerPanel } from "@/components/LayerPanel";
import { SettingsPanel } from "@/components/SettingsPanel";

const PANEL_TITLES: Record<PanelId, { title: string; subtitle: string }> = {
  layers: {
    title: "Layers & overlays",
    subtitle: "Radar, satellite, alerts, and the base map",
  },
  settings: {
    title: "Settings",
    subtitle: "Data source, animation, theme, and location",
  },
};

export function SidePanel() {
  const panel = useUiStore((state) => state.panel);
  const setPanel = useUiStore((state) => state.setPanel);

  if (!panel) return null;
  const copy = PANEL_TITLES[panel];

  return (
    <>
      <button
        type="button"
        className="panel-scrim"
        aria-label="Close panel"
        onClick={() => setPanel(null)}
      />
      <aside className="side-panel" aria-label={copy.title}>
        <header className="side-panel__header">
          <div>
            <p className="side-panel__eyebrow">OpenRadar</p>
            <h2>{copy.title}</h2>
            <p>{copy.subtitle}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close panel"
            onClick={() => setPanel(null)}
            autoFocus
          >
            <X size={18} />
          </button>
        </header>

        <div className="side-panel__tabs" role="tablist" aria-label="Panel">
          {(["layers", "settings"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={panel === id}
              className={cx("side-panel__tab", panel === id && "is-active")}
              onClick={() => setPanel(id)}
            >
              {id === "layers" ? "Layers" : "Settings"}
            </button>
          ))}
        </div>

        <div className="side-panel__body">
          {panel === "layers" ? <LayerPanel /> : <SettingsPanel />}
        </div>
      </aside>
    </>
  );
}
