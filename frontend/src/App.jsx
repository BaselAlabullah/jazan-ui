import React, { useEffect, useMemo, useState } from "react";
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
  Info,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  Line,
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

const resolveBackendBase = () => {
  const env = import.meta.env || {};
  if (env.VITE_BACKEND_URL) {
    return env.VITE_BACKEND_URL.replace(/\/$/, "");
  }
  const protocol = (env.VITE_BACKEND_PROTOCOL || (typeof window !== "undefined" ? window.location.protocol : "http:")).replace(/:?$/, ":");
  const host = env.VITE_BACKEND_HOST || (typeof window !== "undefined" ? window.location.hostname : "127.0.0.1");
  const port = env.VITE_BACKEND_PORT || "8100";
  return `${protocol}//${host}${port ? `:${port}` : ""}`;
};

const API_BASE = resolveBackendBase();
const buildApiUrl = (path) => {
  if (!path.startsWith("/")) {
    return `${API_BASE}/${path}`;
  }
  return `${API_BASE}${path}`;
};
const apiFetch = (path, options) => fetch(buildApiUrl(path), options);
const PSI_PER_MBAR = 0.0145038;
const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const psiFromMbar = (value) => Number((((value ?? 0) * PSI_PER_MBAR) + 12).toFixed(2));
const formatDate = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString();
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
      const dpAtPoint = baseDP + (daysSinceCleanAtPoint / 30) * dpIncrease * (0.8 + Math.random() * 0.4);
      const flowAtPoint = designFlowRate - Math.min(dpAtPoint - baseDP, 30) * 2;
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
    };
    return {
      ...strainer,
      metricTrends: deriveMetricTrendsForStrainer(strainer),
    };
  });
};
const RiskMatrix = ({ fleet = [], selected }) => {
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
                      title={`${count} strainer${count === 1 ? "" : "s"} in ${formatLabel(impact)} impact / ${formatLabel(prob)} probability`}
                    >
                      <div className="text-lg font-bold">{count}</div>
                      <div className="text-[10px] uppercase tracking-wide text-white/80">
                        {count === 1 ? "Strainer" : "Strainers"}
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
const createRealStrainer = (kpis, explanation, meta, summary) => {
  if (!kpis?.length) return null;
  const last = kpis[kpis.length - 1];
  const regime = last?.regime ?? "normal";
  const riskBand = last?.risk_band ?? "medium";
  const statusMap = { high: "alert", medium: "warning", low: "normal" };
  const status = statusMap[riskBand] ?? "normal";
  const severity = status === "alert" ? "critical" : status === "warning" ? "warning" : "info";
  const dpPsi = psiFromMbar(last?.dp_excess_mbar ?? 0);
  const designFlow = 900;
  const probability = Number(last?.prob_breach7d ?? 0.4);
  const rawProbability = Number(last?.prob_breach7d_raw ?? probability);
  const flowRate = clamp(designFlow * (1 - probability / 1.5), 450, designFlow);
  const efficiency = clamp(100 - probability * 55, 62, 98);
  const historicalData = kpis.slice(-30).map((row) => ({
    date: new Date(row.ts).toISOString().split("T")[0],
    dp: psiFromMbar(row.dp_excess_mbar ?? last.dp_excess_mbar ?? 0),
    flowRate: clamp(designFlow * (1 - (row.prob_breach7d ?? probability) / 1.5), 450, designFlow),
    efficiency: clamp(100 - (row.prob_breach7d ?? probability) * 55, 62, 98),
  }));
  const baselineDP = historicalData.reduce((acc, entry) => acc + entry.dp, 0) / (historicalData.length || 1);
  const daysSinceClean = Math.max(3, Math.round((meta?.alerts_fired ?? 0) * 4 + 6));
  const dpRate = historicalData.length > 1
    ? ((historicalData[historicalData.length - 1].dp - historicalData[0].dp) /
        Math.max(daysSinceClean, 1))
    : 0.32;
  const boundedDpRate = Number(clamp(dpRate, 0.18, 0.9).toFixed(3));
  const daysUntilCritical = Math.max(1, Math.round((30 - dpPsi) / Math.max(boundedDpRate, 0.2)));
  const projectedPlugDate = new Date(Date.now() + daysUntilCritical * 24 * 60 * 60 * 1000);
  const nextCleanDue = new Date(Date.now() + Math.max(1, 32 - daysSinceClean) * 24 * 60 * 60 * 1000);
    const rootCauseAnalysis = buildRootCauseAnalysis(
      explanation,
      last,
      dpPsi,
      flowRate,
    efficiency,
    daysSinceClean,
  );
  const cleaningHistory = Array.from({ length: 3 }, (_, idx) => {
    const spread = 25 + idx * 6 + Math.random() * 3;
    const date = new Date(Date.now() - spread * 24 * 60 * 60 * 1000);
    return {
      date: date.toISOString().split("T")[0],
      dpBefore: Number((baselineDP + idx * 2.4 + 4).toFixed(2)),
      dpAfter: Number((baselineDP - 2 + idx).toFixed(2)),
      downtime: (2 + Math.random() * 3).toFixed(1),
      debrisType: randomChoice(["Sand/Silt", "Corrosion Products", "Scale", "Polymer Residue"]),
    };
  }).reverse();
  const actions = explanation?.actions?.length
    ? explanation.actions
    : [
        "Maintain current monitoring cadence; escalate if persistence triggers.",
        "Verify differential-pressure instrumentation health.",
        "Cross-check upstream separation efficiency.",
      ];
  const probabilityLevel = probabilityLevelFromValue(probability);
  const impactLevel = impactLevelFromSignal(riskBand, dpPsi);
    const riskAnalysis = {
      probability: probabilityLevel,
      impact: impactLevel,
      riskScore: riskScoreFromLevels(probabilityLevel, impactLevel),
    mitigationActions: actions,
  };
  const causalityAnalysis = {
    problemStatement: `Elevated DP (${dpPsi.toFixed(2)} psi) on strainer STR-REAL`,
    fiveWhys: buildFiveWhys(explanation),
  };
  const supplierInfo = {
    elementSupplier: "FlowGuard Inc.",
    meshSize: 150,
    material: "316 SS",
    lastInspectionDate: new Date(Date.now() - 310 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    meanTimeToFailure: "9.5 months",
  };
   const installationDate = new Date(Date.now() - (3 + Math.random() * 5) * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const lifecycleInfo = {
        installationDate,
        lastOverhaulDate: new Date(new Date(installationDate).getTime() + (2 + Math.random()) * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        endOfLifeDate: new Date(new Date(installationDate).getTime() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    };
  const alertDetails = {
    severity,
    message:
      status === "alert"
        ? "Critical: DP trend breaching regime threshold"
        : status === "warning"
        ? "Warning: DP trend rising faster than baseline"
        : "Operating within expected thresholds",
    acknowledged: false,
    acknowledgedBy: null,
    acknowledgedAt: null,
  };
  const strainer = {
    id: "STR-REAL",
    isReal: true,
    location: {
      unit: "Jazan Refinery POC",
      pump: regime === "low_load" ? "Recycle Gas Compressor K-5201" : "Feed Pump P-1051A",
      position: regime === "shutdown" ? "Offline" : "Suction",
    },
    status,
    severity,
    riskBand,
    rootCauseAnalysis,
    currentMetrics: {
      differentialPressure: Number(dpPsi.toFixed(2)),
      flowRate: Number(flowRate.toFixed(0)),
      efficiency: Number(efficiency.toFixed(1)),
      designFlowRate: designFlow,
    },
    trends: {
      daysSinceClean,
      nextCleanDue: nextCleanDue.toISOString().split("T")[0],
      projectedPlugDate: projectedPlugDate.toISOString().split("T")[0],
      daysUntilCritical,
      dpRate: boundedDpRate,
      baselineDP: Number(baselineDP.toFixed(2)),
    },
    historicalData,
    cleaningHistory,
    alertDetails,
    supplierInfo,
    riskAnalysis,
    causalityAnalysis,
    lifecycleInfo,
    guidance: explanation,
    recentEvents: kpis.slice(-40),
    probability,
    rawProbability,
  };
  return {
    ...strainer,
    metricTrends: deriveMetricTrendsForStrainer(strainer),
  };
};
const StrainerCard = ({ strainer, onSelect, isSelected }) => {
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
          <div className="uppercase tracking-wide text-gray-500">DP</div>
          <div className="font-semibold text-white">
            {strainer.currentMetrics.differentialPressure.toFixed(2)} psi
          </div>
        </div>
        <div>
          <div className="uppercase tracking-wide text-gray-500">Flow</div>
          <div className="font-semibold text-white">
            {strainer.currentMetrics.flowRate.toFixed(0)} bbl/d
          </div>
        </div>
        <div>
          <div className="uppercase tracking-wide text-gray-500">Efficiency</div>
          <div className="font-semibold text-white">
            {strainer.currentMetrics.efficiency.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="uppercase tracking-wide text-gray-500">Since clean</div>
          <div className="font-semibold text-white">{strainer.trends.daysSinceClean} d</div>
        </div>
      </div>
    </div>
  );
};

const AccordionItem = ({ title, icon: Icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className={`overflow-hidden ${GLASS_CARD}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-t-3xl bg-transparent p-5 text-left text-lg font-semibold text-white transition-colors hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <div className={`${ACCENT_GRADIENT} flex h-10 w-10 items-center justify-center rounded-2xl text-white`}>
            <Icon size={20} />
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

const GuidanceCard = ({ guidance }) => {
  if (!guidance) return null;
  return (
    <div className={`${GLASS_CARD} bg-gradient-to-br from-indigo-500/10 via-slate-900/40 to-emerald-500/10 p-6`}>
      <div className="flex items-start gap-3">
        <div className={`${ACCENT_GRADIENT} rounded-2xl p-2.5 text-white shadow-lg`}>
          <Info size={18} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold uppercase tracking-wide text-indigo-100">
            Operator Guidance
          </div>
          <div className="mt-3 grid gap-6 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-100">
                Why the model flagged risk
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-indigo-50">
                {(guidance.reasons ?? ["DP trend is rising versus regime-adjusted threshold."]).map((reason, idx) => (
                  <li key={`reason-${idx}`}>{reason}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-100">
                Suggested actions
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-indigo-50">
                {(guidance.actions ?? ["Continue monitoring and follow refinery checklist if persistence increases."]).map(
                  (action, idx) => (
                    <li key={`action-${idx}`}>{action}</li>
                  ),
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
const StrainerDetailView = ({ strainer, summary, liveKpis, liveExplanation, liveMeta, fleet = [] }) => {
  const hasLive = Boolean(strainer?.isReal);
  const REGIMES = ["normal", "post_startup", "low_load", "shutdown"];
  const defaultMultipliers = summary?.regime_threshold_multipliers ?? {
    normal: 1.4,
    post_startup: 1.6,
    low_load: 1.7,
    shutdown: 1.8,
  };
  const [baseThreshold, setBaseThreshold] = useState(summary?.base_threshold ?? 0.25);
  const [persistK, setPersistK] = useState(summary?.persistence_k ?? 5);
  const [cooldownHours, setCooldownHours] = useState(summary?.cooldown_hours ?? 48);
  const [multipliers, setMultipliers] = useState(defaultMultipliers);
  const [liveItems, setLiveItems] = useState(strainer?.recentEvents ?? liveKpis ?? []);
  const [liveExplanationState, setLiveExplanationState] = useState(strainer?.guidance ?? liveExplanation ?? null);
  const [liveMetaState, setLiveMetaState] = useState(liveMeta ?? null);
  const [livePending, setLivePending] = useState(false);
  const [liveError, setLiveError] = useState(null);

  useEffect(() => {
    if (!hasLive) return;
    const defaults = summary?.regime_threshold_multipliers ?? defaultMultipliers;
    setBaseThreshold(summary?.base_threshold ?? 0.25);
    setPersistK(summary?.persistence_k ?? 5);
    setCooldownHours(summary?.cooldown_hours ?? 48);
    setMultipliers(defaults);
    setLiveItems(strainer?.recentEvents ?? liveKpis ?? []);
    setLiveExplanationState(strainer?.guidance ?? liveExplanation ?? null);
    setLiveMetaState(liveMeta ?? null);
  }, [hasLive, strainer?.id, summary, liveKpis, liveExplanation, liveMeta]);
  useEffect(() => {
    if (!hasLive) return;
    if (!strainer) return;
    const controller = new AbortController();
    setLivePending(true);
    setLiveError(null);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          base_thr: baseThreshold.toString(),
          persist_k: persistK.toString(),
          cooldown_h: cooldownHours.toString(),
          m_normal: multipliers.normal.toString(),
          m_post: multipliers.post_startup.toString(),
          m_low: multipliers.low_load.toString(),
          m_shut: multipliers.shutdown.toString(),
        });
        const resp = await apiFetch(`/api/kpis?${params.toString()}`, { signal: controller.signal });
        if (!resp.ok) {
          throw new Error(`Failed to load tuned KPIs (${resp.status})`);
        }
        const payload = await resp.json();
        if (controller.signal.aborted) return;
        setLiveItems(payload.items || []);
        setLiveExplanationState(payload.explanation || null);
        setLiveMetaState(payload.meta || null);
        setLiveError(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLiveError(error.message || "Failed to load tuned KPIs.");
      } finally {
        if (!controller.signal.aborted) {
          setLivePending(false);
        }
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    hasLive,
    strainer,
    baseThreshold,
    persistK,
    cooldownHours,
    multipliers.normal,
    multipliers.post_startup,
    multipliers.low_load,
    multipliers.shutdown,
  ]);
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

  if (!strainer) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-2xl text-gray-500">
        Select a strainer to view its diagnostics
      </div>
    );
  }
  const statusBadgeColors = {
    alert: "bg-red-600",
    warning: "bg-yellow-500",
    normal: "bg-emerald-500",
  };
  const metricTrends = useMemo(() => {
    if (!strainer) return {};
    if (strainer.metricTrends) return strainer.metricTrends;
    return deriveMetricTrendsForStrainer(strainer);
  }, [strainer]);
  const dpTrendMeta = metricTrends.differentialPressure;
  const flowTrendMeta = metricTrends.flowRate;
  const efficiencyTrendMeta = metricTrends.efficiency;
  const daysSinceCleanTrendMeta = metricTrends.daysSinceClean;
  const dpRateTrendMeta = metricTrends.dpRate;
  const currentRiskColor = riskColorFor(strainer.riskAnalysis.impact, strainer.riskAnalysis.probability);
  const recentEvents = strainer.recentEvents ?? [];
  const latestLive = liveItems.length ? liveItems[liveItems.length - 1] : null;
  const hasFleetSummary = Boolean(fleetRiskSummary);
  const liveProbabilityTrend = (() => {
    if (!latestLive || latestLive.threshold_eff === undefined || latestLive.threshold_eff === null) {
      return null;
    }
    const delta = Number(latestLive.prob_breach7d) - Number(latestLive.threshold_eff);
    if (!Number.isFinite(delta)) {
      return null;
    }
    const normalizedDelta = Math.abs(delta) < 0.005 ? 0 : delta;
    return {
      delta: normalizedDelta,
      isIncreasePositive: false,
      label:
        normalizedDelta === 0
          ? "At threshold"
          : normalizedDelta > 0
          ? `${Math.abs(delta).toFixed(2)} over threshold`
          : `${Math.abs(delta).toFixed(2)} under threshold`,
      precision: 2,
      suffix: "", 
      noChangeLabel: "At threshold",
    };
  })();
  return (
    <div className="h-full overflow-y-auto rounded-3xl bg-transparent p-6">
      <div className="flex items-start justify-between border-b border-white/10 pb-4">
        <div>
          <div className="text-3xl font-extrabold text-white">{strainer.id}</div>
          <div className="mt-2 text-sm text-gray-400">
            {`${strainer.location.unit} \u00B7 ${strainer.location.pump} (${strainer.location.position})`}
          </div>
        </div>
        <span
          className={`rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white ${
            statusBadgeColors[strainer.status] || statusBadgeColors.normal
          }`}
        >
          {strainer.status === "alert" ? "Alert" : strainer.status === "warning" ? "Warning" : "Normal"}
        </span>
      </div>

      <div className="mt-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricDisplay
              icon={Gauge}
              label="Differential Pressure"
              value={strainer.currentMetrics.differentialPressure.toFixed(2)}
              unit="psi"
              trend={dpTrendMeta}
            />
            <MetricDisplay
              icon={Droplets}
              label="Flow Rate"
              value={strainer.currentMetrics.flowRate.toFixed(0)}
              unit="bbl/d"
              trend={flowTrendMeta}
            />
            <MetricDisplay
              icon={TrendingUp}
              label="Efficiency"
              value={strainer.currentMetrics.efficiency.toFixed(1)}
              unit="%"
              trend={efficiencyTrendMeta}
            />
            <MetricDisplay
              icon={Clock}
              label="Days Since Clean"
              value={strainer.trends.daysSinceClean}
              unit="days"
              trend={daysSinceCleanTrendMeta}
            />
            <MetricDisplay
              icon={Activity}
              label="DP Rate"
              value={strainer.trends.dpRate.toFixed(2)}
              unit="psi/day"
              trend={dpRateTrendMeta}
            />
            <MetricDisplay
              icon={Zap}
              label="Design Flow"
              value={strainer.currentMetrics.designFlowRate}
              unit="bbl/d"
            />
        </div>
      </div>
      <div className="my-10 space-y-4">
        <RiskMatrix fleet={fleet} selected={strainer} />
        {hasFleetSummary && (
          <div className={`${GLASS_TILE} p-4`}>
            <div className="text-sm font-semibold text-white">Matrix Overview</div>
            <p className="mt-2 text-xs leading-relaxed text-gray-300">
              {strainer.id} sits in the{" "}
              <span className="text-sky-300">
                {fleetRiskSummary.selectedImpact} impact / {fleetRiskSummary.selectedProbability} probability
              </span>{" "}
              cell alongside {fleetRiskSummary.sameCellCount}{" "}
              {fleetRiskSummary.sameCellCount === 1 ? "peer" : "peers"} across the fleet. The densest cluster is{" "}
              <span className="text-emerald-300">
                {fleetRiskSummary.dominantImpact} impact / {fleetRiskSummary.dominantProbability} probability
              </span>{" "}
              with {fleetRiskSummary.dominantCount} {fleetRiskSummary.dominantCount === 1 ? "asset" : "assets"}.
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

      <div className="mt-6 space-y-4">
        {hasLive && (
             <AccordionItem title="Live KPI Tuning & Simulation" icon={CheckCircle} defaultOpen>
                <div className="space-y-6">
                    <GuidanceCard guidance={liveExplanationState} />
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <MetricDisplay
                          icon={AlertTriangle}
                          label="Live Probability"
                          value={latestLive ? Number(latestLive.prob_breach7d).toFixed(2) : "-"}
                          trend={liveProbabilityTrend}
                        />
                        <MetricDisplay
                          icon={Gauge}
                          label="Threshold (eff.)"
                          value={latestLive ? Number(latestLive.threshold_eff).toFixed(2) : "-"}
                        />
                        <MetricDisplay
                          icon={TrendingUp}
                          label="Risk Band"
                          value={latestLive ? latestLive.risk_band?.toUpperCase() : "-"}
                        />
                        <MetricDisplay
                          icon={Activity}
                          label="Datapoints"
                          value={liveItems.length}
                          unit="pts"
                        />
                    </div>
                    <div className="grid gap-6 lg:grid-cols-[minmax(260px,320px),1fr]">
                        <div className={`${GLASS_TILE} p-4`}>
                        <div className="text-sm font-semibold text-white">Alert Tuning</div>
                        <div className="mt-4 space-y-4 text-sm text-gray-200">
                            <div>
                            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-gray-400">
                                <span>Base threshold</span>
                                <span>{baseThreshold.toFixed(2)}</span>
                            </div>
                            <input
                                type="range"
                                min={0.02}
                                max={1}
                                step={0.01}
                                value={baseThreshold}
                                onChange={(event) => setBaseThreshold(parseFloat(event.target.value))}
                                className="w-full accent-sky-400"
                            />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-xs uppercase tracking-wide text-gray-400">Persistence k</div>
                                <input
                                type="number"
                                min={1}
                                max={48}
                                value={persistK}
                                onChange={(event) => {
                                    const next = parseInt(event.target.value, 10);
                                    if (Number.isNaN(next)) return;
                                    setPersistK(clamp(next, 1, 48));
                                }}
                                className={`mt-1 w-full px-3 py-2 ${INPUT_BASE}`}
                                />
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-gray-400">Cooldown (h)</div>
                                <input
                                type="number"
                                min={1}
                                max={168}
                                step={6}
                                value={cooldownHours}
                                onChange={(event) => {
                                    const next = parseInt(event.target.value, 10);
                                    if (Number.isNaN(next)) return;
                                    setCooldownHours(clamp(next, 1, 168));
                                }}
                                className={`mt-1 w-full px-3 py-2 ${INPUT_BASE}`}
                                />
                            </div>
                            </div>
                            <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">Regime multipliers</div>
                            <div className="mt-2 space-y-2">
                                {REGIMES.map((key) => (
                                <div key={key} className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: regimeColor(key) }} />
                                    <span className="capitalize">{key.replace("_", " ")}</span>
                                    </div>
                                    <input
                                    type="number"
                                    step={0.05}
                                    min={0.5}
                                    max={2}
                                    value={multipliers[key]}
                                    onChange={(event) => {
                                        const value = parseFloat(event.target.value);
                                        if (Number.isNaN(value)) return;
                                        setMultipliers((prev) => ({
                                        ...prev,
                                        [key]: clamp(value, 0.5, 2),
                                        }));
                                    }}
                                    className={`w-24 px-2 py-1.5 text-right ${INPUT_BASE}`}
                                    />
                                </div>
                                ))}
                            </div>
                            </div>
                            {liveMetaState && (
                            <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
                                <div>
                                <div className="uppercase tracking-wide">Window</div>
                                <div className="text-white">{liveMetaState.points ?? liveItems.length} pts</div>
                                </div>
                                <div>
                                <div className="uppercase tracking-wide">Alerts fired</div>
                                <div className="text-white">{liveMetaState.alerts_fired ?? 0}</div>
                                </div>
                                <div>
                                <div className="uppercase tracking-wide">High risk</div>
                                <div className="text-white">{liveMetaState.risk_band_counts?.high ?? 0}</div>
                                </div>
                                <div>
                                <div className="uppercase tracking-wide">Medium risk</div>
                                <div className="text-white">{liveMetaState.risk_band_counts?.medium ?? 0}</div>
                                </div>
                            </div>
                            )}
                            {livePending && <div className="text-xs text-sky-200">Updating view...</div>}
                            {liveError && <div className="text-xs text-red-300">{liveError}</div>}
                        </div>
                        </div>
                        <div className={`${GLASS_TILE} p-5`}>
                        <div className="text-lg font-semibold text-white">Live Probability vs Threshold</div>
                        <div className="mt-4 h-[320px]">
                            <ResponsiveContainer>
                            <AreaChart data={liveItems}>
                                <defs>
                                <linearGradient id="liveProbGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.6} />
                                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                                </linearGradient>
                                </defs>
                                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis
                                dataKey="ts"
                                stroke="#9ca3af"
                                fontSize={12}
                                tickFormatter={(value) => new Date(value).toLocaleDateString()}
                                />
                                <YAxis stroke="#9ca3af" fontSize={12} domain={[0, 1]} />
                                <Tooltip
                                contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }}
                                labelFormatter={(value) => new Date(value).toLocaleString()}
                                formatter={(value, key) => {
                                    if (key === "prob_breach7d") return [Number(value).toFixed(2), "Probability"];
                                    if (key === "threshold_eff") return [Number(value).toFixed(2), "Threshold"];
                                    return [value, key];
                                }}
                                />
                                <Area
                                type="monotone"
                                dataKey="prob_breach7d"
                                name="P(breach in 7d)"
                                stroke="#38bdf8"
                                strokeWidth={2}
                                fill="url(#liveProbGradient)"
                                />
                                <Line
                                type="monotone"
                                dataKey="threshold_eff"
                                name="Effective threshold"
                                stroke="#fbbf24"
                                strokeDasharray="5 4"
                                strokeWidth={2}
                                dot={false}
                                />
                                <ReferenceLine y={baseThreshold} stroke="#22c55e" strokeDasharray="3 3" label={{ value: "Base", fill: "#22c55e", fontSize: 12 }} />
                            </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        </div>
                    </div>
                </div>
            </AccordionItem>
        )}
         <div className="hidden">
          <AccordionItem title="Performance Trends" icon={TrendIcon} defaultOpen={!hasLive}>
             <div className={`${GLASS_TILE} p-5`}>
                <div className="text-lg font-semibold text-white">DP Trend (Last 30 Days)</div>
                <div className="mt-4 h-[320px]">
                <ResponsiveContainer>
                    <AreaChart data={strainer.historicalData}>
                    <defs>
                        <linearGradient id="dpGradient" x1="0" y1="0" x2="0" y2="1">
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
                        label={{ value: "DP (psi)", angle: -90, position: "insideLeft", fill: "#9ca3af" }}
                    />
                    <Tooltip
                        contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }}
                        labelStyle={{ color: "#e5e7eb" }}
                        formatter={(value, key) => {
                        if (key === "dp") return [`${value.toFixed(2)} psi`, "DP"];
                        if (key === "flowRate") return [`${value.toFixed(0)} bbl/d`, "Flow"];
                        if (key === "efficiency") return [`${value.toFixed(1)}%`, "Efficiency"];
                        return [value, key];
                        }}
                    />
                    <ReferenceLine y={18} stroke="#fbbf24" strokeDasharray="3 3" label={{ value: "Warning", fill: "#fbbf24", fontSize: 12 }} />
                    <ReferenceLine y={25} stroke="#f87171" strokeDasharray="3 3" label={{ value: "Critical", fill: "#f87171", fontSize: 12 }} />
                    <Area type="monotone" dataKey="dp" stroke="#8b5cf6" strokeWidth={2} fill="url(#dpGradient)" />
                    </AreaChart>
                </ResponsiveContainer>
                </div>
            </div>
          </AccordionItem>
          <AccordionItem title="Insights" icon={BrainCircuit}>
            <div className="space-y-4">
                 <AccordionItem title="Root Cause Analysis (RCA)" icon={FileText}>
                     <div className="prose prose-invert max-w-none text-sm text-gray-200">
                        {strainer.rootCauseAnalysis.split("\n").map((line, idx) => {
                        if (line.startsWith("**") && line.endsWith("**")) {
                            return (
                            <h4 key={`rca-heading-${idx}`} className="text-base font-bold text-blue-300">
                                {line.replace(/\*\*/g, "")}
                            </h4>
                            );
                        }
                        if (/^\d+\./.test(line)) {
                            return (
                            <p key={`rca-line-${idx}`} className="ml-4 text-gray-200">
                                {line}
                            </p>
                            );
                        }
                        if (line.startsWith("-")) {
                            return (
                            <p key={`rca-bullet-${idx}`} className="ml-6 text-gray-200">
                                {line}
                            </p>
                            );
                        }
                        if (line.trim()) {
                            return (
                            <p key={`rca-text-${idx}`} className="text-gray-200">
                                {line}
                            </p>
                            );
                        }
                        return <br key={`rca-break-${idx}`} />;
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
                            <li key={`action-${idx}`}>{action}</li>
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
                        <div key={`why-${idx}`} className="border-l-2 border-white/20 pl-4">
                            <div className="text-sm font-semibold text-blue-300">{item.why}</div>
                            <div className="text-sm text-gray-200">{`\u279C ${item.because}`}</div>
                        </div>
                        ))}
                    </div>
                 </AccordionItem>
            </div>
          </AccordionItem>
          <AccordionItem title="Lifecycle Phase" icon={Calendar}>
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
                    <div className="p-4 text-sm font-semibold text-white">Cleaning History</div>
                     <table className="min-w-full text-xs">
                        <thead className="bg-white/5 text-gray-400">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium">Date</th>
                                <th className="px-4 py-2 text-left font-medium">DP Before</th>
                                <th className="px-4 py-2 text-left font-medium">DP After</th>
                                <th className="px-4 py-2 text-left font-medium">Downtime (hrs)</th>
                                <th className="px-4 py-2 text-left font-medium">Debris Type</th>
                            </tr>
                        </thead>
                         <tbody className="text-gray-200">
                            {strainer.cleaningHistory.map((event, idx) => (
                                <tr key={idx} className="border-t border-white/10">
                                    <td className="px-4 py-2">{formatDate(event.date)}</td>
                                    <td className="px-4 py-2 text-red-300">{event.dpBefore.toFixed(2)} psi</td>
                                    <td className="px-4 py-2 text-emerald-300">{event.dpAfter.toFixed(2)} psi</td>
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
          </AccordionItem>
        </div>
      </div>
    </div>
  );
};
const StrainerOverviewPanels = ({ strainer, strainerOptions = [], selectedId, onSelectStrainer }) => {
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

  const overviewTabs = [
    {
      key: "performance",
      title: "Performance Trends",
      icon: TrendIcon,
      content: (
        <div className={`${GLASS_TILE} p-5`}>
          <div className="text-lg font-semibold text-white">DP Trend (Last 30 Days)</div>
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
                  label={{ value: "DP (psi)", angle: -90, position: "insideLeft", fill: "#9ca3af" }}
                />
                <Tooltip
                  contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }}
                  labelStyle={{ color: "#e5e7eb" }}
                  formatter={(value, key) => {
                    if (key === "dp") return [`${value.toFixed(2)} psi`, "DP"];
                    if (key === "flowRate") return [`${value.toFixed(0)} bbl/d`, "Flow"];
                    if (key === "efficiency") return [`${value.toFixed(1)}%`, "Efficiency"];
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
            <div className="p-4 text-sm font-semibold text-white">Cleaning History</div>
            <table className="min-w-full text-xs">
              <thead className="bg-white/5 text-gray-400">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-left font-medium">DP Before</th>
                  <th className="px-4 py-2 text-left font-medium">DP After</th>
                  <th className="px-4 py-2 text-left font-medium">Downtime (hrs)</th>
                  <th className="px-4 py-2 text-left font-medium">Debris Type</th>
                </tr>
              </thead>
              <tbody className="text-gray-200">
                {strainer.cleaningHistory.map((event, idx) => (
                  <tr key={`cleaning-top-${idx}`} className="border-t border-white/10">
                    <td className="px-4 py-2">{formatDate(event.date)}</td>
                    <td className="px-4 py-2 text-red-300">{event.dpBefore.toFixed(2)} psi</td>
                    <td className="px-4 py-2 text-emerald-300">{event.dpAfter.toFixed(2)} psi</td>
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
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">Strainers</span>
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
  const [state, setState] = useState({
    loading: true,
    error: null,
    summary: null,
    kpis: [],
    explanation: null,
    meta: null,
  });
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let summary = null;
      let payload = MOCK_KPI_PAYLOAD;
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
          const summaryResp = await apiFetch("/api/summary");
          if (summaryResp.ok) {
            summary = await summaryResp.json();
          }
        } catch (err) {
          // summary optional for showcase
        }
        try {
          const kpiResp = await apiFetch("/api/kpis");
          if (kpiResp.ok) {
            payload = await kpiResp.json();
          } else if (kpiResp.status !== 404) {
            throw new Error(`Failed to load KPI data (${kpiResp.status})`);
          }
        } catch (err) {
          if (err?.message?.includes("Failed to load KPI data")) {
            throw err;
          }
          // network failure or other fetch issue; fall back to mock payload
        }
        if (cancelled) return;
        setState({
          loading: false,
          error: null,
          summary,
          kpis: payload.items || [],
          explanation: payload.explanation || null,
          meta: payload.meta || null,
        });
      } catch (error) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error?.message || "Failed to load dashboard data.",
          summary: summary ?? prev.summary,
          kpis: payload.items || [],
          explanation: payload.explanation || null,
          meta: payload.meta || null,
        }));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
};
export default function App() {
  const { loading, error, summary, kpis, explanation, meta } = useDashboardData();
  const realStrainer = useMemo(() => createRealStrainer(kpis, explanation, meta, summary), [kpis, explanation, meta, summary]);
  const mockStrainers = useMemo(() => generateMockStrainerData(6), []);
  const strainerFleet = useMemo(() => {
    const base = [...mockStrainers];
    if (realStrainer) {
      return [realStrainer, ...base];
    }
    return base;
  }, [mockStrainers, realStrainer]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const filteredStrainers = useMemo(() => {
    return strainerFleet.filter((strainer) => {
      const matchesFilter =
        activeFilter === "All" || strainer.status.toLowerCase() === activeFilter.toLowerCase();
      const matchesSearch = searchTerm
        ? [strainer.id, strainer.location.unit, strainer.location.pump]
            .join(" ")
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        : true;
      return matchesFilter && matchesSearch;
    });
  }, [strainerFleet, activeFilter, searchTerm]);
  const selectedStrainer = useMemo(() => {
    if (!selectedId) {
      return null;
    }
    return strainerFleet.find((s) => s.id === selectedId) || null;
  }, [selectedId, strainerFleet]);

  useEffect(() => {
    if (filteredStrainers.length === 0) {
      if (selectedId !== null) {
        setSelectedId(null);
      }
      return;
    }
    if (!selectedId || !filteredStrainers.some((strainer) => strainer.id === selectedId)) {
      setSelectedId(filteredStrainers[0].id);
    }
  }, [filteredStrainers, selectedId]);
  const fleetMetrics = useMemo(() => {
    const criticalCount = strainerFleet.filter((s) => s.status === "alert").length;
    const warningCount = strainerFleet.filter((s) => s.status === "warning").length;
    const maintenanceDue7d = strainerFleet.filter((s) => s.trends.daysUntilCritical <= 7).length;
    const avgEfficiency = (
      strainerFleet.reduce((acc, s) => acc + s.currentMetrics.efficiency, 0) /
      Math.max(strainerFleet.length, 1)
    ).toFixed(1);
    const describeCountChange = (delta, basis) => {
      if (delta === 0) {
        return `No change ${basis}`;
      }
      const direction = delta > 0 ? "more" : "fewer";
      return `${Math.abs(delta)} ${direction} ${basis}`;
    };
    const criticalBaseline = meta?.alerts_fired ?? criticalCount;
    const criticalDelta = realStrainer ? criticalCount - criticalBaseline : 0;
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
  }, [strainerFleet, meta, realStrainer]);
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-slate-950 to-black text-neutral-100">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-neutral-950/80 backdrop-blur-lg">
        <div className="flex w-full flex-wrap items-center justify-between gap-6 px-6 py-5 sm:px-8 lg:px-12">
          <div>
            <div className="flex items-center gap-3">
              <div className={`${ACCENT_GRADIENT} flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg`}>
                <Filter size={24} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-gray-500">Jazan Refinery</p>
                <h1 className="text-2xl font-bold text-white">Strainer Monitoring Command</h1>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
              <span className={`${ACCENT_GRADIENT} rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white`}>
                Live Feed
              </span>
              <span>Refinery-wide strainer performance dashboard</span>
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
        {selectedStrainer && (
          <section className="space-y-4">
            <StrainerOverviewPanels
              strainer={selectedStrainer}
              strainerOptions={filteredStrainers}
              selectedId={selectedId}
              onSelectStrainer={setSelectedId}
            />
          </section>
        )}
        <section className="flex min-h-[600px] flex-1 gap-6">
          <aside className={`flex min-h-0 w-full shrink-0 flex-col ${GLASS_CARD} p-5 text-sm lg:w-72 xl:w-80`}>
            <div className="text-lg font-semibold text-white">Strainer Fleet</div>
            <div className="relative mt-4">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className={`w-full py-2.5 pl-10 pr-4 text-sm transition ${INPUT_BASE}`}
                placeholder="Search by ID, unit, pump..."
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
                      ? strainerFleet.length
                      : strainerFleet.filter((s) => s.status.toLowerCase() === label.toLowerCase()).length
                  })
                </button>
              ))}
            </div>
            <div className="mt-5 flex-1 space-y-3 overflow-y-auto pr-1">
              {filteredStrainers.map((strainer) => (
                <StrainerCard
                  key={strainer.id}
                  strainer={strainer}
                  onSelect={setSelectedId}
                  isSelected={selectedId === strainer.id}
                />
              ))}
              {filteredStrainers.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
                  <XCircle size={36} />
                  <div className="text-sm font-semibold">No Strainers Found</div>
                  <div className="text-xs">Try adjusting search or filters.</div>
                </div>
              )}
            </div>
          </aside>
          <section className={`flex-1 ${GLASS_CARD}`}>
            <StrainerDetailView
              strainer={selectedStrainer}
              summary={summary}
              liveKpis={kpis}
              liveExplanation={explanation}
              liveMeta={meta}
              fleet={strainerFleet}
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
















