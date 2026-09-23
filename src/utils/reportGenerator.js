import canvasScriptUrl from 'html2canvas/dist/html2canvas.min.js?url'
import pdfScriptUrl from 'jspdf/dist/jspdf.umd.min.js?url'
import { renderReportTemplate } from './reportTemplate.js'

const GRAPH_VIEWBOX = {
  height: 410,
  width: 960,
}

const GRAPH_CHART = {
  height: 318,
  left: 92,
  top: 26,
  width: 762,
}

const GRAPH_VOLTAGE_MAX = 15
const GRAPH_X_TICKS = [0, 3, 6, 9, 12, 15]
const GRAPH_Y_TICK_COUNT = 5
const GRAPH_SERIES = [
  { className: 'i1', color: '#c83f35', key: 'i1', labelIndex: '1', labelOffset: -12 },
  { className: 'i2', color: '#1579a8', key: 'i2', labelIndex: '2', labelOffset: 14 },
  { className: 'i3', color: '#3f8f43', key: 'i3', labelIndex: '3', labelOffset: -2 },
]

const toNumber = (value) => {
  const number = Number(value)

  return Number.isFinite(number) ? number : 0
}

const formatNumber = (value, fractionDigits = 2) => toNumber(value).toFixed(fractionDigits)

const formatCurrentTick = (value) => formatNumber(value)

const getNiceMaxCurrent = (observations) => {
  const maxCurrent = observations.reduce(
    (currentMax, row) => Math.max(currentMax, toNumber(row.i1), toNumber(row.i2), toNumber(row.i3)),
    0,
  )
  const paddedCurrent = Math.max(maxCurrent * 1.08, 0.1)
  const roughStep = paddedCurrent / (GRAPH_Y_TICK_COUNT - 1)
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const normalizedStep = roughStep / magnitude
  const niceStep = (
    normalizedStep <= 1 ? 1
      : normalizedStep <= 2 ? 2
        : normalizedStep <= 2.5 ? 2.5
          : normalizedStep <= 5 ? 5
            : 10
  ) * magnitude

  return niceStep * (GRAPH_Y_TICK_COUNT - 1)
}

const getYTicks = (maxCurrent) => (
  Array.from({ length: GRAPH_Y_TICK_COUNT }, (_, index) => (
    (maxCurrent / (GRAPH_Y_TICK_COUNT - 1)) * index
  ))
)

const getXFromVoltage = (voltage) => {
  const ratio = Math.min(Math.max(toNumber(voltage) / GRAPH_VOLTAGE_MAX, 0), 1)

  return GRAPH_CHART.left + ratio * GRAPH_CHART.width
}

const getYFromCurrent = (current, maxCurrent) => {
  const ratio = Math.min(Math.max(toNumber(current) / maxCurrent, 0), 1)

  return GRAPH_CHART.top + GRAPH_CHART.height - ratio * GRAPH_CHART.height
}

const getPoint = (row, current, maxCurrent) => ({
  x: getXFromVoltage(row.voltage),
  y: getYFromCurrent(current, maxCurrent),
})

