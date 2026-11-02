import type { MapGeoJSONFeature } from "maplibre-gl";
import { formatFullTime } from "@/utils/time";
import { openExternal } from "@/utils/openExternal";

function propertyString(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function severityClass(severity: string): string {
  return severity.toLowerCase().replace(/[^a-z]/g, "") || "unknown";
}

/**
 * Build a DOM node (not an HTML string) for a map popup. This avoids injecting
 * untrusted alert text into the app document.
 */
export function createAlertPopupContent(feature: MapGeoJSONFeature): HTMLElement {
  const props = feature.properties ?? {};
  const severity = propertyString(props.severity, "Unknown");
  const title = propertyString(props.title, "Weather alert");
  const regions = propertyString(props.regions);
  const description = propertyString(props.description);
  const uri = propertyString(props.uri);
  const starts = Number(props.time);
  const expires = Number(props.expires);

  const root = document.createElement("div");
  root.className = "alert-popup";

  const header = document.createElement("div");
  header.className = "alert-popup__header";

  const chip = document.createElement("span");
  chip.className = `severity-chip severity-chip--${severityClass(severity)}`;
  chip.textContent = severity;
  header.appendChild(chip);

  if (Number.isFinite(expires)) {
    const expiry = document.createElement("span");
    expiry.className = "alert-popup__expiry";
    expiry.textContent = `Until ${formatFullTime(expires)}`;
    header.appendChild(expiry);
  }
  root.appendChild(header);

  const heading = document.createElement("h3");
  heading.className = "alert-popup__title";
  heading.textContent = title;
  root.appendChild(heading);

  if (regions) {
    const region = document.createElement("p");
    region.className = "alert-popup__regions";
    region.textContent = regions;
    root.appendChild(region);
  }

  if (Number.isFinite(starts)) {
    const issued = document.createElement("p");
    issued.className = "alert-popup__meta";
    issued.textContent = `Issued ${formatFullTime(starts)}`;
    root.appendChild(issued);
  }

  if (description) {
    const body = document.createElement("p");
    body.className = "alert-popup__description";
    body.textContent = description;
    root.appendChild(body);
  }

  if (uri && /^https?:\/\//i.test(uri)) {
    const link = document.createElement("a");
    link.className = "alert-popup__link";
    link.href = uri;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View official alert";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      void openExternal(uri);
    });
    root.appendChild(link);
  }

  return root;
}
