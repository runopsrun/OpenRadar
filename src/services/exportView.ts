import { invoke } from "@tauri-apps/api/core";
import type { Map as MapLibreMap } from "maplibre-gl";
import { isTauri } from "@/services/storage";
import { toast } from "@/store/uiStore";
import { getErrorMessage } from "@/utils/errors";

function waitForRender(map: MapLibreMap): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    map.once("idle", finish);
    map.triggerRepaint();
    window.setTimeout(finish, 1_500);
  });
}

function timestampName(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `openradar-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;
}

function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Export the current map canvas with a baked-in attribution strip.
 * The map uses `preserveDrawingBuffer` so the WebGL canvas can be read here.
 */
export async function exportMapImage(
  map: MapLibreMap,
  attribution: string,
): Promise<void> {
  try {
    await waitForRender(map);

    const sourceCanvas = map.getCanvas();
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    if (width === 0 || height === 0) {
      throw new Error("The map is not ready to export yet.");
    }

    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const context = output.getContext("2d");
    if (!context) throw new Error("Canvas export is not supported here.");

    context.drawImage(sourceCanvas, 0, 0);

    const dpr = Math.max(
      1,
      width / Math.max(1, map.getContainer().clientWidth),
    );
    const barHeight = Math.round(30 * dpr);
    const gradient = context.createLinearGradient(
      0,
      height - barHeight,
      0,
      height,
    );
    gradient.addColorStop(0, "rgba(4, 9, 16, 0)");
    gradient.addColorStop(1, "rgba(4, 9, 16, 0.78)");
    context.fillStyle = gradient;
    context.fillRect(0, height - barHeight, width, barHeight);

    context.fillStyle = "rgba(236, 245, 255, 0.94)";
    context.font = `${Math.round(10.5 * dpr)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    context.textBaseline = "bottom";
    context.fillText(attribution, Math.round(12 * dpr), height - Math.round(9 * dpr));

    const brand = "OpenRadar";
    const brandWidth = context.measureText(brand).width;
    context.fillStyle = "rgba(56, 213, 255, 0.95)";
    context.fillText(brand, width - brandWidth - Math.round(12 * dpr), height - Math.round(9 * dpr));

    const dataUrl = output.toDataURL("image/png");
    if (!dataUrl || dataUrl.length < 1_000) {
      throw new Error("The map could not be captured (canvas is empty).");
    }

    const fileName = timestampName();

    if (isTauri) {
      const path = await invoke<string>("save_export", { dataUrl, fileName });
      toast({
        tone: "success",
        title: "Map image saved",
        message: path,
      });
    } else {
      downloadDataUrl(dataUrl, fileName);
      toast({
        tone: "success",
        title: "Map image downloaded",
        message: fileName,
      });
    }
  } catch (error) {
    toast({
      tone: "error",
      title: "Could not export the map",
      message: getErrorMessage(error),
    });
  }
}