const getLinePath = (observations, currentKey, maxCurrent) => (
  observations
    .map((row, index) => {
      const point = getPoint(row, row[currentKey], maxCurrent)
      const command = index === 0 ? 'M' : 'L'

      return `${command}${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    })
    .join(' ')
)

const getSeriesLabelPoint = (observations, currentKey, maxCurrent, offset) => {
  const row = observations.at(-1)
  const point = getPoint(row, row[currentKey], maxCurrent)
  const y = Math.min(
    Math.max(point.y + offset, GRAPH_CHART.top + 12),
    GRAPH_CHART.top + GRAPH_CHART.height - 12,
  )

  return {
    x: Math.min(point.x + 17, GRAPH_VIEWBOX.width - 54),
    y,
  }
}

const createReportGraphSvg = (observations) => {
  if (!observations.length) {
    return '<em>No readings available to plot.</em>'
  }

  const plottedObservations = [...observations].sort((current, next) => current.voltage - next.voltage)
  const maxCurrent = getNiceMaxCurrent(plottedObservations)
  const yTicks = getYTicks(maxCurrent)
  const chartBottom = GRAPH_CHART.top + GRAPH_CHART.height
  const chartRight = GRAPH_CHART.left + GRAPH_CHART.width
  const yAxisTitleX = 31
  const yAxisTitleY = GRAPH_CHART.top + GRAPH_CHART.height / 2

  const xTickMarkup = GRAPH_X_TICKS.map((tick) => {
    const x = getXFromVoltage(tick)

    return `
      <g>
        <line class="report-graph__grid report-graph__grid--vertical" x1="${x}" x2="${x}" y1="${GRAPH_CHART.top}" y2="${chartBottom}" />
        <line class="report-graph__tick" x1="${x}" x2="${x}" y1="${chartBottom}" y2="${chartBottom + 7}" />
        <text class="report-graph__tick-label" text-anchor="middle" x="${x}" y="${chartBottom + 27}">${formatNumber(tick)}</text>
      </g>
    `
  }).join('')

  const yTickMarkup = yTicks.map((tick) => {
    const y = getYFromCurrent(tick, maxCurrent)

    return `
      <g>
        <line class="report-graph__grid report-graph__grid--horizontal" x1="${GRAPH_CHART.left}" x2="${chartRight}" y1="${y}" y2="${y}" />
        <line class="report-graph__tick" x1="${GRAPH_CHART.left - 7}" x2="${GRAPH_CHART.left}" y1="${y}" y2="${y}" />
        <text class="report-graph__tick-label report-graph__tick-label--y" text-anchor="end" x="${GRAPH_CHART.left - 13}" y="${y + 4}">${formatCurrentTick(tick)}</text>
      </g>
    `
  }).join('')

  const bandMarkup = yTicks.slice(0, -1).map((tick, index) => {
    const nextTick = yTicks[index + 1]
    const y = getYFromCurrent(nextTick, maxCurrent)
    const height = getYFromCurrent(tick, maxCurrent) - y

    return `<rect class="report-graph__band" height="${height}" width="${GRAPH_CHART.width}" x="${GRAPH_CHART.left}" y="${y}" />`
  }).join('')

  const lineMarkup = GRAPH_SERIES.map((series) => (
    `<path class="report-graph__line report-graph__line--${series.className}" d="${getLinePath(plottedObservations, series.key, maxCurrent)}" />`
  )).join('')

  const pointMarkup = GRAPH_SERIES.map((series) => (
    plottedObservations.map((row) => {
      const point = getPoint(row, row[series.key], maxCurrent)

      return `<circle class="report-graph__point report-graph__point--${series.className}" cx="${point.x}" cy="${point.y}" r="3.8" />`
    }).join('')
  )).join('')

  const labelMarkup = GRAPH_SERIES.map((series) => {
    const point = getSeriesLabelPoint(plottedObservations, series.key, maxCurrent, series.labelOffset)

    return `<text class="report-graph__series-label report-graph__series-label--${series.className}" x="${point.x}" y="${point.y}">I<tspan class="report-graph__series-label-sub" dx="1">${series.labelIndex}</tspan></text>`
  }).join('')

  return `
    <svg
      class="report-graph__svg"
      role="img"
      aria-label="Line graph of branch currents against applied voltage"
      viewBox="0 0 ${GRAPH_VIEWBOX.width} ${GRAPH_VIEWBOX.height}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <style>
          <![CDATA[
            .report-graph__plot-bg { fill: #fffdf8; stroke: #d7cbbd; stroke-width: 1; }
            .report-graph__band { fill: rgba(51, 124, 102, 0.025); }
            .report-graph__axis { fill: none; stroke: #563927; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.4; }
            .report-graph__grid { stroke: rgba(117, 88, 62, 0.2); stroke-width: 0.8; }
            .report-graph__grid--horizontal { stroke-dasharray: 4 8; }
            .report-graph__tick { stroke: rgba(74, 43, 31, 0.38); stroke-linecap: round; stroke-width: 1; }
            .report-graph__tick-label { fill: #6a4b34; font-size: 18px; font-weight: 700; }
            .report-graph__tick-label--y { font-size: 17px; }
            .report-graph__axis-title { fill: #38271c; font-size: 20px; font-weight: 800; }
            .report-graph__line { fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.2; }
            .report-graph__line--i1, .report-graph__point--i1 { stroke: #c83f35; }
            .report-graph__line--i2, .report-graph__point--i2 { stroke: #1579a8; }
            .report-graph__line--i3, .report-graph__point--i3 { stroke: #3f8f43; }
            .report-graph__point { fill: #ffffff; stroke-width: 1.6; }
            .report-graph__series-label { dominant-baseline: middle; font-size: 18px; font-weight: 800; paint-order: stroke; stroke: #fffdf8; stroke-linejoin: round; stroke-width: 5px; }
            .report-graph__series-label--i1 { fill: #c83f35; }
            .report-graph__series-label--i2 { fill: #1579a8; }
            .report-graph__series-label--i3 { fill: #3f8f43; }
            .report-graph__series-label-sub { baseline-shift: sub; font-size: 72%; }
          ]]>
        </style>
        <marker id="report-graph-axis-arrow" markerHeight="7" markerWidth="8" orient="auto" refX="7" refY="3.5">
          <path d="M0 0 7 3.5 0 7z" />
        </marker>
        <clipPath id="report-graph-plot-clip">
          <rect height="${GRAPH_CHART.height}" width="${GRAPH_CHART.width}" x="${GRAPH_CHART.left}" y="${GRAPH_CHART.top}" />
        </clipPath>
      </defs>

      <rect class="report-graph__plot-bg" height="${GRAPH_CHART.height}" width="${GRAPH_CHART.width}" x="${GRAPH_CHART.left}" y="${GRAPH_CHART.top}" />
      ${bandMarkup}
      ${xTickMarkup}
      ${yTickMarkup}

      <path class="report-graph__axis" d="M${GRAPH_CHART.left} ${chartBottom}H${chartRight + 18}" marker-end="url(#report-graph-axis-arrow)" />
      <path class="report-graph__axis" d="M${GRAPH_CHART.left} ${chartBottom}V${GRAPH_CHART.top - 16}" marker-end="url(#report-graph-axis-arrow)" />

      <text class="report-graph__axis-title" text-anchor="middle" x="${GRAPH_CHART.left + GRAPH_CHART.width / 2}" y="${GRAPH_VIEWBOX.height - 20}">
        Voltage (V)
      </text>
      <text
        class="report-graph__axis-title report-graph__axis-title--y"
        text-anchor="middle"
        transform="rotate(-90 ${yAxisTitleX} ${yAxisTitleY})"
        x="${yAxisTitleX}"
        y="${yAxisTitleY}"
      >
        Current (mA)
      </text>

      <g clip-path="url(#report-graph-plot-clip)">
        ${lineMarkup}
      </g>
      ${pointMarkup}
      ${labelMarkup}
    </svg>
  `
}

const getSessionDurationText = (sessionStart, sessionEnd) => {
  const durationMs = Math.max(0, sessionEnd - sessionStart)
  const durationTotalSeconds = Math.floor(durationMs / 1000)
  const durationMinutes = Math.floor(durationTotalSeconds / 60)
  const durationSeconds = durationTotalSeconds % 60

  return `${durationMinutes} min ${String(durationSeconds).padStart(2, '0')} sec`
}

const createObservationRows = (observations) => (
  observations.map((row, index) => {
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${formatNumber(row.voltage)}</td>
        <td>${formatNumber(row.i1)}</td>
        <td>${formatNumber(row.i2)}</td>
        <td>${formatNumber(row.i3)}</td>
      </tr>
    `
  }).join('')
)

export const createReportHtml = ({
  baseHref, iitLogoSrc, virtualLabsLogoSrc, observations, resistances, sessionStart, verification,
}) => {
  const reportDate = new Date()
  const first = observations[0] ?? {}
  return renderReportTemplate({
    baseHref,
    iitLogoSrc,
    virtualLabsLogoSrc,
    observations,
    verification,
    resistances: {
      r1: toNumber(resistances?.r1 ?? first.r1),
      r2: toNumber(resistances?.r2 ?? first.r2),
      r3: toNumber(resistances?.r3 ?? first.r3),
    },
    observationRows: createObservationRows(observations),
    graphSvg: createReportGraphSvg(observations),
    reportDateText: reportDate.toLocaleDateString('en-GB'),
    startTimeText: new Date(sessionStart).toLocaleTimeString(),
    endTimeText: reportDate.toLocaleTimeString(),
    durationText: getSessionDurationText(sessionStart, reportDate.getTime()),
    assets: {
      canvas: new URL(canvasScriptUrl, window.location.href).href,
      pdf: new URL(pdfScriptUrl, window.location.href).href,
    },
  })
}

export const prepareKclReport = ({ observations, resistances, sessionStart, verification }) => {
  const baseHref = new URL(import.meta.env.BASE_URL, window.location.origin).href
  const iitLogoSrc = new URL('../assets/IIT Logo.png', import.meta.url).href
  const virtualLabsLogoSrc = new URL('../assets/image.png', import.meta.url).href
  const reportHtml = createReportHtml({
    baseHref,
    iitLogoSrc,
    observations,
    resistances,
    sessionStart,
    verification,
    virtualLabsLogoSrc,
  })
  const reportBlob = new Blob([reportHtml], { type: 'text/html' })
  const reportUrl = URL.createObjectURL(reportBlob)
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    URL.revokeObjectURL(reportUrl)
  }

  return {
    dispose,
    open: () => {
      if (disposed) return false
      const reportWindow = window.open(reportUrl, '_blank')
      if (!reportWindow) return false
      window.setTimeout(dispose, 60000)
      reportWindow.focus()
      return true
    },
  }
}

export const generateKclReport = (options) => {
  const report = prepareKclReport(options)
  const opened = report.open()
  if (!opened) report.dispose()
  return opened
}
