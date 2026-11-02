/** User-facing settings that are persisted between launches. */

export type ThemePreference = "system" | "light" | "dark";
export type DataSourceId = "librewxr" | "rainviewer" | "custom";
export type BaseMapId = "dark" | "light" | "streets" | "satellite";
export type LightningStyle = "off" | "dots" | "bolts";

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

export interface SavedPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /**
   * False for regional results such as a country or state. Missing means the
   * place should open in the local-radar radius.
   */
  localRadar?: boolean;
}

export interface AppSettings {
  /* Appearance */
  theme: ThemePreference;
  baseMapId: BaseMapId;

  /* Data source */
  dataSourceId: DataSourceId;
  /** Only used when dataSourceId === "custom". */
  customHost: string;

  /* Overlays */
  radarEnabled: boolean;
  satelliteEnabled: boolean;
  coverageEnabled: boolean;
  alertsEnabled: boolean;
  radarOpacity: number;
  satelliteOpacity: number;
  coverageOpacity: number;
  colorScheme: number;
  smooth: boolean;
  snow: boolean;

  /* LibreWXR tile extensions */
  lightning: LightningStyle;
  stormCells: boolean;
  motionArrows: boolean;

  /* Animation */
  animationSpeedMs: number;
  loop: boolean;
  includeNowcast: boolean;
  /** 0 disables polling. */
  autoRefreshMinutes: number;

  /* Location */
  defaultView: MapViewState;
  recentPlaces: SavedPlace[];
  /** Radius, in miles, framed by the location prompt and the locate control. */
  localRadarMiles: number;
  /** True after the local-radar prompt is used or dismissed. */
  locationPromptDismissed: boolean;
}
