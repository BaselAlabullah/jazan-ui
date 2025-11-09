import { ArrowDown, ArrowUp, Minus, TrendingUp } from "lucide-react";

export const TREND_COLOR_BY_TONE = {
  positive: "text-sky-300",
  negative: "text-rose-300",
  neutral: "text-indigo-200",
};

export const TREND_ACCENT_BY_TONE = {
  positive: "border-sky-400/40 bg-sky-500/15 text-sky-100",
  negative: "border-rose-400/40 bg-rose-500/15 text-rose-200",
  neutral: "border-indigo-400/30 bg-indigo-500/10 text-indigo-200",
};

export const evaluateTrendState = (trend) => {
  const hasTrend = Boolean(trend);
  if (!hasTrend) {
    return {
      hasTrend: false,
      tone: "neutral",
      glyph: Minus,
      label: "",
      delta: 0,
      hasDelta: false,
      isZeroDelta: true,
    };
  }

  const explicitTone = trend?.tone;
  const rawDelta = trend?.delta;
  const hasDelta = rawDelta !== undefined && rawDelta !== null && Number.isFinite(Number(rawDelta));
  const delta = hasDelta ? Number(rawDelta) : 0;
  const isZeroDelta = !hasDelta || delta === 0;
  const isIncreasePositive = trend?.isIncreasePositive ?? true;

  let tone = explicitTone ?? "neutral";
  if (!explicitTone) {
    if (isZeroDelta) {
      tone = "neutral";
    } else {
      const isPositiveDelta = delta > 0;
      const isGoodChange = isIncreasePositive ? isPositiveDelta : !isPositiveDelta;
      tone = isGoodChange ? "positive" : "negative";
    }
  }

  const glyph = (() => {
    if (!isZeroDelta) {
      return delta > 0 ? ArrowUp : ArrowDown;
    }
    if (explicitTone && explicitTone !== "neutral") {
      return explicitTone === "positive" ? ArrowUp : ArrowDown;
    }
    return Minus;
  })();

  const label = (() => {
    if (typeof trend.label === "string" && trend.label.trim().length) {
      return trend.label;
    }
    if (isZeroDelta) {
      return trend?.noChangeLabel || "No change";
    }
    const absValue = Math.abs(delta);
    const formattedValue =
      trend?.precision !== undefined && Number.isFinite(Number(trend.precision))
        ? absValue.toFixed(trend.precision)
        : absValue;
    const suffix = trend?.suffix ? ` ${trend.suffix}` : "";
    return `${formattedValue}${suffix}`.trim();
  })();

  return {
    hasTrend: true,
    tone,
    glyph,
    label,
    delta,
    hasDelta,
    isZeroDelta,
  };
};

export const getTrendColorClass = (tone) => TREND_COLOR_BY_TONE[tone] || TREND_COLOR_BY_TONE.neutral;

export const getTrendAccentClass = (tone) => TREND_ACCENT_BY_TONE[tone] || TREND_ACCENT_BY_TONE.neutral;

export const selectIconTone = (tone, palette) => {
  if (tone === "positive" && palette.positive) return palette.positive;
  if (tone === "negative" && palette.negative) return palette.negative;
  return palette.neutral;
};

export const getIconOrientationClass = (Icon, tone, hasTrend) => {
  if (!Icon) return "";
  if (!hasTrend) return "";
  if (tone === "neutral") return "";
  if (Icon === TrendingUp) {
    return tone === "negative" ? "rotate-180" : "rotate-0";
  }
  return "";
};
