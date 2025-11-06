from pathlib import Path
ROOT_DIR = Path(__file__).resolve().parents[1]
path = ROOT_DIR / "frontend" / "src" / "App.jsx"
text = path.read_text()
start = text.index('  return (')
marker = '\n};\nconst useDashboardData'
end = text.index(marker, start)
new_return = """
  return (
    <div className="h-full overflow-y-auto bg-slate-950/40 p-6">
      <div className="flex items-start justify-between border-b border-white/10 pb-4">
        <div>
          <div className="text-3xl font-extrabold text-white">{strainer.id}</div>
          <div className="mt-2 text-sm text-gray-400">
            {strainer.location.unit} � {strainer.location.pump} ({strainer.location.position})
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

      <div className="mt-6 space-y-4">
        <AccordionSection
          id="kpis"
          title="KPIs"
          subtitle="Live metrics and trend outlook"
          icon={Activity}
          isOpen={openSections.kpis}
          onToggle={handleToggleSection}
        >
          {hasLive && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricDisplay
                  icon={<AlertTriangle size={18} className="text-red-300" />}
                  label="Live Probability"
                  value={latestLive ? Number(latestLive.prob_breach7d).toFixed(2) : "-"}
                  unit=""
                  trend={
                    latestLive && latestLive.threshold_eff
                      ? latestLive.prob_breach7d >= latestLive.threshold_eff
                        ? " Above threshold"
                        : " Below threshold"
                      : undefined
                  }
                />
                <MetricDisplay
                  icon={<Gauge size={18} className="text-emerald-300" />}
                  label="Threshold (eff.)"
                  value={latestLive ? Number(latestLive.threshold_eff).toFixed(2) : "-"}
                  unit=""
                />
                <MetricDisplay
                  icon={<TrendingUp size={18} className="text-blue-300" />}
                  label="Risk Band"
                  value={latestLive ? latestLive.risk_band?.toUpperCase() : "-"}
                  unit=""
                />
                <MetricDisplay
                  icon={<Activity size={18} className="text-purple-300" />}
                  label="Datapoints"
                  value={liveItems.length}
                  unit="pts"
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(260px,320px),1fr]">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
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
                          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-white focus:border-sky-400 focus:outline-none"
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
                          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-white focus:border-sky-400 focus:outline-none"
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
                              className="w-24 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1.5 text-right text-white focus:border-sky-400 focus:outline-none"
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
                    {livePending && <div className="text-xs text-sky-200">Updating view.</div>}
                    {liveError && <div className="text-xs text-red-300">{liveError}</div>}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
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
                          labelStyle={{ color: "#e5e7eb" }}
                          formatter={(value, key) => {
                            if (key === "prob_breach7d") return [`${Number(value).toFixed(2)}`, "P(Breach 7d)"];
                            if (key === "threshold_eff") return [`${Number(value).toFixed(2)}`, "Eff. Threshold"];
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

              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="text-lg font-semibold text-white">Tuned Preview</div>
                <div className="mt-4 overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead className="text-gray-400">
                      <tr>
                        <th className="px-3 py-2 text-left">Timestamp</th>
                        <th className="px-3 py-2 text-left">Regime</th>
                        <th className="px-3 py-2 text-left">Prob</th>
                        <th className="px-3 py-2 text-left">Prob Raw</th>
                        <th className="px-3 py-2 text-left">Threshold</th>
                        <th className="px-3 py-2 text-left">Risk</th>
                        <th className="px-3 py-2 text-left">Alert</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-200">
                      {liveItems.slice(-40).map((row, idx) => (
                        <tr key={`live-row-${row.ts}-${idx}`} className="border-t border-white/10">
                          <td className="px-3 py-2 text-xs text-gray-400">{new Date(row.ts).toLocaleString()}</td>
                          <td className="px-3 py-2" style={{ color: regimeColor(row.regime) }}>{row.regime}</td>
                          <td className="px-3 py-2">{Number(row.prob_breach7d).toFixed(2)}</td>
                          <td className="px-3 py-2 text-gray-400">{Number(row.prob_breach7d_raw ?? row.prob_breach7d).toFixed(2)}</td>
                          <td className="px-3 py-2">{Number(row.threshold_eff).toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                row.risk_band === "high"
                                  ? "bg-red-500/20 text-red-200"
                                  : row.risk_band === "medium"
                                  ? "bg-amber-400/20 text-amber-200"
                                  : "bg-emerald-500/20 text-emerald-200"
                              }`}
                            >
                              {row.risk_band?.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {row.alert_flag ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-200">
                                <Zap size={12} /> Fired
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricDisplay
              icon={<Gauge size={18} className="text-red-300" />}
              label="Differential Pressure"
              value={strainer.currentMetrics.differentialPressure.toFixed(2)}
              unit="psi"
              trend={dpTrendLabel}
            />
            <MetricDisplay
              icon={<Droplets size={18} className="text-blue-300" />}
              label="Flow Rate"
              value={strainer.currentMetrics.flowRate.toFixed(0)}
              unit="bbl/d"
            />
            <MetricDisplay
              icon={<TrendingUp size={18} className="text-emerald-300" />}
              label="Efficiency"
              value={strainer.currentMetrics.efficiency.toFixed(1)}
              unit="%"
              trend={efficiencyTrend}
            />
            <MetricDisplay
              icon={<Clock size={18} className="text-purple-300" />}
              label="Days Since Clean"
              value={strainer.trends.daysSinceClean}
              unit="days"
            />
            <MetricDisplay
              icon={<Activity size={18} className="text-amber-300" />}
              label="DP Rate"
              value={strainer.trends.dpRate}
              unit="psi/day"
            />
            <MetricDisplay
              icon={<Zap size={18} className="text-yellow-300" />}
              label="Design Flow"
              value={strainer.currentMetrics.designFlowRate}
              unit="bbl/d"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
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

          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <Calendar size={16} className="text-blue-300" /> Last Cleaned
                </div>
                <div className="mt-1 text-xl font-bold text-white">
                  {formatDate(lastCleanDate)}
                </div>
                <div className="text-sm text-gray-400">{strainer.trends.daysSinceClean} days ago</div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <Calendar size={16} className="text-emerald-300" /> Next Scheduled Clean
                </div>
                <div className="mt-1 text-xl font-bold text-white">{formatDate(strainer.trends.nextCleanDue)}</div>
                <div className="text-sm text-gray-400">
                  {nextCleanInDays === 0 ? "Due now" : `In ${nextCleanInDays} days`}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <AlertTriangle size={16} className="text-red-300" /> Projected Plug Date
                </div>
                <div className="mt-1 text-xl font-bold text-white">
                  {formatDate(strainer.trends.projectedPlugDate)}
                </div>
                <div
                  className={`text-sm font-semibold ${
                    strainer.trends.daysUntilCritical < 7
                      ? "text-red-300"
                      : strainer.trends.daysUntilCritical < 14
                      ? "text-amber-300"
                      : "text-emerald-300"
                  }`}
                >
                  {strainer.trends.daysUntilCritical} days until critical
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <Activity size={16} className="text-purple-300" /> Fouling Rate
                </div>
                <div className="mt-1 text-xl font-bold text-white">{strainer.trends.dpRate} psi/day</div>
                <div className="text-sm text-gray-400">Baseline: 0.3-0.5 psi/day</div>
              </div>
            </div>
          </div>

          {strainer.isReal && recentEvents.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <div className="text-lg font-semibold text-white">Recent Events (Real Data)</div>
              <div className="mt-4 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="px-3 py-2 text-left">Timestamp</th>
                      <th className="px-3 py-2 text-left">Regime</th>
                      <th className="px-3 py-2 text-left">Prob</th>
                      <th className="px-3 py-2 text-left">Prob Raw</th>
                      <th className="px-3 py-2 text-left">Threshold</th>
                      <th className="px-3 py-2 text-left">Risk</th>
                      <th className="px-3 py-2 text-left">DP Excess (mbar)</th>
                      <th className="px-3 py-2 text-left">Health</th>
                      <th className="px-3 py-2 text-left">Alert</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-200">
                    {recentEvents.map((row, idx) => (
                      <tr key={`event-${row.ts}-${idx}`} className="border-t border-white/10">
                        <td className="px-3 py-2 text-xs text-gray-400">
                          {new Date(row.ts).toLocaleString()}
                        </td>
                        <td className="px-3 py-2" style={{ color: regimeColor(row.regime) }}>
                          {row.regime}
                        </td>
                        <td className="px-3 py-2">{Number(row.prob_breach7d).toFixed(2)}</td>
                        <td className="px-3 py-2 text-gray-400">{Number(row.prob_breach7d_raw ?? row.prob_breach7d).toFixed(2)}</td>
                        <td className="px-3 py-2">{Number(row.threshold_eff).toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                              row.risk_band === "high"
                                ? "bg-red-500/20 text-red-200"
                                : row.risk_band === "medium"
                                ? "bg-amber-400/20 text-amber-200"
                                : "bg-emerald-500/20 text-emerald-200"
                            }`}
                          >
                            {row.risk_band?.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2">{row.dp_excess_mbar == null ? "-" : Number(row.dp_excess_mbar).toFixed(3)}</td>
                        <td className="px-3 py-2">{row.health_score == null ? "-" : Number(row.health_score).toFixed(1)}</td>
                        <td className="px-3 py-2 text-xs">
                          {row.alert_flag ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-200">
                              <Zap size={12} /> Fired
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </AccordionSection>

        <AccordionSection
          id="insights"
          title="Insights"
          subtitle="Root cause, supplier context, and risk posture"
          icon={BrainCircuit}
          isOpen={openSections.insights}
          onToggle={handleToggleSection}
        >
          <GuidanceCard guidance={hasLive ? liveExplanationState : strainer.guidance} />

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-3 text-lg font-semibold text-white">
              <FileText size={22} className="text-blue-300" />
              AI-Generated Root Cause Analysis
            </div>
            <div className="prose prose-invert mt-4 max-w-none text-sm text-gray-200">
              {strainer.rootCauseAnalysis.split("\n").map((line, idx) => {
                if (line.startsWith("**") && line.endsWith("**")) {
                  return (
                    <h4 key={`rca-heading-${idx}`} className="text-lg font-bold text-blue-300">
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
            <div className="mt-6 rounded-lg border border-white/10 bg-slate-900/80 p-4 text-xs text-gray-400">
              Analysis generated using refinery breach-risk model and calibrated probability outputs. Confidence:{' '}
              {strainer.status === "alert" ? "92%" : strainer.status === "warning" ? "87%" : "94%"}.
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="border-l-4 border-purple-500 px-3 text-lg font-semibold text-white">
              Supplier & Element Information
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
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
              <div className="rounded-lg bg-white/5 p-4 md:col-span-2">
                <div className="text-xs uppercase tracking-wide text-gray-400">Mean Time To Failure</div>
                <div className="mt-1 text-lg font-bold text-white">{strainer.supplierInfo.meanTimeToFailure}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="border-l-4 border-red-500 px-3 text-lg font-semibold text-white">Risk Analysis</div>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
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
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="border-l-4 border-emerald-500 px-3 text-lg font-semibold text-white">
              Causality Analysis (5 Whys)
            </div>
            <div className="mt-4 rounded-lg bg-slate-900/70 p-3 text-sm text-gray-200">
              Problem Statement: {strainer.causalityAnalysis.problemStatement}
            </div>
            <div className="mt-4 space-y-3">
              {strainer.causalityAnalysis.fiveWhys.map((item, idx) => (
                <div key={`why-${idx}`} className="border-l-2 border-white/20 pl-4">
                  <div className="text-sm font-semibold text-blue-300">{item.why}</div>
                  <div className="text-sm text-gray-200">? {item.because}</div>
                </div>
              ))}
            </div>
          </div>
        </AccordionSection>

        <AccordionSection
          id="lifecycle"
          title="LC Phase"
          subtitle="Lifecycle status and maintenance plan"
          icon={Clock}
          isOpen={openSections.lifecycle}
          onToggle={handleToggleSection}
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(260px,320px),1fr]">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-gray-400">Current Phase</div>
              <div className="mt-2 text-2xl font-bold text-white">{lifecycleStage.label}</div>
              <p className={`mt-2 text-sm font-medium ${lifecycleStage.tone}`}>{lifecycleStage.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-400">
                <div>
                  <div className="uppercase tracking-wide">Days since clean</div>
                  <div className="text-lg font-semibold text-white">{strainer.trends.daysSinceClean}</div>
                </div>
                <div>
                  <div className="uppercase tracking-wide">Days until critical</div>
                  <div className="text-lg font-semibold text-white">{strainer.trends.daysUntilCritical}</div>
                </div>
                <div>
                  <div className="uppercase tracking-wide">Baseline DP</div>
                  <div className="text-lg font-semibold text-white">{strainer.trends.baselineDP.toFixed(2)} psi</div>
                </div>
                <div>
                  <div className="uppercase tracking-wide">Fouling rate</div>
                  <div className="text-lg font-semibold text-white">{strainer.trends.dpRate} psi/day</div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">Upcoming Milestones</div>
              <div className="mt-4 space-y-4">
                {lifecycleMilestones.map((milestone) => (
                  <div key={milestone.label} className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-400">{milestone.label}</div>
                      <div className="text-lg font-semibold text-white">{milestone.value}</div>
                    </div>
                    <div className={`text-xs font-semibold ${milestone.tone}`}>{milestone.context}</div>
                  </div>
                ))}
              </div>
              {strainer.alertDetails && (
                <div className="mt-5 rounded-lg border border-white/10 bg-slate-900/70 p-4 text-xs text-gray-300">
                  <div className="text-xs uppercase tracking-wide text-gray-400">Alert Context</div>
                  <div className="mt-1 text-sm font-semibold text-white">{strainer.alertDetails.message}</div>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <span>
                      Severity:{' '}
                      <span className="font-semibold text-sky-200">
                        {String(strainer.alertDetails.severity || "normal").toUpperCase()}
                      </span>
                    </span>
                    <span>
                      Status:{' '}
                      <span className="font-semibold text-gray-200">
                        {strainer.alertDetails.acknowledged ? "Acknowledged" : "Open"}
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold text-white">Cleaning History</div>
            <div className="mt-3 space-y-3 text-sm text-gray-200">
              {cleaningHistory.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-slate-900/60 px-4 py-3 text-gray-400">
                  No historical cleaning records captured for this asset.
                </div>
              ) : (
                cleaningHistory.map((item, idx) => (
                  <div
                    key={`clean-${item.date}-${idx}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/60 px-4 py-3"
                  >
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-400">Date</div>
                      <div className="text-sm font-semibold text-white">{formatDate(item.date)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-400">DP Before / After</div>
                      <div className="text-sm font-semibold text-white">
                        {item.dpBefore} → {item.dpAfter} psi
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-400">Downtime</div>
                      <div className="text-sm font-semibold text-white">{item.downtime} hrs</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-400">Debris</div>
                      <div className="text-sm font-semibold text-white">{item.debrisType}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </AccordionSection>
      </div>
    </div>
  );
"""
text = text[:start] + new_return + text[end:]
path.write_text(text, encoding='utf-8')
