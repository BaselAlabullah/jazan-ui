import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Activity,
  Wrench,
  TrendingUp,
  CheckCircle,
  Calendar,
  Droplets,
  Gauge,
  Filter,
  Clock,
  FileText,
  Zap,
  Search,
  XCircle,
  Building,
  ShieldAlert,
  BrainCircuit,
  LineChart as TrendIcon,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  Line,
  LineChart,
} from "recharts";
import { MOCK_KPI_PAYLOAD } from "./mockKpis";
import KpiCard from "./components/KpiCard";
import MetricDisplay from "./components/MetricDisplay";
import {
  ACCENT_GRADIENT,
  ACCENT_TEXT,
  FILTER_PILL_BASE,
  GLASS_CARD,
  GLASS_TILE,
  INPUT_BASE,
} from "./constants/ui";

const PSI_PER_MBAR = 0.0145038;
const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const psiFromMbar = (value) => Number((((value ?? 0) * PSI_PER_MBAR) + 12).toFixed(2));
const formatDate = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString();
};
const formatTimeRemaining = (days) => {
  if (!Number.isFinite(days)) return "-";
  if (days >= 14) {
    const weeks = Math.max(1, Math.round(days / 7));
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  if (days >= 1) {
    const rounded = Math.max(1, Math.round(days));
    return `${rounded} day${rounded === 1 ? "" : "s"}`;
  }
  const hours = Math.max(1, Math.round(days * 24));
  return `${hours} hour${hours === 1 ? "" : "s"}`;
};
const riskColorFor = (impact, probability) => {
  const normalize = (value, fallback) => {
    const lvl = String(value || "").toLowerCase();
    if (lvl.includes("very high")) return "High";
    if (lvl.includes("very low")) return "Low";
    if (lvl.includes("high")) return "High";
    if (lvl.includes("medium")) return "Medium";
    if (lvl.includes("low")) return "Low";
    return fallback;
  };
  const key = `${normalize(impact, "Medium")}-${normalize(probability, "Medium")}`;
  const mapping = {
    "High-High": "bg-red-700",
    "High-Medium": "bg-red-600",
    "Medium-High": "bg-red-600",
    "Medium-Medium": "bg-amber-500",
    "Low-High": "bg-amber-400",
    "High-Low": "bg-amber-400",
    "Low-Medium": "bg-emerald-500",
    "Medium-Low": "bg-emerald-500",
    "Low-Low": "bg-emerald-600",
  };
  return mapping[key] || "bg-slate-700/80";
};
const probabilityLevelFromValue = (value) => {
  if (value >= 0.85) return "Very High";
  if (value >= 0.65) return "High";
  if (value >= 0.4) return "Medium";
  if (value >= 0.2) return "Low";
  return "Very Low";
};
const impactLevelFromSignal = (riskBand, dpPsi) => {
  if (riskBand === "high") {
    return dpPsi >= 28 ? "Very High" : "High";
  }
  if (riskBand === "medium") {
    if (dpPsi >= 24) return "High";
    if (dpPsi >= 20) return "Medium";
    return "Low";
  }
  return dpPsi <= 12 ? "Very Low" : dpPsi <= 16 ? "Low" : "Medium";
};
const RISK_LEVEL_SCORES = {
  "very low": 15,
  low: 30,
  medium: 55,
  high: 75,
  "very high": 90,
};
const riskScoreFromLevels = (probabilityLevel, impactLevel) => {
  const p = RISK_LEVEL_SCORES[probabilityLevel.toLowerCase()] ?? 45;
  const i = RISK_LEVEL_SCORES[impactLevel.toLowerCase()] ?? 45;
  return Math.round((p + i) / 2);
};
const LEVEL_LABELS = {
  "very low": "Very Low",
  low: "Low",
  medium: "Medium",
  high: "High",
  "very high": "Very High",
};
const toTitleLevel = (value) => LEVEL_LABELS[String(value || "medium").toLowerCase()] ?? "Medium";
const regimeColor = (regime) =>
  ({
    normal: "#22c55e",
    post_startup: "#6366f1",
    low_load: "#f59e0b",
    shutdown: "#94a3b8",
  }[regime] || "#e5e7eb");
const buildFiveWhys = (explanation) => {
  const reasons = (explanation?.reasons ?? []).map((reason) => reason.replace(/\*\*/g, ""));
  const fallbacks = [
    "Strainer has accumulated fouling over recent days.",
    "Upstream conditions increased particulate carryover.",
    "Separator efficiency drifted from design values.",
    "Maintenance interval extended beyond planned window.",
    "Instrumentation indicates imbalance requiring calibration.",
  ];
  return reasons
    .concat(fallbacks)
    .slice(0, 5)
    .map((reason, idx) => ({
      why: `Why ${idx + 1}?`,
      because: reason,
    }));
};
const buildRootCauseAnalysis = (explanation, lastPoint, dpPsi, flowRate, efficiency, daysSinceClean) => {
  const lines = [];
  lines.push(`**Current Regime: ${String(lastPoint?.regime ?? "normal").replace(/_/g, " ")}**`);
  lines.push("");
  const reasons = explanation?.reasons ?? [];
  if (reasons.length) {
    lines.push("Drivers identified by the breach model:");
    lines.push("");
    reasons.forEach((reason, index) => {
      lines.push(`${index + 1}. ${reason}`);
    });
    lines.push("");
  }
  lines.push(
    `Current DP is approximately ${dpPsi.toFixed(2)} psi with efficiency near ${efficiency.toFixed(
      1,
    )}%. Last cleaning was about ${daysSinceClean} days ago and projected flow is ${Math.max(flowRate, 0).toFixed(
      0,
    )} bbl/d.`,
  );
  lines.push("");
  lines.push("**Recommended Actions:**");
  const actions = explanation?.actions ?? [];
  if (actions.length) {
    actions.forEach((action) => lines.push(`- ${action}`));
  } else {
    lines.push("- Continue standard monitoring cadence and follow breach response checklist if persistence criteria are met.");
  }
  return lines.join("\n");
};
const buildAssetLanguageReplacements = (singular, plural) => [
  { pattern: /\bStrainers\b/g, replacement: plural },
  { pattern: /\bstrainers\b/g, replacement: plural.toLowerCase() },
  { pattern: /\bStrainer\b/g, replacement: singular },
  { pattern: /\bstrainer\b/g, replacement: singular.toLowerCase() },
];
const replaceAssetLanguage = (value, replacements = []) => {
  if (typeof value === "string") {
    return replacements.reduce((text, { pattern, replacement }) => text.replace(pattern, replacement), value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => replaceAssetLanguage(entry, replacements));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceAssetLanguage(entry, replacements)]));
  }
  return value;
};
const deriveMetricTrendsForStrainer = (strainer) => {
  if (!strainer) return {};
  const safeNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };
  const currentMetrics = strainer.currentMetrics ?? {};
  const trends = strainer.trends ?? {};
  const historicalData = Array.isArray(strainer.historicalData) ? strainer.historicalData : [];

  const currentDP = safeNumber(currentMetrics.differentialPressure, safeNumber(trends.baselineDP, 0));
  const baselineDP = safeNumber(trends.baselineDP, currentDP);
  const dpDeltaRaw = currentDP - baselineDP;
  const normalizedDpDelta = Math.abs(dpDeltaRaw) < 0.05 ? 0 : Number(dpDeltaRaw.toFixed(2));
  const differentialPressure = {
    delta: normalizedDpDelta,
    isIncreasePositive: false,
    label:
      normalizedDpDelta === 0
        ? "On baseline"
        : `${normalizedDpDelta > 0 ? "Up" : "Down"} ${Math.abs(dpDeltaRaw).toFixed(2)} psi vs baseline`,
    precision: 2,
    suffix: "psi",
    noChangeLabel: "On baseline",
  };

  const previousPoint =
    historicalData.length > 1 ? historicalData[historicalData.length - 2] : null;
  const flowRate = (() => {
    if (!previousPoint) {
      return null;
    }
    const current = safeNumber(currentMetrics.flowRate, 0);
    const previous = safeNumber(previousPoint.flowRate, current);
    const diff = current - previous;
    if (Math.abs(diff) < 0.5) {
      return {
        delta: 0,
        isIncreasePositive: true,
        label: "Stable",
        noChangeLabel: "Stable",
      };
    }
    return {
      delta: diff,
      isIncreasePositive: true,
      label: `${diff > 0 ? "Up" : "Down"} ${Math.abs(diff).toFixed(0)} bbl/d`,
      precision: 0,
      suffix: "bbl/d",
      noChangeLabel: "Stable",
    };
  })();

  const efficiency = (() => {
    const current = safeNumber(currentMetrics.efficiency, 0);
    if (!previousPoint) {
      return {
        delta: current < 85 ? -1 : 0,
        isIncreasePositive: true,
        label: current < 85 ? "Down - Declining" : "Stable",
        noChangeLabel: "Stable",
      };
    }
    const previous = safeNumber(previousPoint.efficiency, current);
    const diff = current - previous;
    if (Math.abs(diff) < 0.1) {
      return {
        delta: 0,
        isIncreasePositive: true,
        label: "Stable",
        noChangeLabel: "Stable",
      };
    }
    return {
      delta: diff,
      isIncreasePositive: true,
      label: diff > 0 ? "Up - Improving" : "Down - Declining",
      precision: 1,
      suffix: "%",
      noChangeLabel: "Stable",
    };
  })();

  const daysSinceClean = safeNumber(trends.daysSinceClean, 0);
  const daysSinceCleanTarget = 21;
  const daysSinceCleanDelta = daysSinceClean - daysSinceCleanTarget;
  const normalizedDaysDelta = Math.abs(daysSinceCleanDelta) < 0.5 ? 0 : daysSinceCleanDelta;
  const daysSinceCleanTrend = {
    delta: normalizedDaysDelta,
    isIncreasePositive: false,
    label:
      normalizedDaysDelta === 0
        ? "On schedule"
        : normalizedDaysDelta > 0
        ? `${Math.abs(daysSinceCleanDelta).toFixed(0)} days overdue`
        : `${Math.abs(daysSinceCleanDelta).toFixed(0)} days ahead`,
    precision: 0,
    suffix: "days",
    noChangeLabel: "On schedule",
  };

  const dpRate = safeNumber(trends.dpRate, 0);
  const dpRateBaseline = 0.45;
  const dpRateDelta = dpRate - dpRateBaseline;
  const normalizedDpRateDelta = Math.abs(dpRateDelta) < 0.02 ? 0 : Number(dpRateDelta.toFixed(2));
  const dpRateTrend = {
    delta: normalizedDpRateDelta,
    isIncreasePositive: false,
    label:
      normalizedDpRateDelta === 0
        ? "On baseline"
        : `${normalizedDpRateDelta > 0 ? "Up" : "Down"} ${Math.abs(dpRateDelta).toFixed(2)} psi/day vs baseline`,
    precision: 2,
    suffix: "psi/day",
    noChangeLabel: "On baseline",
  };

  return {
    differentialPressure,
    flowRate,
    efficiency,
    daysSinceClean: daysSinceCleanTrend,
    dpRate: dpRateTrend,
  };
};

