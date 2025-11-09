import React from "react";
import {
  evaluateTrendState,
  getIconOrientationClass,
  getTrendAccentClass,
  getTrendColorClass,
  selectIconTone,
} from "../utils/trends";
import { ACCENT_GRADIENT, GLASS_TILE } from "../constants/ui";

const ICON_TONES = {
  neutral: {
    frame: `${ACCENT_GRADIENT} shadow-lg`,
    inner: "border border-white/10 bg-neutral-900/60 text-white",
  },
  positive: {
    frame: "bg-gradient-to-br from-sky-500 via-indigo-500 to-blue-500 shadow-[0_18px_40px_rgba(56,189,248,0.35)]",
    inner: "border border-sky-400/40 bg-sky-500/15 text-sky-50",
  },
  negative: {
    frame: "bg-gradient-to-br from-rose-600 via-red-500 to-amber-400 shadow-[0_18px_40px_rgba(239,68,68,0.35)]",
    inner: "border border-rose-400/40 bg-rose-500/15 text-rose-50",
  },
};

const MetricDisplay = ({ icon: Icon, label, value, unit, trend }) => {
  const trendState = evaluateTrendState(trend);
  const { hasTrend, tone: trendTone, glyph: TrendGlyph, label: trendLabel } = trendState;
  const trendColor = getTrendColorClass(trendTone);
  const trendAccent = getTrendAccentClass(trendTone);
  const iconTone = selectIconTone(trendTone, ICON_TONES);
  const iconOrientationClass = getIconOrientationClass(Icon, trendTone, hasTrend);

  return (
    <div className={`${GLASS_TILE} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</div>
          <div className="mt-1 text-2xl font-bold text-white">
            {value}
            {unit ? <span className="ml-1 text-sm font-semibold text-gray-400">{unit}</span> : null}
          </div>
        </div>
        {Icon ? (
          <div className={`${iconTone.frame} rounded-2xl p-[1px]`}>
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconTone.inner} ${iconOrientationClass}`}>
              <Icon size={20} strokeWidth={2.5} />
            </div>
          </div>
        ) : null}
      </div>
      {hasTrend ? (
        <div className={`mt-3 flex items-center gap-2 text-xs font-medium ${trendColor}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${trendAccent}`}>
            <TrendGlyph size={14} strokeWidth={2.5} />
          </span>
          <span>{trendLabel}</span>
        </div>
      ) : null}
    </div>
  );
};

export default MetricDisplay;
