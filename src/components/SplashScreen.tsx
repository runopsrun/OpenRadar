import { Radar } from "lucide-react";
import { cx } from "@/utils/cx";

/**
 * Branded loading surface. The non-overlay variant is the first paint while
 * persisted settings hydrate; the overlay variant covers the map during the
 * initial catalog fetch.
 */
export function SplashScreen({
  overlay = false,
  message = "Preparing your radar…",
}: {
  overlay?: boolean;
  message?: string;
}) {
  return (
    <div className={cx("splash", overlay && "splash--overlay")} role="status" aria-live="polite">
      <div className="splash__inner">
        <span className="splash__logo" aria-hidden="true">
          <Radar size={34} strokeWidth={1.8} />
          <span className="splash__sweep" />
        </span>
        <p className="splash__eyebrow">OpenRadar</p>
        <h1 className="splash__title">Weather, in motion.</h1>
        <p className="splash__message">{message}</p>
        <span className="splash__loader" aria-hidden="true">
          <span />
        </span>
        <p className="splash__hint">Radar · nowcast · satellite · alerts</p>
      </div>
    </div>
  );
}
