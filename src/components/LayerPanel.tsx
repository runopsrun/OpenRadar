import {
  CloudRain,
  Layers3,
  Map as MapIcon,
  Satellite,
  TriangleAlert,
  Wind,
  Zap,
} from "lucide-react";
import {
  FALLBACK_COLOR_SCHEMES,
  GRAYSCALE_SCHEME,
} from "@/config/constants";
import { BASE_MAP_LIST } from "@/config/basemaps";
import { useAlertsStore } from "@/store/alertsStore";
import { useRadarStore } from "@/store/radarStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";
import { useResolvedDataSource } from "@/hooks/useResolvedDataSource";
import type { BaseMapId, LightningStyle } from "@/types/settings";
import { cx } from "@/utils/cx";
import { Chip, SelectField, Toggle } from "@/components/ui";

function Section({
  title,
  children,
  hint,
}: {
  title: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <section className="panel-section">
      <div className="panel-section__heading">
        <h3>{title}</h3>
        {hint && <span>{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function OverlayRow({
  icon,
  title,
  description,
  checked,
  onChange,
  disabled = false,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div className={cx("overlay-row", disabled && "is-disabled")}>
      <span className="overlay-row__icon">{icon}</span>
      <span className="overlay-row__text">
        <span className="overlay-row__title">
          {title}
          {badge}
        </span>
        <span className="overlay-row__description">{description}</span>
      </span>
      <Toggle
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        label={title}
      />
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
  min = 0.1,
  max = 1,
  step = 0.05,
  format,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
}) {
  return (
    <label className="slider-row">
      <span className="slider-row__label">
        {label}
        <output>{format ? format(value) : `${Math.round(value * 100)}%`}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function LayerPanel() {
  const settings = useSettingsStore();
  const update = useSettingsStore((state) => state.update);
  const source = useResolvedDataSource();
  const metadata = useRadarStore((state) => state.metadata);
  const alertsStatus = useAlertsStore((state) => state.status);
  const alertsCount = useAlertsStore((state) => state.count);
  const alertsError = useAlertsStore((state) => state.error);
  const setAboutOpen = useUiStore((state) => state.setAboutOpen);

  const baseSchemes =
    metadata?.colorSchemes ??
    (source.supportsExtensions
      ? [...FALLBACK_COLOR_SCHEMES, GRAYSCALE_SCHEME]
      : FALLBACK_COLOR_SCHEMES);
  const colorSchemes = baseSchemes.some(
    (scheme) => scheme.id === settings.colorScheme,
  )
    ? baseSchemes
    : [
        ...baseSchemes,
        { id: settings.colorScheme, name: `Scheme ${settings.colorScheme}` },
      ];

  const satelliteAvailable = metadata
    ? metadata.satelliteFrames.length > 0
    : true;
  const extensionsDisabled = !source.supportsExtensions;
  const alertsDisabled = !source.supportsAlerts;

  const alertsDescription = alertsDisabled
    ? "Requires a LibreWXR data source."
    : alertsStatus === "loading"
      ? "Loading active alerts for this view…"
      : alertsStatus === "error"
        ? (alertsError ?? "Alerts are unavailable right now.")
        : alertsStatus === "ready"
          ? `${alertsCount} active alert${alertsCount === 1 ? "" : "s"} in view.`
          : "WMO CAP warnings, watches, and advisories.";

  return (
    <div className="panel-content">
      <Section title="Overlays">
        <OverlayRow
          icon={<CloudRain size={17} />}
          title="Radar"
          description="Animated precipitation composites with nowcast."
          checked={settings.radarEnabled}
          onChange={(checked) => update({ radarEnabled: checked })}
        />

        {settings.radarEnabled && (
          <div className="overlay-settings">
            <label className="field">
              <span className="field__label">Colour scheme</span>
              <SelectField
                value={settings.colorScheme}
                label="Radar colour scheme"
                onChange={(value) => update({ colorScheme: Number(value) })}
              >
                {colorSchemes.map((scheme) => (
                  <option key={scheme.id} value={scheme.id}>
                    {scheme.name}
                  </option>
                ))}
              </SelectField>
            </label>

            <SliderRow
              label="Radar opacity"
              value={settings.radarOpacity}
              onChange={(value) => update({ radarOpacity: value })}
              min={0.15}
              max={1}
              step={0.05}
            />

            <div className="inline-toggles">
              <label className="inline-toggle">
                <span>Smoothing</span>
                <Toggle
                  checked={settings.smooth}
                  onChange={(checked) => update({ smooth: checked })}
                  label="Smooth radar tiles"
                />
              </label>
              <label className="inline-toggle">
                <span>Snow mask</span>
                <Toggle
                  checked={settings.snow}
                  onChange={(checked) => update({ snow: checked })}
                  label="Show snow mask"
                />
              </label>
            </div>
          </div>
        )}

        <OverlayRow
          icon={<Satellite size={17} />}
          title="Satellite"
          description={
            satelliteAvailable
              ? "Hourly NOAA GMGSI cloud imagery."
              : "No satellite frames are available from this source."
          }
          checked={settings.satelliteEnabled}
          onChange={(checked) => update({ satelliteEnabled: checked })}
          disabled={!satelliteAvailable}
        />
        {settings.satelliteEnabled && satelliteAvailable && (
          <div className="overlay-settings">
            <SliderRow
              label="Satellite opacity"
              value={settings.satelliteOpacity}
              onChange={(value) => update({ satelliteOpacity: value })}
              min={0.15}
              max={1}
              step={0.05}
            />
          </div>
        )}

        <OverlayRow
          icon={<TriangleAlert size={17} />}
          title="Weather alerts"
          description={alertsDescription}
          checked={settings.alertsEnabled}
          onChange={(checked) => update({ alertsEnabled: checked })}
          disabled={alertsDisabled}
          badge={
            alertsStatus === "ready" && alertsCount > 0 ? (
              <Chip tone="warning">{alertsCount}</Chip>
            ) : undefined
          }
        />
      </Section>

      <Section
        title="LibreWXR extras"
        hint={extensionsDisabled ? "LibreWXR only" : undefined}
      >
        <p className="panel-note">
          Server-rendered tile enhancements. They stay aligned to each radar
          frame and are ignored by RainViewer.
        </p>

        <OverlayRow
          icon={<Wind size={17} />}
          title="Storm motion arrows"
          description="Optical-flow direction and speed overlaid on tiles."
          checked={settings.motionArrows}
          onChange={(checked) => update({ motionArrows: checked })}
          disabled={extensionsDisabled}
          badge={<Chip tone="accent">beta</Chip>}
        />
        <OverlayRow
          icon={<Zap size={17} />}
          title="Storm cells"
          description="Detected convective cells and their motion."
          checked={settings.stormCells}
          onChange={(checked) => update({ stormCells: checked })}
          disabled={extensionsDisabled}
          badge={<Chip tone="accent">beta</Chip>}
        />

        <label className="field">
          <span className="field__label">Lightning glyphs</span>
          <SelectField
            value={settings.lightning}
            label="Lightning glyph style"
            disabled={extensionsDisabled}
            onChange={(value) =>
              update({ lightning: value as LightningStyle })
            }
          >
            <option value="off">Off</option>
            <option value="dots">Dots</option>
            <option value="bolts">Bolts</option>
          </SelectField>
        </label>
        {extensionsDisabled && (
          <p className="panel-note panel-note--warning">
            Switch the data source to LibreWXR in Settings to use these extras.
          </p>
        )}
      </Section>

      <Section title="Base map">
        <div className="basemap-grid">
          {BASE_MAP_LIST.map((baseMap) => (
            <button
              key={baseMap.id}
              type="button"
              className={cx(
                "basemap-option",
                settings.baseMapId === baseMap.id && "is-active",
              )}
              onClick={() => update({ baseMapId: baseMap.id as BaseMapId })}
              title={`${baseMap.name} — ${baseMap.attribution}`}
              aria-pressed={settings.baseMapId === baseMap.id}
            >
              <span className={cx("basemap-swatch", baseMap.swatchClass)}>
                <MapIcon size={15} />
              </span>
              <span className="basemap-option__name">{baseMap.name}</span>
            </button>
          ))}
        </div>
        <p className="panel-note">
          Base maps by OpenFreeMap/OpenStreetMap. The satellite base map uses
          Esri World Imagery, which is not open data.
        </p>
      </Section>

      <div className="panel-footer">
        <button
          type="button"
          className="text-button"
          onClick={() => setAboutOpen(true)}
        >
          <Layers3 size={14} /> Data sources & licenses
        </button>
      </div>
    </div>
  );
}
