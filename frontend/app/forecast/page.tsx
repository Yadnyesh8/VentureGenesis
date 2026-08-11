"use client";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Card, Metric, Loading, ErrorBox, PageHeader, Pill, fmtMoney, useAgent } from "@/components/ui";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { CHART, axisProps, ANIM } from "@/lib/chartTheme";
import { InstrumentTooltip } from "@/components/instrument";
import { buildForecastSeries, moneyAxis } from "@/lib/forecastSeries";

export default function ForecastPage() {
  const { ref } = useStore();
  const r = ref();
  const { data, loading, error } = useAgent(() => api.forecast(r), [JSON.stringify(r)], "forecast");
  const d = data?.data;
  const { data: chart, values, historyLength } = buildForecastSeries(d?.series, d?.projection);
  const axis = moneyAxis(values);

  return (
    <div>
      <PageHeader title="Revenue Forecast" desc="Prophet time-series forecast (compound-growth fallback)." />
      {error && <ErrorBox error={error} />}
      {loading ? <Loading /> : d && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Metric label="Next 3 months" value={fmtMoney(d.forecast_3m)} tone="brand" />
            <Metric label="Next 6 months" value={fmtMoney(d.forecast_6m)} tone="brand" />
            <Metric label="Next 12 months" value={fmtMoney(d.forecast_12m)} tone="good" />
          </div>
          <Card
            title="Monthly revenue — history → forecast"
            right={
              <span className="flex items-center gap-2.5">
                {axis.scale === "log" && <span className="text-[11px] text-text-mute">log scale</span>}
                <Pill>{d.method}</Pill>
              </span>
            }
          >
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART.aqua} stopOpacity={0.35} /><stop offset="100%" stopColor={CHART.aqua} stopOpacity={0} /></linearGradient>
                  <linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART.violet} stopOpacity={0.45} /><stop offset="100%" stopColor={CHART.violet} stopOpacity={0} /></linearGradient>
                  <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <CartesianGrid strokeDasharray="2 6" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="x" {...axisProps} />
                <YAxis
                  {...axisProps}
                  tickFormatter={fmtMoney}
                  scale={axis.scale}
                  domain={axis.domain}
                  ticks={axis.ticks}
                  allowDataOverflow
                />
                <Tooltip content={<InstrumentTooltip fmt={fmtMoney} />} />
                <ReferenceLine x={`H${historyLength}`} stroke={CHART.axis} strokeDasharray="3 5" label={{ value: "NOW", fill: CHART.axis, fontSize: 10, fontFamily: "var(--font-mono)", position: "top" }} />
                {/* On a log axis the area under the curve has no meaning, so the
                    fill drops back and the stroke carries the reading. */}
                <Area type="monotone" name="history" dataKey="history" stroke={CHART.aqua} fill="url(#h)" fillOpacity={axis.scale === "log" ? 0.3 : 1} strokeWidth={2.5} {...ANIM} />
                <Area type="monotone" name="forecast" dataKey="forecast" stroke={CHART.violet} fill="url(#f)" fillOpacity={axis.scale === "log" ? 0.3 : 1} strokeWidth={2.5} strokeDasharray="6 4" filter="url(#glow)" {...ANIM} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  );
}
