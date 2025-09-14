export type PromMetric = {
  name: string;
  type?: string;
  help?: string;
  samples: Array<{
    labels: Record<string, string>;
    value: number;
  }>;
};

// Minimal Prometheus exposition format parser (text/plain)
export function parsePrometheusText(input: string): Record<string, PromMetric> {
  const lines = input.split(/\r?\n/);
  const out: Record<string, PromMetric> = {};
  let currentType: Record<string, string> = {};
  let currentHelp: Record<string, string> = {};

  for (const line of lines) {
    if (!line || line.startsWith('# EOF')) continue;
    if (line.startsWith('# HELP')) {
      const m = line.match(/^# HELP\s+(\w+)\s+(.+)$/);
      if (m) currentHelp[m[1]] = m[2];
      continue;
    }
    if (line.startsWith('# TYPE')) {
      const m = line.match(/^# TYPE\s+(\w+)\s+(\w+)$/);
      if (m) currentType[m[1]] = m[2];
      continue;
    }
    // sample: metric_name{label="value"} 123
    const sm = line.match(/^(\w+)(\{[^}]*\})?\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)$/i);
    if (!sm) continue;
    const [, name, labelPart, valueStr] = sm;
    const value = Number(valueStr);
    const labels: Record<string, string> = {};
    if (labelPart) {
      const inner = labelPart.slice(1, -1);
      const parts = inner.split(/,(?=(?:[^"\\]*\\"[^"\\]*\\")*[^"\\]*$)/); // split on commas not inside quotes
      for (const p of parts) {
        const [k, v] = p.split('=');
        if (!k) continue;
        const unquoted = (v || '').replace(/^"|"$/g, '').replace(/\\n/g, '\n').replace(/\\"/g, '"');
        labels[k.trim()] = unquoted;
      }
    }
    if (!out[name]) out[name] = { name, type: currentType[name], help: currentHelp[name], samples: [] };
    out[name].samples.push({ labels, value });
  }
  return out;
}

export function getCounterTotal(metrics: Record<string, PromMetric>, name: string, labelFilters?: Record<string, string>): number | null {
  const m = metrics[name];
  if (!m) return null;
  const match = (lbls: Record<string, string>) => !labelFilters || Object.entries(labelFilters).every(([k, v]) => lbls[k] === v);
  return m.samples.filter(s => match(s.labels)).reduce((acc, s) => acc + s.value, 0);
}

// For histograms: metric names usually include _bucket, _sum, _count
export function getHistogramBuckets(
  metrics: Record<string, PromMetric>,
  baseName: string,
  labelFilters?: Record<string, string>
) {
  const buckets = metrics[`${baseName}_bucket`];
  if (!buckets) return [] as Array<{ le: string; value: number }>;
  const match = (lbls: Record<string, string>) =>
    !labelFilters || Object.entries(labelFilters).every(([k, v]) => (k === 'le' ? true : lbls[k] === v));
  return buckets.samples
    .filter(s => match(s.labels))
    .map(s => ({ le: s.labels.le, value: s.value }))
    .sort((a, b) => (parseFloat(a.le) - parseFloat(b.le)) || (a.le === '+Inf' ? 1 : -1));
}

export function getHistogramCount(
  metrics: Record<string, PromMetric>,
  baseName: string,
  labelFilters?: Record<string, string>
): number {
  const m = metrics[`${baseName}_count`];
  if (!m) return 0;
  const match = (lbls: Record<string, string>) =>
    !labelFilters || Object.entries(labelFilters).every(([k, v]) => lbls[k] === v);
  return m.samples.filter(s => match(s.labels)).reduce((acc, s) => acc + s.value, 0);
}

export function getHistogramSum(
  metrics: Record<string, PromMetric>,
  baseName: string,
  labelFilters?: Record<string, string>
): number {
  const m = metrics[`${baseName}_sum`];
  if (!m) return 0;
  const match = (lbls: Record<string, string>) =>
    !labelFilters || Object.entries(labelFilters).every(([k, v]) => lbls[k] === v);
  return m.samples.filter(s => match(s.labels)).reduce((acc, s) => acc + s.value, 0);
}
