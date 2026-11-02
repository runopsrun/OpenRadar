import { Radar } from "lucide-react";
import { cx } from "@/utils/cx";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cx("logo-mark", className)} aria-hidden="true">
      <Radar size={21} strokeWidth={2.1} />
      <span className="logo-mark__sweep" />
    </span>
  );
}

export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("brand", className)} aria-label="OpenRadar">
      <LogoMark />
      {!compact && (
        <div className="brand__text">
          <span className="brand__name">OpenRadar</span>
          <span className="brand__tag">weather radar</span>
        </div>
      )}
    </div>
  );
}
