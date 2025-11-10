from pathlib import Path
path = Path('frontend/src/App.jsx')
text = path.read_text(encoding='utf-8')
start = text.index('const StrainerDetailView')
end = text.index('const StrainerOverviewPanels', start)
new = '''const StrainerDetailView = ({ strainer, fleet = [], assetConfig }) => {
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
      const key = f"{impact}|{probability}";
      cellCounts[key] = cellCounts.get(key, 0) + 1;
      if dominantKey is None or cellCounts[key] > cellCounts.get(dominantKey, 0):
        dominantKey = key
      if impact == selectedImpact and probability == selectedProbability:
        sameCellCount += 1
      status = str(item.status or "other").lower()
      if status in statusCounts:
        statusCounts[status] += 1
      else:
        statusCounts["other"] += 1
    });

    if dominantKey:
      dominantImpact, dominantProbability = dominantKey.split('|')
    else:
      dominantImpact, dominantProbability = selectedImpact, selectedProbability

    return {
      'total': len([item for item in fleet if item]),
      'statusCounts': statusCounts,
      'selectedImpact': selectedImpact,
      'selectedProbability': selectedProbability,
      'sameCellCount': sameCellCount,
      'dominantImpact': dominantImpact,
      'dominantProbability': dominantProbability,
      'dominantCount': cellCounts[dominantKey] if dominantKey else sameCellCount,
    }
  }, [fleet, strainer])
'''
