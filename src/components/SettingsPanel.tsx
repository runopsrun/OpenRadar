import { useEffect, useState } from "react";
import {
  Check,
  Info,
  Monitor,
  Moon,
  RefreshCw,
  RotateCcw,
  Sun,
} from "lucide-react";
import { APP_VERSION, LOCAL_RADAR_RADIUS_OPTIONS } from "@/config/constants";
import { useDeviceLocation } from "@/hooks/useDeviceLocation";
import {
  DATA_SOURCE_PRESETS,
  normalizeBaseUrl,
} from "@/config/dataSources";
import { useMapContext } from "@/map/MapContext";
import { useResolvedDataSource } from "@/hooks/useResolvedDataSource";
import { useNow } from "@/hooks/useNow";
import { useRadarStore } from "@/store/radarStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore, toast } from "@/store/uiStore";
import type { DataSourceId, ThemePreference } from "@/types/settings";
import { cx } from "@/utils/cx";
import { formatAge, formatCoordinates } from "@/utils/time";
import {
  Chip,
  ExternalLink,
  SegmentedControl,
  SelectField,
  Spinner,
  Toggle,
} from "@/components/ui";

export function SettingsPanel() {
  const settings = useSettingsStore();
  const update = useSettingsStore((state) => state.update);
  const setDefaultView = useSettingsStore((state) => state.setDefaultView);
  const reset = useSettingsStore((state) => state.reset);
  const source = useResolvedDataSource();
  const { getView, flyTo, map } = useMapContext();
  const { setRadiusMiles } = useDeviceLocation();

  const metadata = useRadarStore((state) => state.metadata);
  const status = useRadarStore((state) => state.status);
  const refreshing = useRadarStore((state) => state.refreshing);
  const error = useRadarStore((state) => state.error);
  const requestRefresh = useRadarStore((state) => state.requestRefresh);
  const now = useNow(30_000);
  const setAboutOpen = useUiStore((state) => state.setAboutOpen);

  const [hostDraft, setHostDraft] = useState(settings.customHost);
  const [hostError, setHostError] = useState<string | null>(null);

  useEffect(() => {
    setHostDraft(settings.customHost);
  }, [settings.customHost]);

  const selectSource = (id: DataSourceId) => {
    update({ dataSourceId: id });
    setHostError(null);
  };

  const applyCustomHost = () => {
    const normalized = normalizeBaseUrl(hostDraft);
    if (!normalized) {
      setHostError("Enter a valid http:// or https:// URL.");
      return;
    }
    setHostError(null);
    update({ customHost: normalized, dataSourceId: "custom" });
    toast({
      tone: "info",
      title: "Connecting to custom source",
      message: normalized,
    });
  };

  const useCurrentView = () => {
    const view = getView();
    if (!view) {
      toast({ tone: "warning", title: "The map is still loading." });
      return;
    }
    setDefaultView(view);
    toast({
      tone: "success",
      title: "Default location updated",
      message: formatCoordinates(view.latitude, view.longitude),
    });
  };

  const goToDefault = () => {
    flyTo(
      settings.defaultView.longitude,
      settings.defaultView.latitude,
      settings.defaultView.zoom,
    );
  };

  const handleReset = () => {
    if (!window.confirm("Reset all OpenRadar settings to their defaults?")) {
      return;
    }
    reset();
    toast({ tone: "info", title: "Settings reset to defaults." });
  };

  const connectionError = error && !metadata ? error : null;

  return (
    <div className="panel-content">
      <section className="panel-section">
        <div className="panel-section__heading">
          <h3>Appearance</h3>
        </div>
        <label className="field">
          <span className="field__label">Theme</span>
          <SegmentedControl<ThemePreference>
            value={settings.theme}
            label="Theme preference"
            onChange={(value) => update({ theme: value })}
            options={[
              {
                value: "system",
                label: "System",
                icon: <Monitor size={14} />,
              },
              { value: "light", label: "Light", icon: <Sun size={14} /> },
              { value: "dark", label: "Dark", icon: <Moon size={14} /> },
            ]}
          />
        </label>
        <p className="panel-note">
          The base map has its own style selector in the Layers panel.
        </p>
      </section>

      <section className="panel-section">
        <div className="panel-section__heading">
          <h3>Data source</h3>
          <span>
            {status === "ready" && metadata ? (
              <Chip tone="success">Connected</Chip>
            ) : status === "loading" ? (
              <Chip tone="neutral">Connecting…</Chip>
            ) : connectionError ? (
              <Chip tone="danger">Offline</Chip>
            ) : null}
          </span>
        </div>

        <div className="source-list" role="radiogroup" aria-label="Data source">
          {DATA_SOURCE_PRESETS.map((preset) => {
            const active = settings.dataSourceId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={cx("source-option", active && "is-active")}
                onClick={() => selectSource(preset.id)}
              >
                <span className="source-option__radio" aria-hidden="true">
                  {active && <Check size={12} />}
                </span>
                <span className="source-option__text">
                  <span className="source-option__name">{preset.label}</span>
                  <span className="source-option__description">
                    {preset.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {settings.dataSourceId === "custom" && (
          <div className="custom-source">
            <label className="field">
              <span className="field__label">Instance URL</span>
              <input
                type="url"
                className="text-input"
                value={hostDraft}
                placeholder="http://localhost:8080"
                spellCheck={false}
                onChange={(event) => {
                  setHostDraft(event.target.value);
                  setHostError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyCustomHost();
                }}
              />
            </label>
            {hostError && <p className="field__error">{hostError}</p>}
            <button type="button" className="button button--small" onClick={applyCustomHost}>
              Apply & reconnect
            </button>
            <p className="panel-note">
              A LibreWXR-compatible instance. See the{" "}
              <ExternalLink href="https://github.com/JoshuaKimsey/LibreWXR">
                self-hosting docs
              </ExternalLink>
              .
            </p>
          </div>
        )}

        <div className="connection-status">
          <div>
            <span className="connection-status__label">Effective host</span>
            <code>{metadata?.host ?? source.baseUrl ?? "not configured"}</code>
          </div>
          <div>
            <span className="connection-status__label">Last catalog</span>
            <span>
              {metadata ? formatAge(metadata.fetchedAt, now) : "never"}{" "}
              {metadata && (
                <span className="muted">
                  · {metadata.frames.length} frames
                </span>
              )}
            </span>
          </div>
        </div>

        {connectionError && (
          <p className="field__error">{connectionError.message}</p>
        )}

        <button
          type="button"
          className="button button--small"
          onClick={requestRefresh}
          disabled={refreshing}
        >
          {refreshing ? <Spinner size={14} /> : <RefreshCw size={14} />}
          Refresh now
        </button>
      </section>

      <section className="panel-section">
        <div className="panel-section__heading">
          <h3>Animation</h3>
        </div>
        <label className="slider-row">
          <span className="slider-row__label">
            Frame duration
            <output>{(settings.animationSpeedMs / 1000).toFixed(2)}s</output>
          </span>
          <input
            type="range"
            min={200}
            max={1500}
            step={50}
            value={settings.animationSpeedMs}
            onChange={(event) =>
              update({ animationSpeedMs: Number(event.target.value) })
            }
          />
        </label>

        <div className="inline-toggle-row">
          <span>
            <strong>Loop animation</strong>
            <span>Wrap back to the oldest frame.</span>
          </span>
          <Toggle
            checked={settings.loop}
            onChange={(checked) => update({ loop: checked })}
            label="Loop animation"
          />
        </div>
        <div className="inline-toggle-row">
          <span>
            <strong>Include nowcast</strong>
            <span>Show forecast frames after the latest observation.</span>
          </span>
          <Toggle
            checked={settings.includeNowcast}
            onChange={(checked) => update({ includeNowcast: checked })}
            label="Include nowcast frames"
          />
        </div>

        <label className="field">
          <span className="field__label">Auto-refresh catalog</span>
          <SelectField
            value={settings.autoRefreshMinutes}
            label="Auto-refresh interval"
            onChange={(value) =>
              update({ autoRefreshMinutes: Number(value) })
            }
          >
            <option value={1}>Every minute</option>
            <option value={3}>Every 3 minutes</option>
            <option value={5}>Every 5 minutes</option>
            <option value={10}>Every 10 minutes</option>
            <option value={0}>Off</option>
          </SelectField>
        </label>
      </section>

      <section className="panel-section">
        <div className="panel-section__heading">
          <h3>Default location</h3>
        </div>
        <div className="coords-card">
          <span>{formatCoordinates(settings.defaultView.latitude, settings.defaultView.longitude)}</span>
          <span className="muted">Zoom {settings.defaultView.zoom.toFixed(1)}</span>
        </div>
        <div className="button-row">
          <button type="button" className="button button--small" onClick={useCurrentView}>
            Use current view
          </button>
          <button
            type="button"
            className="button button--small button--ghost"
            onClick={goToDefault}
            disabled={!map}
          >
            Go to default
          </button>
        </div>
        <label className="field">
          <span className="field__label">Local radar radius</span>
          <SelectField
            value={settings.localRadarMiles}
            label="Local radar radius"
            onChange={(value) => setRadiusMiles(Number(value))}
          >
            {LOCAL_RADAR_RADIUS_OPTIONS.map((miles) => (
              <option key={miles} value={miles}>
                {miles} miles
              </option>
            ))}
          </SelectField>
        </label>
        <p className="panel-note">
          The map opens on the default view. Your location and city searches
          frame this radius and draw it on the radar.
        </p>
      </section>

      <section className="panel-section">
        <button
          type="button"
          className="text-button text-button--muted"
          onClick={handleReset}
        >
          <RotateCcw size={14} /> Reset all settings
        </button>
        <div className="about-row">
          <button
            type="button"
            className="text-button"
            onClick={() => setAboutOpen(true)}
          >
            <Info size={14} /> About OpenRadar & data licenses
          </button>
          <span className="version">v{APP_VERSION}</span>
        </div>
      </section>
    </div>
  );
}