const generateMockStrainerData = (count = 6) => {
  const locations = [
    { unit: "Crude Unit 2a", pump: "Feed Pump P-1051A", position: "Suction" },
    { unit: "Crude Unit 2a", pump: "Feed Pump P-1051B", position: "Suction" },
    { unit: "Crude Unit 2b", pump: "Transfer Pump P-2014", position: "Discharge" },
    { unit: "Vacuum Unit 3", pump: "Overhead Pump P-3022A", position: "Suction" },
    { unit: "Vacuum Unit 3", pump: "Wash Water Pump P-3045", position: "Suction" },
    { unit: "FCC Unit 4", pump: "Slurry Pump P-4101", position: "Suction" },
    { unit: "Hydrocracker 5A", pump: "Recycle Gas Compressor K-5201", position: "Inlet" },
    { unit: "Hydrocracker 5A", pump: "HP Wash Water P-5067", position: "Discharge" },
  ];
  const statusPattern = ["alert", "alert", "warning", "warning", "warning", "normal"];
  return Array.from({ length: count }).map((_, idx) => {
    const loc = locations[idx % locations.length];
    const profile = statusPattern[idx % statusPattern.length];
    const daysSinceClean = Math.floor(Math.random() * 25) + 5;
    const baseDP = 8 + Math.random() * 5;
    const dpIncrease = (daysSinceClean / 30) * (15 + Math.random() * 10);
    let currentDP = baseDP + dpIncrease;
    const designFlowRate = 750 + Math.random() * 300;
    let flowLoss = Math.min(dpIncrease * 2, 60);
    let currentFlowRate = designFlowRate - flowLoss;
    let efficiency = (currentFlowRate / designFlowRate) * 100;
    const probabilityLevel = profile === "alert" ? "High" : profile === "warning" ? "Medium" : "Low";
    const impactLevel =
      profile === "alert"
        ? Math.random() > 0.5 ? "Very High" : "High"
        : profile === "warning"
        ? Math.random() > 0.5 ? "Medium" : "High"
        : Math.random() > 0.5 ? "Very Low" : "Low";
    let status = statusPattern[idx % statusPattern.length] ?? "normal";
    let severity = status === "alert" ? "critical" : status === "warning" ? "warning" : "info";
    if (status === "alert") {
      currentDP = Math.max(currentDP, 27 + Math.random() * 4);
      flowLoss = Math.max(flowLoss, designFlowRate * 0.32);
    } else if (status === "warning") {
      currentDP = Math.max(currentDP, 19 + Math.random() * 3);
      flowLoss = Math.max(flowLoss, designFlowRate * 0.22);
    } else {
      currentDP = Math.min(currentDP, 16 + Math.random() * 2);
      flowLoss = Math.max(flowLoss, designFlowRate * 0.12);
      flowLoss = Math.min(flowLoss, designFlowRate * 0.18);
    }
    flowLoss = Math.min(flowLoss, designFlowRate * 0.45);
    currentFlowRate = Math.max(designFlowRate - flowLoss, designFlowRate * 0.45);
    efficiency = Number(((currentFlowRate / designFlowRate) * 100).toFixed(2));
    const historicalData = Array.from({ length: 30 }, (_, i) => {
      const daysAgo = 29 - i;
      const daysSinceCleanAtPoint = Math.max(0, daysSinceClean - (29 - i));
      const baselineDp = baseDP + (daysSinceCleanAtPoint / 30) * dpIncrease;
      const wiggle = Math.sin(i / 3) * 0.6 + (Math.random() - 0.5) * 0.4;
      const dpAtPoint = baselineDp * (0.85 + Math.random() * 0.3) + wiggle;
      const flowAtPoint = designFlowRate - Math.min(Math.max(dpAtPoint - baseDP, 0), 30) * (1.5 + Math.random() * 0.5);
      return {
        date: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        dp: Number(dpAtPoint.toFixed(2)),
        flowRate: Number(flowAtPoint.toFixed(2)),
        efficiency: Number(((flowAtPoint / designFlowRate) * 100).toFixed(1)),
      };
    });
    const cleaningHistory = Array.from({ length: 3 }, (_, i) => {
      const daysAgo = daysSinceClean + (i + 1) * (28 + Math.random() * 7);
      const dpBeforeClean = 22 + Math.random() * 8;
      const dpAfterClean = 8 + Math.random() * 2;
      return {
        date: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        dpBefore: Number(dpBeforeClean.toFixed(2)),
        dpAfter: Number(dpAfterClean.toFixed(2)),
        downtime: (2 + Math.random() * 4).toFixed(1),
        debrisType: ["Sand/Silt", "Corrosion Products", "Scale", "Polymer Residue"][Math.floor(Math.random() * 4)],
      };
    }).reverse();
    const dpRate = (currentDP - baseDP) / Math.max(daysSinceClean, 1);
    const criticalDP = 30;
    const daysUntilCritical = dpRate > 0 ? Math.max(1, Math.floor((criticalDP - currentDP) / dpRate)) : 999;
    const projectedPlugDate = new Date(Date.now() + daysUntilCritical * 24 * 60 * 60 * 1000);
    const nextScheduledClean = new Date(Date.now() + (35 - daysSinceClean) * 24 * 60 * 60 * 1000);
    const debrisCounter = cleaningHistory.reduce((acc, entry) => {
      acc[entry.debrisType] = (acc[entry.debrisType] || 0) + 1;
      return acc;
    }, {});
    const debrisMix = Object.entries(debrisCounter).map(([type, count]) => ({
      type,
      percent: Number(((count / cleaningHistory.length) * 100).toFixed(1)),
    }));
    const foulingPrediction = {
      daysToCritical: daysUntilCritical,
      foulingRate: Number(dpRate.toFixed(2)),
      projectedPlugDate: projectedPlugDate.toISOString().split("T")[0],
      timelineLabel: `Breach in ${formatTimeRemaining(daysUntilCritical)}`,
      recommendation:
        daysUntilCritical < 5
          ? "Schedule emergency clean"
          : daysUntilCritical < 12
          ? "Advance cleaning window"
          : "Continue monitoring",
    };
    let rootCauseAnalysis = "";
    if (status === "alert") {
      if (currentDP > 25) {
        rootCauseAnalysis = `**Primary Cause: Excessive Particulate Loading**\n\nDifferential pressure has exceeded 25 psi (currently ${currentDP.toFixed(
          2,
        )} psi), indicating severe strainer element fouling. Analysis of pressure trend shows acceleration in the last 5 days, suggesting:\n\n1. **Upstream Process Change**: Possible increase in crude sediment content or corrosion product carryover from storage tanks\n2. **Element Degradation**: Strainer mesh may have partial collapse, reducing effective filtration area by 30-40%\n3. **Flow Rate Impact**: Current flow (${currentFlowRate.toFixed(
          0,
        )} bbl/d) is ${flowLoss.toFixed(0)} bbl/d below design, affecting downstream unit performance\n\n**Recommended Actions:**\n- Immediate cleaning required to prevent pump cavitation\n- Inspect element for damage during maintenance\n- Sample debris for crude quality analysis\n- Consider temporary bypass if pump suction pressure approaches NPSH limit`;
      } else {
        rootCauseAnalysis = `**Primary Cause: Efficiency Loss Due to Flow Restriction**\n\nStrainer efficiency has dropped to ${efficiency.toFixed(
          1,
        )}%, below the 70% critical threshold. Root cause analysis indicates:\n\n1. **Pressure Drop Correlation**: DP of ${currentDP.toFixed(2)} psi is causing significant flow restriction\n2. **Pump Performance Impact**: Feed pump operating ${((flowLoss / designFlowRate) * 100).toFixed(
          1,
        )}% below design point, risking off-curve operation\n3. **Debris Accumulation Pattern**: Historical data suggests ${cleaningHistory[0].debrisType.toLowerCase()} is the primary contaminant\n\n**Recommended Actions:**\n- Schedule cleaning within 48 hours\n- Verify upstream filtration/separation equipment performance\n- Review crude slate changes in last 2 weeks\n- Consider element mesh size optimization`;
      }
    } else if (status === "warning") {
      rootCauseAnalysis = `**Condition: Elevated Pressure Differential - Monitoring Required**\n\nStrainer showing early signs of fouling with DP at ${currentDP.toFixed(
        2,
      )} psi and efficiency at ${efficiency.toFixed(1)}%. Predictive model analysis:\n\n1. **Fouling Rate**: Current DP increase rate is ${dpRate.toFixed(3)} psi/day, ${dpRate > 0.6 ? "above" : "within"} normal baseline (0.3-0.5 psi/day)\n2. **Time Projection**: At current fouling rate, strainer will reach critical DP in ${daysUntilCritical} days (${projectedPlugDate.toLocaleDateString()})\n3. **Comparison to Fleet**: This unit is fouling ${dpRate > 0.6 ? "faster" : "slower"} than fleet average, suggesting ${dpRate > 0.6 ? "localized crude quality issue or upstream process upset" : "normal wear pattern"}\n\n**Recommended Actions:**\n- Continue monitoring; plan maintenance for next scheduled turnaround\n- Track daily DP trends for acceleration\n- Coordinate cleaning with next scheduled clean (${nextScheduledClean.toLocaleDateString()})\n- No immediate intervention required`;
    } else {
      rootCauseAnalysis = `**Status: Normal Operation**\n\nStrainer operating within design parameters. Current metrics indicate healthy performance:\n\n1. **Pressure Profile**: DP of ${currentDP.toFixed(2)} psi is well below warning threshold (18 psi)\n2. **Flow Performance**: Efficiency at ${efficiency.toFixed(
        1,
      )}% indicates minimal fouling impact\n3. **Maintenance Timing**: Last cleaned ${daysSinceClean} days ago; next scheduled cleaning in ${35 - daysSinceClean} days\n4. **Predictive Outlook**: At current fouling rate (${dpRate.toFixed(
        3,
      )} psi/day), strainer will operate safely for ${daysUntilCritical}+ days\n\n**Recommended Actions:**\n- Maintain current monitoring schedule\n- Continue routine inspections\n- No immediate action required`;
    }
    const supplierInfo = {
      elementSupplier: randomChoice(["FilterCorp", "StrainerPro", "FlowGuard Inc."]),
      meshSize: randomChoice([100, 150, 200]),
      material: randomChoice(["316 SS", "Monel", "Duplex SS"]),
      lastInspectionDate: new Date(Date.now() - (365 + Math.random() * 100) * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      meanTimeToFailure: `${(8 + Math.random() * 4).toFixed(1)} months`,
    };
    const riskAnalysis = {
      probability: probabilityLevel,
      impact: impactLevel,
      riskScore: status === "alert" ? 85 : status === "warning" ? 60 : 20,
      mitigationActions:
        status === "alert"
          ? [
              "Initiate immediate bypass and cleaning",
              "Inspect for element damage",
              "Analyze upstream crude slate for contaminants",
            ]
          : status === "warning"
          ? [
              "Increase monitoring frequency to 4-hourly",
              "Schedule cleaning in next 72 hours",
              "Prepare spare parts for replacement",
            ]
          : ["Continue routine monitoring", "Follow standard maintenance plan"],
    };
    const causalityAnalysis = {
      problemStatement: `High DP (${currentDP.toFixed(2)} psi) on strainer STR-${101 + idx}`,
      fiveWhys: [
        {
          why: "Why is the differential pressure high?",
          because: "The strainer element is clogged with debris.",
        },
        {
          why: "Why is the element clogged?",
          because: `Increased carryover of ${cleaningHistory[0].debrisType.toLowerCase()} from upstream.`,
        },
        {
          why: `Why is there increased ${cleaningHistory[0].debrisType.toLowerCase()} carryover?`,
          because: "Upstream desalter unit efficiency has dropped by 5% in the last week.",
        },
        {
          why: "Why has desalter efficiency dropped?",
          because: "Emulsion layer control has been erratic.",
        },
        {
          why: "Why is emulsion control erratic?",
          because: "Interface level transmitter (LT-101) is showing noisy readings and requires calibration.",
        },
      ],
    };
     const installationDate = new Date(Date.now() - (3 + Math.random() * 5) * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const lifecycleInfo = {
        installationDate,
        lastOverhaulDate: new Date(new Date(installationDate).getTime() + (2 + Math.random()) * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        endOfLifeDate: new Date(new Date(installationDate).getTime() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    };
    const strainer = {
      id: `STR-${101 + idx}`,
      location: loc,
      status,
      severity,
      isReal: false,
      currentMetrics: {
        differentialPressure: Number(currentDP.toFixed(2)),
        flowRate: Number(currentFlowRate.toFixed(2)),
        efficiency: Number(efficiency.toFixed(2)),
        designFlowRate: Number(designFlowRate.toFixed(0)),
      },
      trends: {
        daysSinceClean,
        nextCleanDue: nextScheduledClean.toISOString().split("T")[0],
        projectedPlugDate: projectedPlugDate.toISOString().split("T")[0],
        daysUntilCritical,
        dpRate: Number(dpRate.toFixed(3)),
        baselineDP: Number(baseDP.toFixed(2)),
      },
      historicalData,
      cleaningHistory,
      alertDetails: {
        severity,
        message:
          status === "alert"
            ? "Critical: DP exceeds threshold - immediate action required"
            : status === "warning"
            ? "Warning: DP increasing faster than baseline - schedule maintenance"
            : "Operating normally",
        acknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
      },
      rootCauseAnalysis,
      supplierInfo,
      riskAnalysis,
      causalityAnalysis,
      lifecycleInfo,
      predictions: foulingPrediction,
      debrisMix,
    };
    return {
      ...strainer,
      metricTrends: deriveMetricTrendsForStrainer(strainer),
    };
  });
};
const COMPRESSOR_LOCATIONS = [
  { facility: "Residue Compression", train: "Train K-401A", service: "Residue Gas" },
  { facility: "Residue Compression", train: "Train K-401B", service: "Residue Gas" },
  { facility: "Wet Gas Compression", train: "Train K-233", service: "Wet Gas" },
  { facility: "Gas Lift Compression", train: "Train K-612", service: "Gas Lift" },
  { facility: "Export Compression", train: "Train K-710", service: "Export" },
  { facility: "Fuel Gas Compression", train: "Train K-120", service: "Fuel Gas" },
  { facility: "Sales Gas Compression", train: "Train K-905", service: "Sales Gas" },
];
const generateMockCompressorData = (count = 6) => {
  const replacements = [
    ...buildAssetLanguageReplacements("Compressor", "Compressors"),
    { pattern: /\bcleaning\b/gi, replacement: "service" },
    { pattern: /\bclean\b/gi, replacement: "service" },
    { pattern: /\belement\b/gi, replacement: "cartridge" },
    { pattern: /\bmesh\b/gi, replacement: "impeller" },
  ];
  const baseFleet = generateMockStrainerData(count);
  return baseFleet.map((asset, idx) => {
    const location = COMPRESSOR_LOCATIONS[idx % COMPRESSOR_LOCATIONS.length];
    const adapted = replaceAssetLanguage(asset, replacements);
    const compressorStatus = adapted.status ?? "normal";
    const dischargePressure = 420 + Math.random() * 90;
    const throughput = 60 + Math.random() * 35;
    const designThroughput = throughput * (1 + Math.random() * 0.25);
    const efficiency = 70 + Math.random() * 20;
    const hoursSinceService = Math.floor(Math.random() * 480) + 72;
    const vibrationTrend = Array.from({ length: 30 }, (_, i) => {
      const daysAgo = 29 - i;
      const vibration = 2 + Math.random() * (compressorStatus === "alert" ? 4 : compressorStatus === "warning" ? 3 : 1.5);
      return {
        date: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        dischargePsi: Number((dischargePressure + Math.sin(i / 5) * 8).toFixed(1)),
        vibrationIps: Number(vibration.toFixed(2)),
      };
    });
    const bearingHealth = ["Thrust", "Journal", "Balance Piston"].map((name) => ({
      name: `${name} Bearing`,
      status: randomChoice(["Normal", "Watch", "Alert"]),
      trend: Number((Math.random() * 1.5 - 0.5).toFixed(2)),
    }));
    const serviceTimeline = Array.from({ length: 3 }, (_, i) => {
      const daysAgo = (i + 1) * 120;
      return {
        date: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        scope: randomChoice(["Bundle pull", "Seal replacement", "Rotor balance"]),
        downtime: `${(18 + Math.random() * 12).toFixed(1)} hrs`,
        riskIfSkipped: randomChoice(["Medium", "High"]),
      };
    });
    const predictions = {
      tripProbability72h: Number((0.05 + Math.random() * 0.25).toFixed(2)),
      energyPenalty: Number(((100 - efficiency) * 0.15).toFixed(1)),
      serviceDueDays: Math.max(2, 30 - Math.round(hoursSinceService / 12)),
    };
    const performanceEnvelope = {
      mtbsDays: Math.floor(18 + Math.random() * 20),
      surgeMargin: Number((5 + Math.random() * 6).toFixed(1)),
      loadLine: Number((72 + Math.random() * 18).toFixed(1)),
      throughputUtilization: Number(((throughput / designThroughput) * 100).toFixed(0)),
      vibrationSeverityIndex: Number((1.5 + Math.random() * (compressorStatus === "alert" ? 2.5 : 1.5)).toFixed(1)),
      efficiencyDrift: Number((Math.max(0, 88 - efficiency) * 0.25).toFixed(1)),
    };
    const bearingSparklines = bearingHealth.map((item) => ({
      name: item.name,
      samples: Array.from({ length: 12 }, () => Number((1 + Math.random() * (compressorStatus === "alert" ? 1.5 : 1)).toFixed(2))),
    }));
    const lubeOilTemps = ["Thrust Loop", "Balance Loop", "Seal Oil"].map((loop) => ({
      loop,
      value: Number((130 + Math.random() * 18).toFixed(1)),
      limit: 150,
    }));
    const orbitSnapshots = ["NDE", "DE", "Thrust"].map((stage) => ({
      stage,
      major: Number((6 + Math.random() * 2.5).toFixed(1)),
      minor: Number((3 + Math.random() * 1.5).toFixed(1)),
      orientation: randomChoice(["Horizontal", "Vertical"]),
    }));
    const conditionMonitoring = {
      bearingSparklines,
      lubeOilTemps,
      startReliability: Number((0.88 + Math.random() * 0.09).toFixed(2)),
      orbitSnapshots,
      vibrationBand: {
        safe: 2.2,
        warning: 3.5,
        current: vibrationTrend[vibrationTrend.length - 1]?.vibrationIps ?? 0,
      },
    };
    return {
      ...adapted,
      id: `COMP-${610 + idx}`,
      assetCategory: "Compressor",
      location: {
        unit: location.facility,
        pump: location.train,
        position: `${location.service} Service`,
      },
      currentMetrics: {
        ...adapted.currentMetrics,
        differentialPressure: Number(dischargePressure.toFixed(1)),
        flowRate: Number(throughput.toFixed(1)),
        efficiency: Number(efficiency.toFixed(1)),
        designFlowRate: Number(designThroughput.toFixed(1)),
      },
      trends: {
        ...adapted.trends,
        daysSinceClean: Math.max(3, Math.round(hoursSinceService / 24)),
        dpRate: Number(((dischargePressure - 400) / Math.max(hoursSinceService, 1)).toFixed(3)),
        baselineDP: Number((dischargePressure - 35).toFixed(1)),
      },
      vibrationTrend,
      bearingHealth,
      serviceTimeline,
      predictions,
      performanceEnvelope,
      conditionMonitoring,
      maintenanceLog: serviceTimeline,
    };
  });
};
const PIPELINE_LOCATIONS = [
  { corridor: "Export Loop A", station: "Block Valve BV-401", section: "North Span" },
  { corridor: "Export Loop A", station: "Pump Station PS-2", section: "Desert Crossing" },
  { corridor: "Products Trunk B", station: "Metering Skid MS-7", section: "Coastal Reach" },
  { corridor: "Gathering Spine C", station: "Launcher Station LS-3", section: "Mountain Pass" },
  { corridor: "Jet Fuel Spur D", station: "Block Valve BV-812", section: "Terminal Approach" },
  { corridor: "Arab Light Loop E", station: "Pump Station PS-9", section: "Plateau Span" },
  { corridor: "Gas Condensate Spur F", station: "Metering Skid MS-11", section: "Marsh Crossing" },
];
const generateMockPipelineData = (count = 6) => {
  const replacements = [
    ...buildAssetLanguageReplacements("Pipeline Segment", "Pipeline Segments"),
    { pattern: /\belement\b/gi, replacement: "segment" },
    { pattern: /\bmesh\b/gi, replacement: "wall thickness" },
    { pattern: /\bcleaning\b/gi, replacement: "pigging" },
    { pattern: /\bclean\b/gi, replacement: "pigging" },
  ];
  const baseFleet = generateMockStrainerData(count);
  return baseFleet.map((asset, idx) => {
    const location = PIPELINE_LOCATIONS[idx % PIPELINE_LOCATIONS.length];
    const pressureDrop = 38 + Math.random() * 18;
    const throughput = 240 + Math.random() * 80;
    const designThroughput = throughput * (1 + Math.random() * 0.2);
    const integrity = 80 + Math.random() * 15;
    const daysSincePig = Math.floor(Math.random() * 45) + 5;
    const segmentProfiles = Array.from({ length: 5 }, (_, segIdx) => ({
      segment: `KP ${segIdx * 12}-${segIdx * 12 + 12}`,
      gradient: Number((pressureDrop / 5 + (Math.random() - 0.5) * 3).toFixed(1)),
      status: randomChoice(["Normal", "Watch", "Alert"]),
      pressureDrop: Number((pressureDrop * (0.8 + Math.random() * 0.4)).toFixed(1)),
    }));
    const corrosionForecast = Array.from({ length: 5 }, (_, yearIdx) => ({
      year: new Date().getFullYear() + yearIdx,
      depth: Number((0.08 + Math.random() * 0.12 + yearIdx * 0.03).toFixed(2)),
    }));
    const pigSchedule = Array.from({ length: 3 }, (_, i) => ({
      run: `PIG-${idx}-${i + 1}`,
      date: new Date(Date.now() + (i + 1) * 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      type: randomChoice(["Cleaning", "MFL ILI", "Caliper"]),
      readiness: randomChoice(["Ready", "Needs Prep"]),
    }));
    const leakTimelineDays = Math.max(2, 45 - daysSincePig + Math.random() * 5);
    const leakRisk = {
      probability: Number((0.01 + Math.random() * 0.08).toFixed(2)),
      detectionConfidence: randomChoice(["High", "Medium"]),
      timelineDays: leakTimelineDays,
      recommendation:
        integrity < 85 ? "Increase patrol frequency" : daysSincePig > 30 ? "Advance pig run" : "Normal monitoring",
    };
    const stationLabels = ["Inlet", "PS-1", "BV-2", "PS-3", "Terminal"];
    const pressureProfile = stationLabels.map((station, stationIdx) => ({
      station,
      pressure: Number((pressureDrop + 60 - stationIdx * (pressureDrop / stationLabels.length) + (Math.random() - 0.5) * 4).toFixed(1)),
      temperature: Number((42 + Math.random() * 8).toFixed(1)),
    }));
    const flowAssurance = {
      hydrateRisk: randomChoice(["Low", "Medium", "High"]),
      waxRisk: randomChoice(["Low", "Medium", "High"]),
      linePackUtilization: Number((65 + Math.random() * 25).toFixed(0)),
      pigTimeline: pigSchedule,
    };
    const iliFindings = segmentProfiles.map((segment) => ({
      segment: segment.segment,
      anomaly: randomChoice(["Metal loss", "Dent", "Ovality"]),
      severity: randomChoice(["Low", "Medium", "High"]),
    }));
    const integrityHighlights = {
      corrosionAllowanceLeft: Number((0.18 + Math.random() * 0.22).toFixed(2)),
      burstPressureMargin: Number((6 + Math.random() * 10).toFixed(1)),
      inlineInspection: iliFindings,
      corrosionGrowth: corrosionForecast,
    };
    const valveStatus = ["Launcher", "Mid-line", "Receiver"].map((name) => ({
      name: `${name} Valve`,
      status: randomChoice(["Open", "Closed", "Maintenance"]),
    }));
    const operationsSnapshot = {
      valveStatus,
      pumpAvailability: Number((0.84 + Math.random() * 0.1).toFixed(2)),
      leakDetectionScore: Number((0.7 + Math.random() * 0.2).toFixed(2)),
      maopRisk: Number((0.01 + Math.random() * 0.06).toFixed(2)),
    };
    return {
      ...replaceAssetLanguage(asset, replacements),
      id: `PIPE-${420 + idx}`,
      assetCategory: "Pipeline",
      location: {
        unit: location.corridor,
        pump: location.station,
        position: location.section,
      },
      currentMetrics: {
        ...asset.currentMetrics,
        differentialPressure: Number(pressureDrop.toFixed(1)),
        flowRate: Number(throughput.toFixed(1)),
        efficiency: Number(integrity.toFixed(1)),
        designFlowRate: Number(designThroughput.toFixed(1)),
      },
      trends: {
        ...asset.trends,
        daysSinceClean: daysSincePig,
        dpRate: Number(((pressureDrop - 30) / Math.max(daysSincePig, 1)).toFixed(3)),
        baselineDP: Number((pressureDrop - 6).toFixed(1)),
      },
      segmentProfiles,
      corrosionForecast,
      pigSchedule,
      pressureProfile,
      flowAssurance,
      integrityHighlights,
      operationsSnapshot,
      leakRisk,
      predictions: {
        pigDueDays: Math.max(3, 35 - daysSincePig),
        leakTimelineDays,
        leakDetectionScore: operationsSnapshot.leakDetectionScore,
        maopRisk: operationsSnapshot.maopRisk,
      },
    };
  });
};
const createRealStrainer = (kpis = [], explanation, meta) => {
  if (!Array.isArray(kpis) || kpis.length === 0) {
    return null;
  }
  const DAY_MS = 24 * 60 * 60 * 1000;
  const sortedPoints = [...kpis]
    .map((point) => {
      const tsDate = new Date(point.ts || Date.now());
      return {
        ...point,
        tsDate,
        dpPsi: psiFromMbar(point.dp_excess_mbar ?? 400),
      };
    })
    .sort((a, b) => a.tsDate - b.tsDate);
  const latest = sortedPoints[sortedPoints.length - 1];
  const reference = sortedPoints[Math.max(0, sortedPoints.length - 3)];
  const windowDays = Math.max(1, Math.round((latest.tsDate - reference.tsDate) / DAY_MS));
  const dpRateRaw = (latest.dpPsi - reference.dpPsi) / windowDays;
  const smoothedDpRate = Number(dpRateRaw.toFixed(3));
  const positiveDpRate = smoothedDpRate > 0.01 ? smoothedDpRate : 0.12;
  const designFlowRate = 980;
  const flowRate = clamp(designFlowRate - latest.dpPsi * 13, designFlowRate * 0.4, designFlowRate * 0.98);
  const efficiency = clamp((flowRate / designFlowRate) * 100, 30, 99);
  const lastCleanDate = meta?.last_clean_date ? new Date(meta.last_clean_date) : null;
  const daysSinceClean = lastCleanDate
    ? Math.max(1, Math.round((Date.now() - lastCleanDate.getTime()) / DAY_MS))
    : 14;
  const nextCleanDueDate = lastCleanDate
    ? new Date(lastCleanDate.getTime() + 35 * DAY_MS)
    : new Date(Date.now() + 14 * DAY_MS);
  const criticalDp = 30;
  const daysUntilCritical = Math.max(1, Math.round((criticalDp - latest.dpPsi) / positiveDpRate));
  const projectedPlugDate = new Date(Date.now() + daysUntilCritical * DAY_MS);
  const probabilityLevel = probabilityLevelFromValue(latest.prob_breach7d ?? latest.prob_breach7d_raw ?? 0.52);
  const impactLevel = impactLevelFromSignal(latest.risk_band ?? "medium", latest.dpPsi);
  const status = latest.risk_band === "high" ? "alert" : latest.risk_band === "medium" ? "warning" : "normal";
  const severity = status === "alert" ? "critical" : status === "warning" ? "warning" : "info";
  const isoDate = (date) => {
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? new Date().toISOString().split("T")[0] : d.toISOString().split("T")[0];
  };
  const historicalData = sortedPoints.map((point) => {
    const flowAtPoint = clamp(designFlowRate - point.dpPsi * 12, designFlowRate * 0.4, designFlowRate);
    const efficiencyAtPoint = clamp((flowAtPoint / designFlowRate) * 100, 30, 99);
    return {
      date: isoDate(point.tsDate),
      dp: Number(point.dpPsi.toFixed(2)),
      flowRate: Number(flowAtPoint.toFixed(0)),
      efficiency: Number(efficiencyAtPoint.toFixed(1)),
    };
  });
  while (historicalData.length < 30) {
    const first = historicalData[0];
    const seedDate = first ? new Date(first.date) : new Date();
    seedDate.setDate(seedDate.getDate() - 1);
    const priorDp = clamp((first?.dp ?? latest.dpPsi) - 0.25, 10, 28);
    const flowAtPoint = clamp(designFlowRate - priorDp * 12, designFlowRate * 0.4, designFlowRate);
    const efficiencyAtPoint = clamp((flowAtPoint / designFlowRate) * 100, 30, 99);
    historicalData.unshift({
      date: isoDate(seedDate),
      dp: Number(priorDp.toFixed(2)),
      flowRate: Number(flowAtPoint.toFixed(0)),
      efficiency: Number(efficiencyAtPoint.toFixed(1)),
    });
  }
  const cleaningHistory = Array.from({ length: 3 }).map((_, idx) => {
    const daysAgo = daysSinceClean + idx * 32;
    return {
      date: isoDate(new Date(Date.now() - daysAgo * DAY_MS)),
      dpBefore: Number(Math.max(latest.dpPsi - idx * 0.6, 16).toFixed(1)),
      dpAfter: Number(Math.max(latest.dpPsi - 6 - idx * 0.3, 7).toFixed(1)),
      downtime: (2.6 + idx * 0.4).toFixed(1),
      debrisType: ["Sand/Silt", "Corrosion Products", "Scale"][idx % 3],
    };
  });
  const debrisMix = Object.entries(
    cleaningHistory.reduce((acc, event) => {
      acc[event.debrisType] = (acc[event.debrisType] || 0) + 1;
      return acc;
    }, {}),
  ).map(([type, count]) => ({
    type,
    percent: Number(((count / cleaningHistory.length) * 100).toFixed(1)),
  }));
  const predictions = {
    daysToCritical: daysUntilCritical,
    foulingRate: Number(positiveDpRate.toFixed(2)),
    projectedPlugDate: isoDate(projectedPlugDate),
    timelineLabel: `Breach in ${formatTimeRemaining(daysUntilCritical)}`,
    recommendation:
      daysUntilCritical < 5
        ? "Schedule emergency clean"
        : daysUntilCritical < 12
        ? "Advance cleaning window"
        : "Continue monitoring",
  };
  const rootCauseAnalysis = buildRootCauseAnalysis(
    explanation,
    latest,
    latest.dpPsi,
    flowRate,
    efficiency,
    daysSinceClean,
  );
  const causalityAnalysis = {
    problemStatement: `Live strainer ${latest.id || "STR-REAL"} DP trending ${status}`,
    fiveWhys: buildFiveWhys(explanation),
  };
  const lifecycleInfo = {
    installationDate: isoDate(new Date(Date.now() - 3 * 365 * DAY_MS)),
    lastOverhaulDate: isoDate(new Date(Date.now() - 14 * 30 * DAY_MS)),
    endOfLifeDate: isoDate(new Date(Date.now() + 7 * 365 * DAY_MS)),
  };
  const supplierInfo = {
    elementSupplier: "FilterCorp Live",
    meshSize: 150,
    material: "316 SS",
    lastInspectionDate: isoDate(lastCleanDate || new Date(Date.now() - 45 * DAY_MS)),
    meanTimeToFailure: "9.0 months",
  };
  const riskAnalysis = {
    probability: probabilityLevel,
    impact: impactLevel,
    riskScore: riskScoreFromLevels(probabilityLevel, impactLevel),
    mitigationActions: explanation?.actions ?? [],
  };
  const strainer = {
    id: latest.id || "STR-REAL",
    location: {
      unit: "Crude Unit 2A • Live Feed",
      pump: "Feed Pump P-1051A",
      position: "Suction",
    },
    status,
    severity,
    isReal: true,
    currentMetrics: {
      differentialPressure: Number(latest.dpPsi.toFixed(2)),
      flowRate: Number(flowRate.toFixed(0)),
      efficiency: Number(efficiency.toFixed(1)),
      designFlowRate,
    },
    trends: {
      daysSinceClean,
      nextCleanDue: isoDate(nextCleanDueDate),
      projectedPlugDate: isoDate(projectedPlugDate),
      daysUntilCritical,
      dpRate: smoothedDpRate,
      baselineDP: Number(Math.max(sortedPoints[0]?.dpPsi ?? latest.dpPsi - 2, 10).toFixed(2)),
    },
    historicalData,
    cleaningHistory,
    alertDetails: {
      severity,
      message:
        status === "alert"
          ? "Live feed indicates DP above safe band"
          : status === "warning"
          ? "DP rising faster than baseline"
          : "Operating normally",
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null,
    },
    rootCauseAnalysis,
    supplierInfo,
    riskAnalysis,
    causalityAnalysis,
    lifecycleInfo,
    predictions,
    debrisMix,
  };
  return {
    ...strainer,
    metricTrends: deriveMetricTrendsForStrainer(strainer),
  };
};
const ASSET_CONFIGS = {
  strainers: {
    key: "strainers",
    navLabel: "Strainers",
    label: "Strainer",
    pluralLabel: "Strainers",
    heroTitle: "Strainer Monitoring Command",
    heroTagline: "Refinery-wide strainer performance dashboard",
    heroBadge: "Live Feed",
    icon: Filter,
    fleetTitle: "Strainer Fleet",
    searchPlaceholder: "Search by ID, unit, pump...",
    emptyStateTitle: "No Strainers Found",
    emptyStateSubtitle: "Try adjusting search or filters.",
    listChipLabel: "Strainers",
    cardLabels: { dp: "DP", flow: "Flow", efficiency: "Efficiency", since: "Since clean", sinceSuffix: "d" },
    cardUnits: { dp: "psi", flow: "bbl/d", efficiency: "%", since: "d" },
    detailMetricLabels: {
      dp: "Differential Pressure",
      flow: "Flow Rate",
      efficiency: "Efficiency",
      daysSinceClean: "Days Since Clean",
      dpRate: "DP Rate",
      designFlow: "Design Flow",
    },
    detailMetricUnits: {
      dp: "psi",
      flow: "bbl/d",
      efficiency: "%",
      daysSinceClean: "days",
      dpRate: "psi/day",
      designFlow: "bbl/d",
    },
    chartLabels: {
      dpTrendTitle: "DP Trend (Last 30 Days)",
      dpAxis: "DP (psi)",
      tooltipDp: "DP",
      tooltipFlow: "Flow",
      tooltipEfficiency: "Efficiency",
    },
    maintenanceHistory: {
      title: "Cleaning History",
      beforeLabel: "DP Before",
      afterLabel: "DP After",
      descriptorLabel: "Debris Type",
      beforeUnit: "psi",
      afterUnit: "psi",
    },
    generateMockData: (count = 6) => generateMockStrainerData(count),
  },
  compressors: {
    key: "compressors",
    navLabel: "Compressors",
    label: "Compressor",
    pluralLabel: "Compressors",
    heroTitle: "Compression Reliability Command",
    heroTagline: "Residue, wet gas, and gas-lift compressors health dashboard",
    heroBadge: "Assets",
    icon: Gauge,
    fleetTitle: "Compressor Fleet",
    searchPlaceholder: "Search by train, unit, compressor...",
    emptyStateTitle: "No Compressors Found",
    emptyStateSubtitle: "Try refining status or facility filters.",
    listChipLabel: "Compressors",
    cardLabels: {
      dp: "Disch. Pressure",
      flow: "Throughput",
      efficiency: "Polytropic Eff.",
      since: "Since service",
      sinceSuffix: "d",
    },
    cardUnits: { dp: "psi", flow: "MMSCFD", efficiency: "%", since: "d" },
    detailMetricLabels: {
      dp: "Discharge Pressure",
      flow: "Throughput",
      efficiency: "Polytropic Efficiency",
      daysSinceClean: "Days Since Service",
      dpRate: "Pressure Drift",
      designFlow: "Design Throughput",
    },
    detailMetricUnits: {
      dp: "psi",
      flow: "MMSCFD",
      efficiency: "%",
      daysSinceClean: "days",
      dpRate: "psi/day",
      designFlow: "MMSCFD",
    },
    chartLabels: {
      dpTrendTitle: "Discharge Pressure Trend (30 Days)",
      dpAxis: "Pressure (psi)",
      tooltipDp: "Disch. Pressure",
      tooltipFlow: "Throughput",
      tooltipEfficiency: "Poly. Eff.",
    },
    maintenanceHistory: {
      title: "Service History",
      beforeLabel: "Pressure Before",
      afterLabel: "Pressure After",
      descriptorLabel: "Scope",
      beforeUnit: "psi",
      afterUnit: "psi",
    },
    generateMockData: generateMockCompressorData,
  },
  pipelines: {
    key: "pipelines",
    navLabel: "Pipelines",
    label: "Pipeline Segment",
    pluralLabel: "Pipeline Segments",
    heroTitle: "Pipeline Integrity Command",
    heroTagline: "Transmission, gathering, and export line health dashboard",
    heroBadge: "Assets",
    icon: Droplets,
    fleetTitle: "Pipeline Fleet",
    searchPlaceholder: "Search by corridor, station, ID...",
    emptyStateTitle: "No Pipelines Found",
    emptyStateSubtitle: "Adjust corridor or status filters.",
    listChipLabel: "Pipelines",
    cardLabels: {
      dp: "Pressure Drop",
      flow: "Throughput",
      efficiency: "Integrity",
      since: "Since pigging",
      sinceSuffix: "d",
    },
    cardUnits: { dp: "psi", flow: "kbpd", efficiency: "%", since: "d" },
    detailMetricLabels: {
      dp: "Pressure Drop",
      flow: "Throughput",
      efficiency: "Integrity",
      daysSinceClean: "Days Since Pigging",
      dpRate: "Drop Rate",
      designFlow: "Design Capacity",
    },
    detailMetricUnits: {
      dp: "psi",
      flow: "kbpd",
      efficiency: "%",
      daysSinceClean: "days",
      dpRate: "psi/day",
      designFlow: "kbpd",
    },
    chartLabels: {
      dpTrendTitle: "Pressure Drop Trend (30 Days)",
      dpAxis: "Drop (psi)",
      tooltipDp: "Drop",
      tooltipFlow: "Flow",
      tooltipEfficiency: "Integrity",
    },
    maintenanceHistory: {
      title: "Inspection History",
      beforeLabel: "Pressure Before",
      afterLabel: "Pressure After",
      descriptorLabel: "Tool Pass",
      beforeUnit: "psi",
      afterUnit: "psi",
    },
    generateMockData: generateMockPipelineData,
  },
};
const ASSET_ORDER = Object.keys(ASSET_CONFIGS);
const RiskMatrix = ({ fleet = [], selected, assetLabel = "Asset", assetLabelPlural = "Assets" }) => {
  const probabilityLevels = ["Very Low", "Low", "Medium", "High", "Very High"];
  const impactLevels = ["Very High", "High", "Medium", "Low", "Very Low"]; // top to bottom
  const matrix = impactLevels.map(() => probabilityLevels.map(() => 0));

  const normalizeLevel = (value) => toTitleLevel(value);

  const selectedImpact = normalizeLevel(selected?.riskAnalysis?.impact);
  const selectedProbability = normalizeLevel(selected?.riskAnalysis?.probability);
  const selectedKey = `${selectedImpact}-${selectedProbability}`;

  fleet.forEach((item) => {
    const impact = normalizeLevel(item?.riskAnalysis?.impact);
    const probability = normalizeLevel(item?.riskAnalysis?.probability);
    const row = impactLevels.indexOf(impact);
    const col = probabilityLevels.indexOf(probability);
    if (row === -1 || col === -1) return;
    matrix[row][col] += 1;
  });

  const gradientMatrix = [
    ["from-emerald-600 to-emerald-500", "from-emerald-500 to-amber-400", "from-amber-500 to-orange-500", "from-red-500 to-rose-500", "from-rose-600 to-rose-700"],
    ["from-emerald-500 to-emerald-400", "from-emerald-400 to-amber-400", "from-amber-500 to-orange-500", "from-red-500 to-rose-500", "from-rose-600 to-rose-700"],
    ["from-emerald-500 to-emerald-400", "from-lime-500 to-emerald-500", "from-amber-400 to-orange-500", "from-orange-500 to-red-500", "from-red-600 to-rose-600"],
    ["from-emerald-500 to-emerald-500", "from-emerald-500 to-emerald-400", "from-lime-500 to-emerald-500", "from-amber-400 to-orange-500", "from-orange-500 to-red-500"],
    ["from-emerald-700 to-emerald-600", "from-emerald-600 to-emerald-500", "from-emerald-500 to-emerald-400", "from-emerald-400 to-emerald-300", "from-emerald-400 to-emerald-300"],
  ];
  const borderMatrix = [
    ["border-emerald-400/60", "border-amber-400/70", "border-amber-500/70", "border-rose-500/70", "border-rose-600/70"],
    ["border-emerald-400/60", "border-amber-400/60", "border-amber-500/70", "border-rose-500/70", "border-rose-600/70"],
    ["border-emerald-400/60", "border-emerald-400/60", "border-amber-400/60", "border-orange-500/70", "border-rose-500/70"],
    ["border-emerald-500/60", "border-emerald-400/60", "border-emerald-400/60", "border-amber-400/60", "border-orange-500/70"],
    ["border-emerald-600/70", "border-emerald-500/60", "border-emerald-400/60", "border-emerald-300/60", "border-emerald-300/60"],
  ];

  const formatLabel = (value) => value.replace(/\b\w/g, (char) => char.toUpperCase());
  return (
    <div className="flex w-full justify-center">
      <div className={`w-full max-w-3xl ${GLASS_CARD} p-6`}>
        <div className="flex items-center gap-3 text-lg font-semibold text-neutral-100">
          <div className={`${ACCENT_GRADIENT} h-9 w-9 rounded-2xl`} />
          <span>Fleet Risk Matrix</span>
        </div>
        <div className="mt-4 grid grid-cols-[auto,repeat(5,minmax(70px,1fr))] gap-2">
          <div className="pr-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Impact</div>
          {probabilityLevels.map((prob) => (
            <div key={`prob-header-${prob}`} className="text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {prob}
            </div>
          ))}
          {impactLevels.map((impact, rowIndex) => (
            <React.Fragment key={`impact-row-${impact}`}>
              <div className="flex items-center justify-end pr-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {impact}
              </div>
              {probabilityLevels.map((prob, colIndex) => {
                const count = matrix[rowIndex][colIndex];
                const gradient = gradientMatrix[rowIndex][colIndex];
                const border = borderMatrix[rowIndex][colIndex];
                const isSelected = `${impact}-${prob}` === selectedKey;
                return (
                  <div key={`cell-${impact}-${prob}`} className="aspect-square w-full">
                    <div
                      className={`flex h-full w-full flex-col items-center justify-center rounded-xl border bg-gradient-to-br ${gradient} ${border} text-white shadow-inner transition-transform duration-200 ${
                        isSelected ? "ring-2 ring-white/80 ring-offset-2 ring-offset-slate-950 scale-[1.02]" : ""
                      }`}
                      title={`${count} ${count === 1 ? assetLabel : assetLabelPlural} in ${formatLabel(impact)} impact / ${formatLabel(prob)} probability`}
                    >
                      <div className="text-lg font-bold">{count}</div>
                      <div className="text-[10px] uppercase tracking-wide text-white/80">
                        {count === 1 ? assetLabel : assetLabelPlural}
                      </div>
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-wide text-gray-400">
          <span>Impact (Up)</span>
          <span className="text-right">Probability (Right)</span>
        </div>
      </div>
    </div>
  );
};
const StrainerCard = ({ strainer, onSelect, isSelected, assetConfig }) => {
  const statusGlows = {
    alert: "ring-rose-500/50 shadow-[0_0_35px_rgba(244,63,94,0.35)]",
    warning: "ring-amber-400/50 shadow-[0_0_35px_rgba(245,158,11,0.35)]",
    normal: "ring-emerald-400/40 shadow-[0_0_35px_rgba(16,185,129,0.35)]",
  };
  const badgeGradients = {
    alert: "from-rose-500 via-orange-500 to-amber-400",
    warning: "from-amber-400 via-yellow-400 to-emerald-300",
    normal: "from-emerald-400 via-sky-400 to-indigo-400",
  };
  const cardLabels = assetConfig?.cardLabels ?? {};
  const cardUnits = assetConfig?.cardUnits ?? {};
  const dpLabel = cardLabels.dp ?? "DP";
  const flowLabel = cardLabels.flow ?? "Flow";
  const efficiencyLabel = cardLabels.efficiency ?? "Efficiency";
  const sinceLabel = cardLabels.since ?? "Since clean";
  const sinceSuffix = cardLabels.sinceSuffix ?? cardUnits.since ?? "d";
  const dpUnit = cardUnits.dp ?? "psi";
  const flowUnit = cardUnits.flow ?? "bbl/d";
  const efficiencyUnit = cardUnits.efficiency ?? "%";
  return (
    <div
      onClick={() => onSelect(strainer.id)}
      className={`cursor-pointer ${GLASS_TILE} p-4 text-sm transition-all duration-300 ${
        statusGlows[strainer.status] || ""
      } ${isSelected ? "scale-[1.02] ring-2 ring-white/80 ring-offset-2 ring-offset-neutral-950" : "hover:bg-white/10"}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-base font-semibold text-white">{strainer.id}</div>
          <div className="mt-1 text-xs text-gray-400">
            {`${strainer.location.unit} \u00B7 ${strainer.location.pump}`}
          </div>
        </div>
        <span
          className={`rounded-full bg-gradient-to-br px-2 py-0.5 text-xs font-semibold text-white ${
            badgeGradients[strainer.status] || "from-slate-600 to-slate-700"
          }`}
        >
          {strainer.status === "alert" ? "Alert" : strainer.status === "warning" ? "Warning" : "Normal"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-300">
        <div>
          <div className="uppercase tracking-wide text-gray-500">{dpLabel}</div>
          <div className="font-semibold text-white">
            {strainer.currentMetrics.differentialPressure.toFixed(2)} {dpUnit}
          </div>
        </div>
        <div>
          <div className="uppercase tracking-wide text-gray-500">{flowLabel}</div>
          <div className="font-semibold text-white">
            {strainer.currentMetrics.flowRate.toFixed(0)} {flowUnit}
          </div>
        </div>
        <div>
          <div className="uppercase tracking-wide text-gray-500">{efficiencyLabel}</div>
          <div className="font-semibold text-white">
            {strainer.currentMetrics.efficiency.toFixed(1)}
            {efficiencyUnit}
          </div>
        </div>
        <div>
          <div className="uppercase tracking-wide text-gray-500">{sinceLabel}</div>
          <div className="font-semibold text-white">
            {strainer.trends.daysSinceClean} {sinceSuffix}
          </div>
        </div>
      </div>
    </div>
  );
};

const AccordionItem = ({ title, icon, children, defaultOpen = false }) => {
  const IconComponent = icon;
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className={`overflow-hidden ${GLASS_CARD}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-t-3xl bg-transparent p-5 text-left text-lg font-semibold text-white transition-colors hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <div className={`${ACCENT_GRADIENT} flex h-10 w-10 items-center justify-center rounded-2xl text-white`}>
            {IconComponent && <IconComponent size={20} />}
          </div>
          <span>{title}</span>
        </div>
        <ChevronDown
          size={20}
          className={`transform text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid transition-all duration-500 ease-in-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="p-5 pt-0">{children}</div>
        </div>
      </div>
    </div>
  );
};

const PredictionCard = ({ title, value, description }) => (
  <div className={`${GLASS_TILE} flex flex-col gap-2 p-4`}>
    <div className="text-xs uppercase tracking-wide text-gray-400">{title}</div>
    <div className="text-2xl font-semibold text-white">{value}</div>
    {description && <div className="text-xs text-gray-400">{description}</div>}
  </div>
);
const InlineSparkline = ({ samples = [], stroke = "#38bdf8" }) => {
  if (!samples.length) {
    return <div className="h-10 w-full rounded-full bg-white/5" />;
  }
  const max = Math.max(...samples);
  const min = Math.min(...samples);
  const points = samples
    .map((sample, idx) => {
      const x = (idx / Math.max(samples.length - 1, 1)) * 100;
      const normalized = max - min === 0 ? 0.5 : (sample - min) / (max - min);
      const y = 100 - normalized * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-10 w-full">
      <polyline fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" points={points} />
    </svg>
  );
};
const CompressorPerformanceChart = ({ data = [] }) => {
  if (!data.length) {
    return (
      <div className={`${GLASS_TILE} p-5`}>
        <div className="text-lg font-semibold text-white">Discharge Pressure vs Vibration</div>
        <div className="mt-4 text-sm text-gray-400">No vibration telemetry available.</div>
      </div>
    );
  }
  return (
    <div className={`${GLASS_TILE} p-5`}>
      <div className="text-lg font-semibold text-white">Discharge Pressure vs Vibration</div>
      <div className="mt-4 h-[320px] min-h-[320px]">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              fontSize={12}
              tickFormatter={(value) => {
                const d = new Date(value);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
            />
            <YAxis yAxisId="left" stroke="#67e8f9" domain={["auto", "auto"]} />
            <YAxis yAxisId="right" orientation="right" stroke="#f87171" domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }}
              labelStyle={{ color: "#e5e7eb" }}
            />
            <Line yAxisId="left" type="monotone" dataKey="dischargePsi" stroke="#67e8f9" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="vibrationIps" stroke="#f87171" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
const PipelineCorrosionChart = ({ data = [] }) => {
  if (!data.length) {
    return (
      <div className={`${GLASS_TILE} p-5`}>
        <div className="text-lg font-semibold text-white">Corrosion Depth Forecast</div>
        <div className="mt-4 text-sm text-gray-400">No corrosion forecast available.</div>
      </div>
    );
  }
  return (
    <div className={`${GLASS_TILE} p-5`}>
      <div className="text-lg font-semibold text-white">Corrosion Depth Forecast</div>
      <div className="mt-4 h-[260px] min-h-[260px]">
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="corrosionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="year" stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} unit=" mm/y" />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }}
              labelStyle={{ color: "#e5e7eb" }}
            />
            <Area type="monotone" dataKey="depth" stroke="#fb923c" strokeWidth={2} fill="url(#corrosionGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
const CompressorDetailSections = ({ compressor }) => {
  if (!compressor) return null;
  const predictions = compressor.predictions ?? {};
  const serviceTimeline = formatTimeRemaining(predictions.serviceDueDays ?? 0);
  return (
    <div className="mt-6 space-y-4">
      <CompressorPerformanceChart data={compressor.vibrationTrend ?? []} />
      <div className="grid gap-4 md:grid-cols-3">
        <PredictionCard
          title="Trip Probability [72h]"
          value={`${Math.round((predictions.tripProbability72h ?? 0) * 100)}%`}
          description={`Breach window ~${formatTimeRemaining(3)} (72h)`}
        />
        <PredictionCard
          title="Energy Penalty"
          value={`${predictions.energyPenalty ?? 0} kWh`}
          description="Excess energy from efficiency loss"
        />
        <PredictionCard
          title="Service Due"
          value={`${predictions.serviceDueDays ?? 0} days`}
          description={`Recommended service in ${serviceTimeline}`}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${GLASS_TILE} p-4`}>
          <div className="text-sm font-semibold text-white">Bearing Health</div>
          <div className="mt-3 space-y-3 text-sm">
            {(compressor.bearingHealth ?? []).map((item, idx) => (
              <div key={`bearing-${idx}`} className="flex items-center justify-between rounded-2xl border border-white/10 px-3 py-2">
                <div>
                  <div className="font-semibold text-white">{item.name}</div>
                  <div className="text-xs text-gray-400">Trend: {item.trend > 0 ? "+" : ""}{item.trend} ips</div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.status === "Alert"
                      ? "bg-rose-500/30 text-rose-200"
                      : item.status === "Watch"
                      ? "bg-amber-500/30 text-amber-100"
                      : "bg-emerald-500/20 text-emerald-200"
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className={`${GLASS_TILE} p-4`}>
          <div className="text-sm font-semibold text-white">Service Timeline</div>
          <div className="mt-3 space-y-3 text-sm text-gray-300">
            {(compressor.serviceTimeline ?? []).map((event, idx) => (
              <div key={`service-${idx}`} className="rounded-2xl border border-white/10 p-3">
                <div className="text-xs uppercase tracking-wide text-gray-400">{event.date}</div>
                <div className="font-semibold text-white">{event.scope}</div>
                <div className="text-xs text-gray-400">Downtime: {event.downtime}</div>
                <div className="text-xs text-gray-400">Risk if skipped: {event.riskIfSkipped}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
const PipelineDetailSections = ({ pipeline }) => {
  if (!pipeline) return null;
  return (
    <div className="mt-6 space-y-4">
      <div className={`${GLASS_TILE} p-4`}>
        <div className="text-sm font-semibold text-white">Segment Gradients</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {(pipeline.segmentProfiles ?? []).map((segment, idx) => (
            <div key={`segment-${idx}`} className="rounded-2xl border border-white/10 p-3">
              <div className="flex items-center justify-between text-sm text-gray-300">
                <span>{segment.segment}</span>
                <span className="text-white">{segment.gradient} psi/km</span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${
                    segment.status === "Alert"
                      ? "bg-rose-500"
                      : segment.status === "Watch"
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                  }`}
                  style={{ width: `${Math.min(100, (segment.gradient / 50) * 100)}%` }}
                />
              </div>
              <div className="mt-2 text-xs uppercase tracking-wide text-gray-400">{segment.status}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <PipelineCorrosionChart data={pipeline.corrosionForecast ?? []} />
        <div className="space-y-4">
          <div className={`${GLASS_TILE} p-4`}>
            <div className="text-sm font-semibold text-white">Leak Risk Outlook</div>
            <div className="mt-3 grid gap-3 text-sm">
              <PredictionCard
                title="Probability"
                value={`${Math.round((pipeline.leakRisk?.probability ?? 0) * 100)}%`}
                description={`Detection confidence: ${pipeline.leakRisk?.detectionConfidence ?? "High"} · ${formatTimeRemaining(pipeline.leakRisk?.timelineDays ?? 0)} window`}
              />
              <div className={`${GLASS_TILE} p-3 text-xs text-gray-300`}>
                {pipeline.leakRisk?.recommendation ?? "Continue routine patrols"}
              </div>
            </div>
          </div>
          <div className={`${GLASS_TILE} p-4`}>
            <div className="text-sm font-semibold text-white">Upcoming Pig Runs</div>
            <div className="mt-3 space-y-3 text-sm text-gray-300">
              {(pipeline.pigSchedule ?? []).map((run, idx) => (
                <div key={`pig-${idx}`} className="rounded-2xl border border-white/10 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{run.run}</span>
                    <span className="text-xs uppercase tracking-wide text-gray-400">{run.date}</span>
                  </div>
                  <div className="text-xs text-gray-400">{run.type}</div>
                  <div className="text-xs text-gray-400">Status: {run.readiness}</div>
                </div>
              ))}
            </div>
          </div>
          <PredictionCard
            title="Next Pig Due"
            value={formatTimeRemaining(pipeline.predictions?.pigDueDays ?? 0)}
            description="Recommended cleaning window"
          />
        </div>
      </div>
    </div>
  );
};
const CompressorOverviewPanels = ({ compressor }) => {
  const [activeTab, setActiveTab] = useState("performance");
  useEffect(() => {
    setActiveTab("performance");
  }, [compressor?.id]);

  if (!compressor) return null;

  const latestVibration = compressor.vibrationTrend?.slice(-1)[0];
  const envelope = compressor.performanceEnvelope ?? {};
  const conditionMonitoring = compressor.conditionMonitoring ?? {};
  const maintenanceLog = compressor.maintenanceLog ?? compressor.serviceTimeline ?? [];
  const overviewTabs = [
    {
      key: "performance",
      title: "Performance & Reliability",
      icon: TrendingUp,
      content: (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <PredictionCard
              title="MTBS Forecast"
              value={`${envelope.mtbsDays ?? "-"} days`}
              description="Mean time between services"
            />
            <PredictionCard
              title="Surge Margin"
              value={`${envelope.surgeMargin ?? "-"} psi`}
              description="Distance to surge line"
            />
            <PredictionCard
              title="Throughput vs Design"
              value={`${envelope.throughputUtilization ?? "-"}%`}
              description="Current load vs design map"
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.4fr,0.6fr]">
            <CompressorPerformanceChart data={compressor.vibrationTrend ?? []} />
            <div className={`${GLASS_TILE} p-4`}>
              <div className="text-sm font-semibold text-white">Reliability Notes</div>
              <div className="mt-4 space-y-2 text-sm text-gray-300">
                <div className="flex items-center justify-between">
                  <span>Vibration Severity</span>
                  <span className="text-white">{envelope.vibrationSeverityIndex ?? "-"} ips</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Load Line Position</span>
                  <span className="text-white">{envelope.loadLine ?? "-"}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Efficiency Drift</span>
                  <span className="text-white">{envelope.efficiencyDrift ?? "-"}%</span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-gray-400">
                  Latest discharge {latestVibration?.dischargePsi ?? "-"} psi | RMS vibration {latestVibration?.vibrationIps ?? "-"} ips
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "condition",
      title: "Condition Monitoring",
      icon: Activity,
      content: (
        <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
          <div className={`${GLASS_TILE} p-4`}>
            <div className="text-sm font-semibold text-white">Bearing Sparklines</div>
            <div className="mt-4 grid gap-3 text-xs text-gray-300">
              {(conditionMonitoring.bearingSparklines ?? []).map((bearing, idx) => (
                <div key={`bearing-spark-${idx}`} className="rounded-2xl border border-white/10 p-3">
                  <div className="flex items-center justify-between text-white">
                    <span>{bearing.name}</span>
                    <span className="text-[11px] uppercase tracking-wide text-gray-400">
                      {compressor.bearingHealth?.[idx]?.status ?? "Watch"}
                    </span>
                  </div>
                  <div className="mt-2">
                    <InlineSparkline samples={bearing.samples} stroke="#f472b6" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className={`${GLASS_TILE} p-4`}>
              <div className="text-sm font-semibold text-white">Lube Oil Temperatures</div>
              <div className="mt-3 space-y-3 text-xs text-gray-300">
                {(conditionMonitoring.lubeOilTemps ?? []).map((loop, idx) => (
                  <div key={`lube-${idx}`}>
                    <div className="flex items-center justify-between">
                      <span>{loop.loop}</span>
                      <span className="text-white">{loop.value} degF</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-400"
                        style={{ width: `${Math.min(100, (loop.value / loop.limit) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">Limit {loop.limit} degF</div>
                  </div>
                ))}
              </div>
            </div>
            <PredictionCard
              title="Start Reliability"
              value={`${Math.round((conditionMonitoring.startReliability ?? 0) * 100)}%`}
              description="Prediction for next 3 attempts"
            />
            <div className={`${GLASS_TILE} p-4`}>
              <div className="text-sm font-semibold text-white">Orbit Snapshots</div>
              <div className="mt-3 grid gap-3 text-xs text-gray-300">
                {(conditionMonitoring.orbitSnapshots ?? []).map((orbit, idx) => (
                  <div
                    key={`orbit-${idx}`}
                    className="flex items-center justify-between rounded-2xl border border-white/10 px-3 py-2"
                  >
                    <div>
                      <div className="font-semibold text-white">{orbit.stage}</div>
                      <div className="text-[11px] uppercase tracking-wide text-gray-500">{orbit.orientation}</div>
                    </div>
                    <div className="text-right text-white">
                      {orbit.major}" / {orbit.minor}"
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "maintenance",
      title: "Maintenance Log",
      icon: Wrench,
      content: (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <PredictionCard
              title="Trip Probability [72h]"
              value={`${Math.round((compressor.predictions?.tripProbability72h ?? 0) * 100)}%`}
              description="Model fusion score"
            />
            <PredictionCard
              title="Energy Penalty"
              value={`${compressor.predictions?.energyPenalty ?? 0} kWh`}
              description="Efficiency drift cost"
            />
            <PredictionCard
              title="Service Window"
              value={`${compressor.predictions?.serviceDueDays ?? 0} days`}
              description="Recommended service lead time"
            />
          </div>
          <div className={`${GLASS_TILE} p-4`}>
            <div className="text-sm font-semibold text-white">Service Timeline</div>
            <div className="mt-3 space-y-3 text-sm text-gray-300">
              {maintenanceLog.map((event, idx) => (
                <div key={`svc-${idx}`} className="rounded-2xl border border-white/10 p-3">
                  <div className="text-xs uppercase tracking-wide text-gray-400">{event.date}</div>
                  <div className="font-semibold text-white">{event.scope}</div>
                  <div className="text-xs text-gray-400">Downtime: {event.downtime}</div>
                  <div className="text-xs text-gray-400">Risk if skipped: {event.riskIfSkipped}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ];
  const activeTabConfig = overviewTabs.find((tab) => tab.key === activeTab) ?? overviewTabs[0];
  return (
    <div className={`${GLASS_CARD} overflow-hidden`}>
      <div className="flex flex-wrap gap-2 border-b border-white/10 bg-white/5 px-5 py-4">
        {overviewTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === activeTabConfig.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 ${
                isActive
                  ? `${ACCENT_GRADIENT} border border-transparent text-white shadow-lg`
                  : "border border-white/10 bg-transparent text-gray-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={18} />
              <span>{tab.title}</span>
            </button>
          );
        })}
      </div>
      <div className="p-5">{activeTabConfig.content}</div>
    </div>
  );
};
const PipelineOverviewPanels = ({ pipeline }) => {
  const [activeTab, setActiveTab] = useState("flow");
  useEffect(() => {
    setActiveTab("flow");
  }, [pipeline?.id]);

  if (!pipeline) return null;

  const flowAssurance = pipeline.flowAssurance ?? {};
  const integrityHighlights = pipeline.integrityHighlights ?? {};
  const operationsSnapshot = pipeline.operationsSnapshot ?? {};
  const overviewTabs = [
    {
      key: "flow",
      title: "Flow Assurance",
      icon: Droplets,
      content: (
        <div className="grid gap-4 lg:grid-cols-[1.5fr,0.5fr]">
          <div className={`${GLASS_TILE} p-4`}>
            <div className="text-sm font-semibold text-white">Pressure vs Station</div>
            <div className="mt-4 h-[260px]">
              <ResponsiveContainer>
                <LineChart data={pipeline.pressureProfile ?? []}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="station" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }}
                    labelStyle={{ color: "#e5e7eb" }}
                  />
                  <Line type="monotone" dataKey="pressure" stroke="#60a5fa" strokeWidth={3} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="space-y-4">
            <PredictionCard title="Hydrate Risk" value={flowAssurance.hydrateRisk ?? "Unknown"} description="Modeled 7d outlook" />
            <PredictionCard title="Wax Trend" value={flowAssurance.waxRisk ?? "Unknown"} description="Deposition likelihood" />
            <PredictionCard
              title="Line-Pack Utilization"
              value={`${flowAssurance.linePackUtilization ?? "-"}%`}
              description="Current packing factor"
            />
          </div>
        </div>
      ),
    },
    {
      key: "integrity",
      title: "Integrity",
      icon: ShieldAlert,
      content: (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
            <PipelineCorrosionChart data={integrityHighlights.corrosionGrowth ?? pipeline.corrosionForecast ?? []} />
            <div className={`${GLASS_TILE} p-4`}>
              <div className="text-sm font-semibold text-white">ILI Findings</div>
              <div className="mt-3 space-y-3 text-xs text-gray-300">
                {(integrityHighlights.inlineInspection ?? []).map((finding, idx) => (
                  <div key={`ili-${idx}`} className="rounded-2xl border border-white/10 p-3">
                    <div className="text-xs uppercase tracking-wide text-gray-400">{finding.segment}</div>
                    <div className="font-semibold text-white">{finding.anomaly}</div>
                    <div className="text-[11px] uppercase tracking-wide text-gray-500">{finding.severity} severity</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <PredictionCard
              title="Corrosion Allowance"
              value={`${integrityHighlights.corrosionAllowanceLeft ?? "-"} in`}
              description="Remaining wall"
            />
            <PredictionCard
              title="Burst Margin"
              value={`${integrityHighlights.burstPressureMargin ?? "-"}%`}
              description="Vs MAOP"
            />
            <PredictionCard
              title="Leak Detection Score"
              value={`${Math.round((pipeline.predictions?.leakDetectionScore ?? 0) * 100)}%`}
              description="Model confidence"
            />
          </div>
        </div>
      ),
    },
    {
      key: "operations",
      title: "Operations",
      icon: Building,
      content: (
        <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
          <div className={`${GLASS_TILE} p-4`}>
            <div className="text-sm font-semibold text-white">Valve Status</div>
            <div className="mt-3 space-y-3 text-xs text-gray-300">
              {(operationsSnapshot.valveStatus ?? []).map((valve, idx) => (
                <div key={`valve-${idx}`} className="flex items-center justify-between rounded-2xl border border-white/10 px-3 py-2">
                  <span>{valve.name}</span>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      valve.status === "Maintenance"
                        ? "bg-amber-500/20 text-amber-200"
                        : valve.status === "Closed"
                        ? "bg-rose-500/20 text-rose-200"
                        : "bg-emerald-500/20 text-emerald-200"
                    }`}
                  >
                    {valve.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <PredictionCard
              title="Pump Availability"
              value={`${Math.round((operationsSnapshot.pumpAvailability ?? 0) * 100)}%`}
              description="Stations available"
            />
            <PredictionCard
              title="MAOP Breach Risk"
              value={`${Math.round((pipeline.predictions?.maopRisk ?? 0) * 100)}%`}
              description="Next 7d probability"
            />
            <PredictionCard
              title="Next Pig Run"
              value={flowAssurance.pigTimeline?.[0]?.date ?? "-"}
              description={flowAssurance.pigTimeline?.[0]?.type ?? "Scheduled"}
            />
          </div>
        </div>
      ),
    },
  ];
  const activeTabConfig = overviewTabs.find((tab) => tab.key === activeTab) ?? overviewTabs[0];
  return (
    <div className={`${GLASS_CARD} overflow-hidden`}>
      <div className="flex flex-wrap gap-2 border-b border-white/10 bg-white/5 px-5 py-4">
        {overviewTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === activeTabConfig.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 ${
                isActive
                  ? `${ACCENT_GRADIENT} border border-transparent text-white shadow-lg`
                  : "border border-white/10 bg-transparent text-gray-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={18} />
              <span>{tab.title}</span>
            </button>
          );
        })}
      </div>
      <div className="p-5">{activeTabConfig.content}</div>
    </div>
  );
};
const StrainerDetailView = ({ strainer, fleet = [], assetConfig }) => {
  const metricTrends = useMemo(() => {
    if (!strainer) return {};
    if (strainer.metricTrends) return strainer.metricTrends;
    return deriveMetricTrendsForStrainer(strainer);
  }, [strainer]);

  const fleetRiskSummary = useMemo(() => {
    if (!fleet.length || !strainer) return null;
    const statusCounts = { alert: 0, warning: 0, normal: 0, other: 0 };
    const cellCounts = {};
    const selectedImpact = toTitleLevel(strainer?.riskAnalysis?.impact);
    const selectedProbability = toTitleLevel(strainer?.riskAnalysis?.probability);
    let sameCellCount = 0;
    let dominantKey = null;

    fleet.forEach((item) => {
      if (!item) return;
      const impact = toTitleLevel(item?.riskAnalysis?.impact);
      const probability = toTitleLevel(item?.riskAnalysis?.probability);
      const key = `${impact}|${probability}`;
      cellCounts[key] = (cellCounts[key] || 0) + 1;
      if (!dominantKey || cellCounts[key] > (cellCounts[dominantKey] || 0)) {
        dominantKey = key;
      }
      if (impact === selectedImpact && probability === selectedProbability) {
        sameCellCount += 1;
      }
      const status = String(item.status || "other").toLowerCase();
      if (statusCounts[status] !== undefined) {
        statusCounts[status] += 1;
      } else {
        statusCounts.other += 1;
      }
    });

    const [dominantImpact, dominantProbability] = dominantKey
      ? dominantKey.split("|")
      : [selectedImpact, selectedProbability];

    return {
      total: fleet.filter(Boolean).length,
      statusCounts,
      selectedImpact,
      selectedProbability,
      sameCellCount,
      dominantImpact,
      dominantProbability,
      dominantCount: dominantKey ? cellCounts[dominantKey] : sameCellCount,
    };
  }, [fleet, strainer]);

  const assetLabelLower = assetConfig?.label ? assetConfig.label.toLowerCase() : "asset";
  if (!strainer) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-2xl text-gray-500">
        Select a {assetLabelLower} to view its diagnostics
      </div>
    );
  }

  const statusBadgeColors = {
    alert: "bg-red-600",
    warning: "bg-yellow-500",
    normal: "bg-emerald-500",
  };
  const dpTrendMeta = metricTrends.differentialPressure;
  const flowTrendMeta = metricTrends.flowRate;
  const efficiencyTrendMeta = metricTrends.efficiency;
  const daysSinceCleanTrendMeta = metricTrends.daysSinceClean;
  const dpRateTrendMeta = metricTrends.dpRate;
  const detailMetricLabels = assetConfig?.detailMetricLabels ?? {};
  const detailMetricUnits = assetConfig?.detailMetricUnits ?? {};
  const hasFleetSummary = Boolean(fleetRiskSummary);
  const isCompressor = assetConfig?.key === "compressors";
  const isPipeline = assetConfig?.key === "pipelines";

  return (
    <div className="h-full overflow-y-auto rounded-3xl bg-transparent p-6">
      <div className="flex items-start justify-between border-b border-white/10 pb-4">
        <div>
          <div className="text-3xl font-extrabold text-white">{strainer.id}</div>
          <div className="mt-2 text-sm text-gray-400">
            {`${strainer.location.unit} · ${strainer.location.pump}`}
          </div>
        </div>
        <span
          className={`rounded-full px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-white ${
            statusBadgeColors[strainer.status] || "bg-slate-600"
          }`}
        >
        </span>
      </div>

      <div className="mt-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricDisplay
            icon={Gauge}
            label={detailMetricLabels.dp ?? "Differential Pressure"}
            value={strainer.currentMetrics.differentialPressure.toFixed(2)}
            unit={detailMetricUnits.dp ?? "psi"}
            trend={dpTrendMeta}
          />
          <MetricDisplay
            icon={Droplets}
            label={detailMetricLabels.flow ?? "Flow Rate"}
            value={strainer.currentMetrics.flowRate.toFixed(0)}
            unit={detailMetricUnits.flow ?? "bbl/d"}
            trend={flowTrendMeta}
          />
          <MetricDisplay
            icon={TrendingUp}
            label={detailMetricLabels.efficiency ?? "Efficiency"}
            value={strainer.currentMetrics.efficiency.toFixed(1)}
            unit={detailMetricUnits.efficiency ?? "%"}
            trend={efficiencyTrendMeta}
          />
          <MetricDisplay
            icon={Clock}
            label={detailMetricLabels.daysSinceClean ?? "Days Since Clean"}
            value={strainer.trends.daysSinceClean}
            unit={detailMetricUnits.daysSinceClean ?? "days"}
            trend={daysSinceCleanTrendMeta}
          />
          <MetricDisplay
            icon={Activity}
            label={detailMetricLabels.dpRate ?? "DP Rate"}
            value={strainer.trends.dpRate.toFixed(2)}
            unit={detailMetricUnits.dpRate ?? "psi/day"}
            trend={dpRateTrendMeta}
          />
          <MetricDisplay
            icon={Zap}
            label={detailMetricLabels.designFlow ?? "Design Flow"}
            value={strainer.currentMetrics.designFlowRate}
            unit={detailMetricUnits.designFlow ?? "bbl/d"}
          />
        </div>
      </div>

      {isCompressor ? (
        <CompressorDetailSections compressor={strainer} />
      ) : isPipeline ? (
        <PipelineDetailSections pipeline={strainer} />
      ) : (
        strainer.predictions && (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <PredictionCard
              title="Breach Timeline"
              value={strainer.predictions.timelineLabel ?? "-"}
              description={`Projected plug date ${strainer.predictions.projectedPlugDate ?? "-"}`}
            />
            <PredictionCard
              title="Fouling Rate"
              value={`${strainer.predictions.foulingRate ?? 0} psi/day`}
              description={strainer.predictions.recommendation}
            />
            <PredictionCard
              title="Cleaning Window"
              value={formatTimeRemaining(strainer.predictions.daysToCritical ?? 0)}
              description={`Next scheduled clean ${formatDate(strainer.trends?.nextCleanDue)}`}
            />
          </div>
        )
      )}

      <div className="my-10 space-y-4">
        <RiskMatrix
          fleet={fleet}
          selected={strainer}
          assetLabel={assetConfig?.label ?? "Asset"}
          assetLabelPlural={assetConfig?.pluralLabel ?? "Assets"}
        />
        {hasFleetSummary && (
          <div className={`${GLASS_TILE} p-4`}>
            <div className="text-sm font-semibold text-white">Matrix Overview</div>
            <p className="mt-2 text-xs leading-relaxed text-gray-300">
              {strainer.id} sits in the {" "}
              <span className="text-sky-300">
                {fleetRiskSummary.selectedImpact} impact / {fleetRiskSummary.selectedProbability} probability
              </span>{" "}
              cell alongside {fleetRiskSummary.sameCellCount}{" "}
              {fleetRiskSummary.sameCellCount === 1 ? "peer" : "peers"} across the fleet. The densest cluster is {" "}
              <span className="text-emerald-300">
                {fleetRiskSummary.dominantImpact} impact / {fleetRiskSummary.dominantProbability} probability
              </span>{" "}
              with {fleetRiskSummary.dominantCount}{" "}
              {fleetRiskSummary.dominantCount === 1 ? "asset" : "assets"}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-red-300 backdrop-blur">
                <span className="text-gray-400">Alerts</span>
                <span>{fleetRiskSummary.statusCounts.alert}</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-amber-300 backdrop-blur">
                <span className="text-gray-400">Warnings</span>
                <span>{fleetRiskSummary.statusCounts.warning}</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-emerald-300 backdrop-blur">
                <span className="text-gray-400">Normal</span>
                <span>{fleetRiskSummary.statusCounts.normal}</span>
              </div>
              {fleetRiskSummary.statusCounts.other > 0 && (
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200 backdrop-blur">
                  <span className="text-gray-400">Other</span>
                  <span>{fleetRiskSummary.statusCounts.other}</span>
                </div>
              )}
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sky-200 backdrop-blur">
                <span className="text-gray-400">Total</span>
                <span>{fleetRiskSummary.total}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StrainerOverviewPanels = ({ strainer, strainerOptions = [], selectedId, onSelectStrainer, assetConfig }) => {
  const [activeTab, setActiveTab] = useState("performance");

  useEffect(() => {
    setActiveTab("performance");
  }, [strainer?.id]);

  if (!strainer) return null;

  const currentRiskColor = riskColorFor(strainer.riskAnalysis.impact, strainer.riskAnalysis.probability);
  const statusGradients = {
    alert: "from-rose-500 via-orange-500 to-amber-400",
    warning: "from-amber-400 via-yellow-400 to-emerald-300",
    normal: "from-emerald-400 via-sky-400 to-indigo-400",
  };
  const statusDotColors = {
    alert: "bg-rose-400",
    warning: "bg-amber-300",
    normal: "bg-emerald-300",
  };

  const chartLabels = assetConfig?.chartLabels ?? {};
  const maintenanceHistoryLabels = assetConfig?.maintenanceHistory ?? {};
  const chipLabel = assetConfig?.listChipLabel ?? assetConfig?.pluralLabel ?? "Assets";
  const strainerPredictions = strainer.predictions ?? {};
  const debrisMix = strainer.debrisMix ?? [];
  const debrisStackData = useMemo(() => {
    if (!debrisMix.length) return [];
    const base = { name: "Mix" };
    debrisMix.forEach((slice) => {
      base[slice.type] = slice.percent;
    });
    return [base];
  }, [debrisMix]);
  const peerStats = useMemo(() => {
    if (!strainerOptions.length) return null;
    const peers = strainerOptions.filter((asset) => asset.id !== strainer.id && asset.currentMetrics && asset.trends);
    const pool = peers.length ? peers : strainerOptions;
    if (!pool.length) return null;
    const totals = pool.reduce(
      (acc, asset) => {
        acc.dp += asset.currentMetrics?.differentialPressure ?? 0;
        acc.dpRate += asset.trends?.dpRate ?? 0;
        acc.efficiency += asset.currentMetrics?.efficiency ?? 0;
        return acc;
      },
      { dp: 0, dpRate: 0, efficiency: 0 },
    );
    const divisor = pool.length;
    return {
      avgDp: totals.dp / divisor,
      avgDpRate: totals.dpRate / divisor,
      avgEfficiency: totals.efficiency / divisor,
    };
  }, [strainerOptions, strainer]);
  const dpDelta = peerStats ? strainer.currentMetrics.differentialPressure - peerStats.avgDp : 0;
  const foulingDelta = peerStats ? strainer.trends.dpRate - peerStats.avgDpRate : 0;
  const efficiencyDelta = peerStats ? strainer.currentMetrics.efficiency - peerStats.avgEfficiency : 0;
  const anomalyCallouts = [
    {
      label: "DP vs Fleet",
      value: `${dpDelta >= 0 ? "+" : ""}${dpDelta.toFixed(1)} psi`,
      tone: dpDelta >= 0 ? "text-rose-300" : "text-emerald-300",
      description: dpDelta >= 0 ? "Running hotter than fleet median" : "Below fleet differential",
    },
    {
      label: "Fouling Rate",
      value: `${foulingDelta >= 0 ? "+" : ""}${foulingDelta.toFixed(2)} psi/day`,
      tone: foulingDelta >= 0 ? "text-amber-300" : "text-emerald-300",
      description: foulingDelta >= 0 ? "Acceleration vs baseline" : "On pace with fleet",
    },
    {
      label: "Efficiency Delta",
      value: `${efficiencyDelta >= 0 ? "+" : ""}${efficiencyDelta.toFixed(1)}%`,
      tone: efficiencyDelta >= 0 ? "text-sky-300" : "text-rose-300",
      description: efficiencyDelta >= 0 ? "Headroom remaining" : "Below fleet efficiency",
    },
  ];
  const nextCleanCountdown = useMemo(() => {
    const due = strainer.trends?.nextCleanDue;
    if (!due) return strainerPredictions.daysToCritical ?? 0;
    const dueDate = new Date(due);
    if (Number.isNaN(dueDate.getTime())) return strainerPredictions.daysToCritical ?? 0;
    const days = Math.max(0, Math.round((dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    return days;
  }, [strainer.trends?.nextCleanDue, strainerPredictions.daysToCritical]);
  const debrisColors = {
    "Sand/Silt": "#facc15",
    "Corrosion Products": "#f97316",
    Scale: "#a855f7",
    "Polymer Residue": "#38bdf8",
  };
  const overviewTabs = [
    {
      key: "performance",
      title: "Performance Trends",
      icon: TrendIcon,
      content: (
        <div className={`${GLASS_TILE} p-5`}>
          <div className="text-lg font-semibold text-white">{chartLabels.dpTrendTitle ?? "DP Trend (Last 30 Days)"}</div>
          <div className="mt-4 h-[320px]">
            <ResponsiveContainer>
              <AreaChart data={strainer.historicalData}>
                <defs>
                  <linearGradient id="dpGradientTop" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickFormatter={(value) => {
                    const d = new Date(value);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={12}
                  label={{
                    value: chartLabels.dpAxis ?? "DP (psi)",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#9ca3af",
                  }}
                />
                <Tooltip
                  contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }}
                  labelStyle={{ color: "#e5e7eb" }}
                  formatter={(value, key) => {
                    if (key === "dp") return [`${value.toFixed(2)} psi`, chartLabels.tooltipDp ?? "DP"];
                    if (key === "flowRate") return [`${value.toFixed(0)} bbl/d`, chartLabels.tooltipFlow ?? "Flow"];
                    if (key === "efficiency") return [`${value.toFixed(1)}%`, chartLabels.tooltipEfficiency ?? "Efficiency"];
                    return [value, key];
                  }}
                />
                <ReferenceLine
                  y={18}
                  stroke="#fbbf24"
                  strokeDasharray="3 3"
                  label={{ value: "Warning", fill: "#fbbf24", fontSize: 12 }}
                />
                <ReferenceLine
                  y={25}
                  stroke="#f87171"
                  strokeDasharray="3 3"
                  label={{ value: "Critical", fill: "#f87171", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="dp" stroke="#8b5cf6" strokeWidth={2} fill="url(#dpGradientTop)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {debrisStackData.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm text-white">
                <span>Debris Composition</span>
                <span className="text-xs uppercase tracking-wide text-gray-400">
                  Last {strainer.cleaningHistory?.length ?? 0} cleans
                </span>
              </div>
              <div className="mt-3 h-40">
                <ResponsiveContainer>
                  <BarChart data={debrisStackData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" hide />
                    <YAxis stroke="#9ca3af" fontSize={12} unit="%" />
                    <Tooltip
                      contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }}
                      labelStyle={{ color: "#e5e7eb" }}
                      formatter={(value, name) => {
                        const formatted = typeof value === "number" ? `${value.toFixed(1)}%` : value;
                        return [formatted, name];
                      }}
                    />
                    {debrisMix.map((slice) => (
                      <Bar
                        key={`debris-${slice.type}`}
                        dataKey={slice.type}
                        stackId="mix"
                        fill={debrisColors[slice.type] ?? "#f472b6"}
                        radius={[6, 6, 6, 6]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-400">
                {debrisMix.map((slice) => (
                  <span key={`legend-${slice.type}`} className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: debrisColors[slice.type] ?? "#f472b6" }}
                    />
                    <span>
                      {slice.type} · {slice.percent}%
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "tuning",
      title: "Live KPI Tuning",
      icon: Activity,
      content: (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <PredictionCard
              title="Fouling Rate"
              value={`${strainerPredictions.foulingRate ?? strainer.trends.dpRate?.toFixed(2) ?? 0} psi/day`}
              description="Current modeled rate"
            />
            <PredictionCard
              title="Days To Critical"
              value={formatTimeRemaining(strainerPredictions.daysToCritical ?? 0)}
              description="Projected breach window"
            />
            <PredictionCard
              title="Cleaning Window"
              value={formatTimeRemaining(nextCleanCountdown)}
              description={`Next clean ${formatDate(strainer.trends?.nextCleanDue)}`}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className={`${GLASS_TILE} p-4`}>
              <div className="text-sm font-semibold text-white">Fleet Comparison</div>
              <div className="mt-3 space-y-2 text-xs text-gray-300">
                <div className="flex items-center justify-between">
                  <span>Δ DP vs fleet</span>
                  <span className={dpDelta >= 0 ? "text-rose-300" : "text-emerald-300"}>
                    {dpDelta >= 0 ? "+" : ""}
                    {dpDelta.toFixed(1)} psi
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Δ Fouling rate</span>
                  <span className={foulingDelta >= 0 ? "text-amber-300" : "text-emerald-300"}>
                    {foulingDelta >= 0 ? "+" : ""}
                    {foulingDelta.toFixed(2)} psi/day
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Δ Efficiency</span>
                  <span className={efficiencyDelta >= 0 ? "text-sky-300" : "text-rose-300"}>
                    {efficiencyDelta >= 0 ? "+" : ""}
                    {efficiencyDelta.toFixed(1)}%
                  </span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Maintenance overlay</div>
                  <div className="text-sm text-white">
                    {formatTimeRemaining(strainerPredictions.daysToCritical ?? 0)} to breach vs{" "}
                    {formatTimeRemaining(nextCleanCountdown)}{" "}
                    scheduled clean
                  </div>
                </div>
              </div>
            </div>
            <div className={`${GLASS_TILE} p-4`}>
              <div className="text-sm font-semibold text-white">Anomaly Callouts</div>
              <div className="mt-3 space-y-3 text-xs text-gray-300">
                {anomalyCallouts.map((callout, idx) => (
                  <div
                    key={`callout-${idx}`}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{callout.label}</span>
                      <span className={`text-sm font-semibold ${callout.tone}`}>{callout.value}</span>
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">{callout.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "insights",
      title: "Insights",
      icon: BrainCircuit,
      content: (
        <div className="space-y-4">
          <AccordionItem title="Root Cause Analysis (RCA)" icon={FileText}>
            <div className="prose prose-invert max-w-none text-sm text-gray-200">
              {strainer.rootCauseAnalysis.split("\n").map((line, idx) => {
                if (line.startsWith("**") && line.endsWith("**")) {
                  return (
                    <h4 key={`rca-heading-top-${idx}`} className="text-base font-bold text-blue-300">
                      {line.replace(/\*\*/g, "")}
                    </h4>
                  );
                }
                if (/^\d+\./.test(line)) {
                  return (
                    <p key={`rca-line-top-${idx}`} className="ml-4 text-gray-200">
                      {line}
                    </p>
                  );
                }
                if (line.startsWith("-")) {
                  return (
                    <p key={`rca-bullet-top-${idx}`} className="ml-6 text-gray-200">
                      {line}
                    </p>
                  );
                }
                if (line.trim()) {
                  return (
                    <p key={`rca-text-top-${idx}`} className="text-gray-200">
                      {line}
                    </p>
                  );
                }
                return <br key={`rca-break-top-${idx}`} />;
              })}
            </div>
          </AccordionItem>
          <AccordionItem title="Supplier Analysis" icon={Building}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-400">Element Supplier</div>
                <div className="mt-1 text-lg font-bold text-white">{strainer.supplierInfo.elementSupplier}</div>
              </div>
              <div className="rounded-lg bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-400">Mesh Size</div>
                <div className="mt-1 text-lg font-bold text-white">{strainer.supplierInfo.meshSize} microns</div>
              </div>
              <div className="rounded-lg bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-400">Material</div>
                <div className="mt-1 text-lg font-bold text-white">{strainer.supplierInfo.material}</div>
              </div>
              <div className="rounded-lg bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-400">Last Inspection</div>
                <div className="mt-1 text-lg font-bold text-white">{formatDate(strainer.supplierInfo.lastInspectionDate)}</div>
              </div>
            </div>
          </AccordionItem>
          <AccordionItem title="Risk Analysis" icon={ShieldAlert}>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex items-center gap-4">
                <div className={`flex h-24 w-24 flex-col items-center justify-center rounded-lg text-white ${currentRiskColor}`}>
                  <div className="text-3xl font-extrabold">{strainer.riskAnalysis.riskScore}</div>
                  <div className="text-xs uppercase tracking-wide">Risk Score</div>
                </div>
                <div className="text-sm text-gray-200">
                  <div>
                    Impact: <span className="font-semibold text-amber-300">{strainer.riskAnalysis.impact}</span>
                  </div>
                  <div>
                    Probability: <span className="font-semibold text-amber-300">{strainer.riskAnalysis.probability}</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Mitigation Actions</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-200">
                  {strainer.riskAnalysis.mitigationActions.map((action, idx) => (
                    <li key={`action-top-${idx}`}>{action}</li>
                  ))}
                </ul>
              </div>
            </div>
          </AccordionItem>
          <AccordionItem title="Causality Analysis (5 Whys)" icon={BrainCircuit}>
            <div className={`mt-4 ${GLASS_TILE} p-3 text-sm text-gray-200`}>
              Problem Statement: {strainer.causalityAnalysis.problemStatement}
            </div>
            <div className="mt-4 space-y-3">
              {strainer.causalityAnalysis.fiveWhys.map((item, idx) => (
                <div key={`why-top-${idx}`} className="border-l-2 border-white/20 pl-4">
                  <div className="text-sm font-semibold text-blue-300">{item.why}</div>
                  <div className="text-sm text-gray-200">{`-> ${item.because}`}</div>
                </div>
              ))}
            </div>
          </AccordionItem>
        </div>
      ),
    },
    {
      key: "lifecycle",
      title: "Lifecycle Phase",
      icon: Calendar,
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400">Installation Date</div>
              <div className="mt-1 text-lg font-bold text-white">{formatDate(strainer.lifecycleInfo.installationDate)}</div>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400">Last Major Overhaul</div>
              <div className="mt-1 text-lg font-bold text-white">{formatDate(strainer.lifecycleInfo.lastOverhaulDate)}</div>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400">Expected End of Life</div>
              <div className="mt-1 text-lg font-bold text-white">{formatDate(strainer.lifecycleInfo.endOfLifeDate)}</div>
            </div>
          </div>
          <div className={`overflow-auto ${GLASS_TILE}`}>
            <div className="p-4 text-sm font-semibold text-white">{maintenanceHistoryLabels.title ?? "Cleaning History"}</div>
            <table className="min-w-full text-xs">
              <thead className="bg-white/5 text-gray-400">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-left font-medium">{maintenanceHistoryLabels.beforeLabel ?? "DP Before"}</th>
                  <th className="px-4 py-2 text-left font-medium">{maintenanceHistoryLabels.afterLabel ?? "DP After"}</th>
                  <th className="px-4 py-2 text-left font-medium">Downtime (hrs)</th>
                  <th className="px-4 py-2 text-left font-medium">{maintenanceHistoryLabels.descriptorLabel ?? "Debris Type"}</th>
                </tr>
              </thead>
              <tbody className="text-gray-200">
                {strainer.cleaningHistory.map((event, idx) => (
                  <tr key={`cleaning-top-${idx}`} className="border-t border-white/10">
                    <td className="px-4 py-2">{formatDate(event.date)}</td>
                    <td className="px-4 py-2 text-red-300">
                      {event.dpBefore.toFixed(2)} {maintenanceHistoryLabels.beforeUnit ?? "psi"}
                    </td>
                    <td className="px-4 py-2 text-emerald-300">
                      {event.dpAfter.toFixed(2)} {maintenanceHistoryLabels.afterUnit ?? "psi"}
                    </td>
                    <td className="px-4 py-2">{event.downtime}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-gradient-to-br from-slate-700 to-slate-900 px-2 py-1 text-xs text-white">
                        {event.debrisType}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
  ];

  const activeTabConfig = overviewTabs.find((tab) => tab.key === activeTab) ?? overviewTabs[0];

  return (
    <div className={`${GLASS_CARD} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-white/5 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {overviewTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === activeTabConfig?.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 ${
                  isActive
                    ? `${ACCENT_GRADIENT} border border-transparent text-white shadow-lg`
                    : "border border-white/10 bg-transparent text-gray-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} />
                <span>{tab.title}</span>
              </button>
            );
          })}
        </div>
        {strainerOptions.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">{chipLabel}</span>
            <div className="flex flex-wrap items-center gap-2">
              {strainerOptions.map((option) => {
                const isSelected = option.id === selectedId;
                const gradient = statusGradients[option.status] || "from-slate-600 to-slate-700";
                const dotColor = statusDotColors[option.status] || "bg-slate-400";
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onSelectStrainer?.(option.id)}
                    className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 ${
                      isSelected
                        ? `bg-gradient-to-r ${gradient} text-white shadow-lg`
                        : "border border-white/10 bg-transparent text-gray-300 hover:bg-white/5 hover:text-white"
                    } ${onSelectStrainer ? "cursor-pointer" : "cursor-default"}`}
                    disabled={!onSelectStrainer}
                  >
                    <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                    <span>{option.id}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="p-5">{activeTabConfig?.content}</div>
    </div>
  );
};
const useDashboardData = () => {
  const [state] = useState(() => ({
    loading: false,
    error: null,
    summary: null,
    kpis: MOCK_KPI_PAYLOAD.items || [],
    explanation: MOCK_KPI_PAYLOAD.explanation || null,
    meta: MOCK_KPI_PAYLOAD.meta || null,
  }));
  return state;
};
export default function App() {
  const { loading, error, summary, kpis, explanation, meta } = useDashboardData();
  const [activeAssetKey, setActiveAssetKey] = useState("strainers");
  const assetConfig = ASSET_CONFIGS[activeAssetKey];
  const [assetMenuOpen, setAssetMenuOpen] = useState(false);
  const realAsset = useMemo(() => {
    if (activeAssetKey !== "strainers") return null;
    return createRealStrainer(kpis, explanation, meta);
  }, [activeAssetKey, kpis, explanation, meta]);
  const mockAssets = useMemo(() => assetConfig.generateMockData(6), [assetConfig]);
  const assetFleet = useMemo(() => {
    const base = [...mockAssets];
    if (realAsset) {
      return [realAsset, ...base];
    }
    return base;
  }, [mockAssets, realAsset]);
  const assetOptions = useMemo(() => ASSET_ORDER.map((key) => ASSET_CONFIGS[key]), []);
  const assetMenuRef = useRef(null);
  useEffect(() => {
    if (!assetMenuOpen) return;
    const handleClick = (event) => {
      if (!assetMenuRef.current) return;
      if (!assetMenuRef.current.contains(event.target)) {
        setAssetMenuOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setAssetMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keyup", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keyup", handleKey);
    };
  }, [assetMenuOpen]);
  const handleAssetSelect = (nextKey) => {
    setActiveAssetKey(nextKey);
    setAssetMenuOpen(false);
  };
  const AssetIcon = assetConfig?.icon ?? Filter;
  const heroTitle = assetConfig?.heroTitle ?? "Asset Command";
  const heroBadge = assetConfig?.heroBadge ?? "Live Feed";
  const heroTagline = assetConfig?.heroTagline ?? "Fleet performance dashboard";
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const filteredAssets = useMemo(() => {
    return assetFleet.filter((asset) => {
      const matchesFilter =
        activeFilter === "All" || asset.status.toLowerCase() === activeFilter.toLowerCase();
      const matchesSearch = searchTerm
        ? [asset.id, asset.location.unit, asset.location.pump]
            .join(" ")
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        : true;
      return matchesFilter && matchesSearch;
    });
  }, [assetFleet, activeFilter, searchTerm]);
  const selectedAsset = useMemo(() => {
    if (!selectedId) {
      return null;
    }
    return assetFleet.find((s) => s.id === selectedId) || null;
  }, [selectedId, assetFleet]);

  useEffect(() => {
    setActiveFilter("All");
    setSearchTerm("");
    setSelectedId(null);
  }, [activeAssetKey]);

  useEffect(() => {
    if (filteredAssets.length === 0) {
      if (selectedId !== null) {
        setSelectedId(null);
      }
      return;
    }
    if (!selectedId || !filteredAssets.some((asset) => asset.id === selectedId)) {
      setSelectedId(filteredAssets[0].id);
    }
  }, [filteredAssets, selectedId]);
  const fleetMetrics = useMemo(() => {
    const criticalCount = assetFleet.filter((s) => s.status === "alert").length;
    const warningCount = assetFleet.filter((s) => s.status === "warning").length;
    const maintenanceDue7d = assetFleet.filter((s) => s.trends.daysUntilCritical <= 7).length;
    const avgEfficiency = (
      assetFleet.reduce((acc, s) => acc + s.currentMetrics.efficiency, 0) /
      Math.max(assetFleet.length, 1)
    ).toFixed(1);
    const describeCountChange = (delta, basis) => {
      if (delta === 0) {
        return `No change ${basis}`;
      }
      const direction = delta > 0 ? "more" : "fewer";
      return `${Math.abs(delta)} ${direction} ${basis}`;
    };
    const criticalBaseline = meta?.alerts_fired ?? criticalCount;
    const criticalDelta = realAsset ? criticalCount - criticalBaseline : 0;
    const criticalTrend = {
      delta: criticalDelta,
      label: describeCountChange(criticalDelta, "vs last window"),
      isIncreasePositive: false,
    };
    const warningBaseline = Math.max(warningCount - 1, 0);
    const warningDelta = warningCount - warningBaseline;
    const warningTrend = {
      delta: warningDelta,
      label: describeCountChange(warningDelta, "vs last week"),
      isIncreasePositive: false,
    };
    const maintenanceDelta = 0;
    const maintenanceTrend = {
      delta: maintenanceDelta,
      label: describeCountChange(maintenanceDelta, "vs last week"),
      isIncreasePositive: false,
    };
    const efficiencyDelta = -0.9;
    const efficiencyTrend = {
      delta: efficiencyDelta,
      label:
        efficiencyDelta === 0
          ? "No change vs last week"
          : `${Math.abs(efficiencyDelta).toFixed(1)}% vs last week`,
      isIncreasePositive: true,
    };
    return {
      criticalCount,
      warningCount,
      maintenanceDue7d,
      avgEfficiency,
      criticalTrend,
      warningTrend,
      maintenanceTrend,
      efficiencyTrend,
    };
  }, [assetFleet, meta, realAsset]);
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-slate-950 to-black text-neutral-100">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-neutral-950/80 backdrop-blur-lg">
        <div className="flex w-full flex-wrap items-center justify-between gap-6 px-6 py-5 sm:px-8 lg:px-12">
          <div>
            <div className="flex items-center gap-3">
              <div className={`${ACCENT_GRADIENT} flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg`}>
                <AssetIcon size={24} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-gray-500">Jazan Refinery</p>
                <h1 className="text-2xl font-bold text-white">{heroTitle}</h1>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
              <span className={`${ACCENT_GRADIENT} rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white`}>
                {heroBadge}
              </span>
              <span>{heroTagline}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-300">
              <div className="relative" ref={assetMenuRef}>
                <button
                  type="button"
                  onClick={() => setAssetMenuOpen((prev) => !prev)}
                  className={`${GLASS_TILE} flex items-center gap-2 rounded-full px-4 py-2 font-semibold text-white transition`}
                >
                  <span>Assets</span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${assetMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {assetMenuOpen && (
                  <div className="absolute left-0 z-30 mt-2 w-60 rounded-2xl border border-white/10 bg-neutral-900/95 p-2 shadow-2xl">
                    {assetOptions.map((option) => {
                      const isActive = option.key === activeAssetKey;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => handleAssetSelect(option.key)}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                            isActive
                              ? "bg-white/10 text-white"
                              : "text-gray-300 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <span>{option.navLabel}</span>
                          {isActive && <CheckCircle size={16} className="text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="text-xs uppercase tracking-wide text-gray-400">
                Active:&nbsp;
                <span className="text-white">{assetConfig.pluralLabel || "Assets"}</span>
              </div>
            </div>
          </div>
          <div className={`flex items-center gap-4 text-sm ${GLASS_TILE} px-4 py-3`}>
            <div className="text-right">
              <div className="text-xs tracking-wide text-gray-400">Operator</div>
              <div className="font-semibold text-white">Ops Team</div>
            </div>
            <div className={`${ACCENT_GRADIENT} flex h-10 w-10 items-center justify-center rounded-full font-semibold text-white shadow-lg`}>
              OP
            </div>
          </div>
        </div>
      </header>
      <main className="flex w-full flex-col gap-6 px-6 py-6 sm:px-8 lg:px-12">
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Critical Alerts"
            value={fleetMetrics.criticalCount}
            icon={AlertTriangle}
            color="bg-red-500/30"
            trend={fleetMetrics.criticalTrend}
          />
          <KpiCard
            title="Warnings"
            value={fleetMetrics.warningCount}
            icon={Activity}
            color="bg-amber-500/30"
            trend={fleetMetrics.warningTrend}
          />
          <KpiCard
            title="Maintenance Due [7d]"
            value={fleetMetrics.maintenanceDue7d}
            icon={Wrench}
            color="bg-blue-500/30"
            trend={fleetMetrics.maintenanceTrend}
          />
          <KpiCard
            title="Avg Fleet Efficiency"
            value={`${fleetMetrics.avgEfficiency}%`}
            icon={TrendingUp}
            color="bg-emerald-500/30"
            trend={fleetMetrics.efficiencyTrend}
          />
        </section>
        {selectedAsset && (
          <section className="space-y-4">
            {assetConfig.key === "compressors" ? (
              <CompressorOverviewPanels compressor={selectedAsset} />
            ) : assetConfig.key === "pipelines" ? (
              <PipelineOverviewPanels pipeline={selectedAsset} />
            ) : (
              <StrainerOverviewPanels
                strainer={selectedAsset}
                strainerOptions={filteredAssets}
                selectedId={selectedId}
                onSelectStrainer={setSelectedId}
                assetConfig={assetConfig}
              />
            )}
          </section>
        )}
        <section className="flex min-h-[600px] flex-1 gap-6">
          <aside className={`flex min-h-0 w-full shrink-0 flex-col ${GLASS_CARD} p-5 text-sm lg:w-72 xl:w-80`}>
            <div className="text-lg font-semibold text-white">{assetConfig.fleetTitle || `${assetConfig.pluralLabel || "Asset"} Fleet`}</div>
            <div className="relative mt-4">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className={`w-full py-2.5 pl-10 pr-4 text-sm transition ${INPUT_BASE}`}
                placeholder={assetConfig.searchPlaceholder || "Search assets..."}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {["All", "Alert", "Warning", "Normal"].map((label) => (
                <button
                  key={label}
                  onClick={() => setActiveFilter(label)}
                  className={`${FILTER_PILL_BASE} ${
                    activeFilter === label
                      ? `${ACCENT_GRADIENT} text-white shadow-lg border-transparent`
                      : "bg-white/5 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  {label} ({
                    label === "All"
                      ? assetFleet.length
                      : assetFleet.filter((s) => s.status.toLowerCase() === label.toLowerCase()).length
                  })
                </button>
              ))}
            </div>
            <div className="mt-5 flex-1 space-y-3 overflow-y-auto pr-1">
              {filteredAssets.map((strainer) => (
                <StrainerCard
                  key={strainer.id}
                  strainer={strainer}
                  onSelect={setSelectedId}
                  isSelected={selectedId === strainer.id}
                  assetConfig={assetConfig}
                />
              ))}
              {filteredAssets.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
                  <XCircle size={36} />
                  <div className="text-sm font-semibold">{assetConfig.emptyStateTitle || "No assets found"}</div>
                  <div className="text-xs">{assetConfig.emptyStateSubtitle || "Try adjusting search or filters."}</div>
                </div>
              )}
            </div>
          </aside>
          <section className={`flex-1 ${GLASS_CARD}`}>
            <StrainerDetailView
              strainer={selectedAsset}
              summary={summary}
              liveKpis={kpis}
              liveExplanation={explanation}
              liveMeta={meta}
              fleet={assetFleet}
              assetConfig={assetConfig}
            />
          </section>
        </section>
      </main>
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 text-sm text-gray-200">
          Loading live data...
        </div>
      )}
    </div>
  );
}




















