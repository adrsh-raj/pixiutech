"use client"

import { useMemo, useState } from "react"
import type { SerialLine } from "./serial-monitor"

const SERIES_COLORS = ["#34d399", "#22d3ee", "#a78bfa", "#fbbf24", "#fb7185", "#60a5fa"]

interface PlotPoint {
  timestamp: number
  value: number
}

interface PlotSeries {
  name: string
  points: PlotPoint[]
}

function parseNumericReadings(text: string): Array<{ name: string; value: number }> {
  const clean = text.trim()
  if (!clean || /^\[system\]/i.test(clean)) return []

  const labeled: Array<{ name: string; value: number }> = []
  const labeledPattern = /([A-Za-z][A-Za-z0-9 _./-]{0,23})\s*[:=]\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi
  let match: RegExpExecArray | null
  while ((match = labeledPattern.exec(clean)) !== null) {
    const value = Number(match[2])
    const name = match[1].trim().replace(/\s+/g, " ")
    if (name && Number.isFinite(value)) labeled.push({ name, value })
  }
  if (labeled.length) return labeled

  const tokens = clean.split(/[\s,;]+/).filter(Boolean)
  if (!tokens.length || tokens.length > 8) return []
  const values = tokens.map(Number)
  if (values.some((value) => !Number.isFinite(value))) return []
  return values.map((value, index) => ({
    name: values.length === 1 ? "Value" : "Channel " + (index + 1),
    value,
  }))
}

function formatValue(value: number): string {
  if (Math.abs(value) >= 1000 || (Math.abs(value) > 0 && Math.abs(value) < 0.01)) {
    return value.toExponential(2)
  }
  return Number(value.toFixed(3)).toString()
}

interface Props {
  lines: SerialLine[]
}

export function SerialPlotter({ lines }: Props) {
  const [windowMs, setWindowMs] = useState(10000)
  const series = useMemo<PlotSeries[]>(() => {
    const collected = new Map<string, PlotPoint[]>()
    for (const line of lines.slice(-2000)) {
      if (line.type !== "output") continue
      for (const reading of parseNumericReadings(line.text)) {
        const points = collected.get(reading.name) ?? []
        points.push({ timestamp: line.timestamp, value: reading.value })
        collected.set(reading.name, points)
      }
    }
    return Array.from(collected.entries())
      .map(([name, points]) => ({ name, points: points.slice(-240) }))
      .slice(0, 6)
  }, [lines])

  const latestTimestamp = series.reduce(
    (latest, item) => Math.max(latest, item.points[item.points.length - 1]?.timestamp ?? 0),
    0,
  )
  const startTimestamp = Math.max(0, latestTimestamp - windowMs)
  const visibleValues = series.flatMap((item) =>
    item.points.filter((point) => point.timestamp >= startTimestamp).map((point) => point.value),
  )
  const observedMin = visibleValues.length ? Math.min(...visibleValues) : 0
  const observedMax = visibleValues.length ? Math.max(...visibleValues) : 1
  const padding = observedMax === observedMin ? Math.max(1, Math.abs(observedMax) * 0.08) : (observedMax - observedMin) * 0.08
  const minValue = observedMin - padding
  const maxValue = observedMax + padding
  const chart = { left: 48, top: 10, width: 670, height: 126 }
  const yForValue = (value: number) =>
    chart.top + ((maxValue - value) / Math.max(0.000001, maxValue - minValue)) * chart.height
  const xForTime = (timestamp: number) =>
    chart.left + ((timestamp - startTimestamp) / Math.max(1, windowMs)) * chart.width

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-slate-400">
          Numeric Serial output becomes a time-series graph. Labeled lines such as Light: 512 keep their own series.
        </p>
        <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
          Window
          <select
            aria-label="Serial plot time window"
            value={windowMs}
            onChange={(event) => setWindowMs(Number(event.target.value))}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-200"
          >
            <option value={2000}>2 seconds</option>
            <option value={10000}>10 seconds</option>
            <option value={30000}>30 seconds</option>
          </select>
        </label>
      </div>

      {series.length === 0 ? (
        <div className="grid min-h-24 flex-1 place-items-center rounded-lg border border-dashed border-slate-700 bg-slate-950/70 px-4 text-center">
          <div>
            <p className="text-xs font-semibold text-slate-300">Waiting for numeric serial data</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">
              Use Blockly Serial Plot Value, or print a number such as 512 or Light: 512.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 rounded-lg border border-slate-800 bg-slate-950/80 p-2">
            <svg
              viewBox="0 0 740 154"
              role="img"
              aria-label={"Serial plot showing " + series.map((item) => item.name).join(", ")}
              className="h-full min-h-[110px] w-full"
              preserveAspectRatio="none"
            >
              {[0, 1, 2, 3, 4].map((tick) => {
                const y = chart.top + (chart.height / 4) * tick
                const value = maxValue - ((maxValue - minValue) / 4) * tick
                return (
                  <g key={tick}>
                    <line x1={chart.left} y1={y} x2={chart.left + chart.width} y2={y} stroke="#263449" strokeDasharray="3 4" />
                    <text x={2} y={y + 3} fill="#718096" fontSize="8">{formatValue(value)}</text>
                  </g>
                )
              })}
              {[0, 1, 2, 3, 4, 5].map((tick) => {
                const x = chart.left + (chart.width / 5) * tick
                return <line key={tick} x1={x} y1={chart.top} x2={x} y2={chart.top + chart.height} stroke="#1d2a3b" />
              })}
              {series.map((item, seriesIndex) => {
                const points = item.points.filter((point) => point.timestamp >= startTimestamp)
                const coordinates = points
                  .map((point) => xForTime(point.timestamp) + "," + yForValue(point.value))
                  .join(" ")
                const latest = item.points[item.points.length - 1]
                return (
                  <g key={item.name}>
                    {points.length > 1 && (
                      <polyline
                        points={coordinates}
                        fill="none"
                        stroke={SERIES_COLORS[seriesIndex % SERIES_COLORS.length]}
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    )}
                    {latest && points.length === 1 && (
                      <circle
                        cx={xForTime(latest.timestamp)}
                        cy={yForValue(latest.value)}
                        r="3"
                        fill={SERIES_COLORS[seriesIndex % SERIES_COLORS.length]}
                      />
                    )}
                  </g>
                )
              })}
            </svg>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {series.map((item, index) => {
              const latest = item.points[item.points.length - 1]
              return (
                <div key={item.name} className="flex items-center gap-1.5 text-[10px]">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length] }} />
                  <span className="max-w-32 truncate text-slate-400">{item.name}</span>
                  <span className="font-mono font-semibold text-slate-200">{formatValue(latest?.value ?? 0)}</span>
                </div>
              )
            })}
            <span className="ml-auto text-[9px] text-slate-500">{visibleValues.length} samples</span>
          </div>
        </>
      )}
    </div>
  )
}
