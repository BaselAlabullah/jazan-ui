import React from "react";
import {
  evaluateTrendState,
  getIconOrientationClass,
  getTrendAccentClass,
  getTrendColorClass,
  selectIconTone,
} from "../utils/trends";
import { ACCENT_GRADIENT, GLASS_TILE } from "../constants/ui";

const DEFAULT_ICON_TONES = {
  neutral: {
    frame: `${ACCENT_GRADIENT} shadow-lg`,
    inner: "bg-indigo-500/20 text-white border border-white/10",
  },
  positive: {
    frame: "bg-gradient-to-br from-sky-500 via-indigo-500 to-blue-500 shadow-[0_20px_45px_rgba(56,189,248,0.35)]",
    inner: "border border-sky-400/40 bg-sky-500/15 text-sky-50",
  },
  negative: {
    frame: "bg-gradient-to-br from-rose-600 via-red-500 to-amber-400 shadow-[0_20px_45px_rgba(239,68,68,0.35)]",
    inner: "border border-rose-400/40 bg-rose-500/15 text-rose-50",
  },
};

const KpiCard = ({ title, value, icon: Icon, color, trend }) => {
  const trendState = evaluateTrendState(trend);
  const { hasTrend, tone: trendTone, glyph: TrendGlyph, label: trendLabel } = trendState;
  const trendColor = getTrendColorClass(trendTone);
  const trendAccent = getTrendAccentClass(trendTone);
  const iconTone = selectIconTone(trendTone, {
    neutral: {
      frame: DEFAULT_ICON_TONES.neutral.frame,
      inner: color ? `${color} text-white border border-white/10` : DEFAULT_ICON_TONES.neutral.inner,
    },
    positive: DEFAULT_ICON_TONES.positive,
    negative: DEFAULT_ICON_TONES.negative,
  });
  const iconOrientationClass = getIconOrientationClass(Icon, trendTone, hasTrend);

  return (
    <div className={`${GLASS_TILE} px-5 py-4`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-gray-400">{title}</div>
          <div className="mt-2 text-2xl font-bold text-white">{value}</div>
          {hasTrend ? (
            <div className={`mt-1 flex items-center gap-2 text-xs font-medium ${trendColor}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${trendAccent}`}>
                <TrendGlyph size={14} strokeWidth={2.5} />
              </span>
              <span>{trendLabel}</span>
            </div>
          ) : null}
        </div>
        {Icon ? (
          <div className={`${iconTone.frame} rounded-2xl p-[1px]`}>
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-[14px] ${iconTone.inner} ${iconOrientationClass}`}
            >
              <Icon size={22} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default KpiCard;
