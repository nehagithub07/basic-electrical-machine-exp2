import pdfScriptUrl from 'jspdf/dist/jspdf.umd.min.js?url'
import { formatObservationCurrents } from './circuitMath.js'
import { getReportPageScale } from './reportPagination.js'
import { createReportPdf, renderReportCanvas } from './reportPdf.js'

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

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const toNumber = (value) => {
  const number = Number(value)

  return Number.isFinite(number) ? number : 0
}

const formatNumber = (value, fractionDigits = 3) => toNumber(value).toFixed(fractionDigits)

const formatResistance = (value) => {
  const resistance = toNumber(value) / 1000
  return Number.isInteger(resistance) ? String(resistance) : formatNumber(resistance, 1)
}

const formatCurrentTick = (value) => {
  if (value === 0) {
    return '0'
  }

  return formatNumber(value, 2)
}

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
        <text class="report-graph__tick-label" text-anchor="middle" x="${x}" y="${chartBottom + 27}">${tick}</text>
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
            .report-graph__tick-label { fill: #6a4b34; font-size: 13px; font-weight: 700; }
            .report-graph__tick-label--y { font-size: 12px; }
            .report-graph__axis-title { fill: #38271c; font-size: 15px; font-weight: 800; }
            .report-graph__line { fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.2; }
            .report-graph__line--i1, .report-graph__point--i1 { stroke: #c83f35; }
            .report-graph__line--i2, .report-graph__point--i2 { stroke: #1579a8; }
            .report-graph__line--i3, .report-graph__point--i3 { stroke: #3f8f43; }
            .report-graph__point { fill: #ffffff; stroke-width: 1.6; }
            .report-graph__series-label { dominant-baseline: middle; font-size: 13px; font-weight: 800; paint-order: stroke; stroke: #fffdf8; stroke-linejoin: round; stroke-width: 5px; }
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
    const currents = formatObservationCurrents(row)
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${formatNumber(row.voltage, 2)}</td>
        <td>${currents.i1}</td>
        <td>${currents.i2}</td>
        <td>${currents.i3}</td>
      </tr>
    `
  }).join('')
)

const createVerificationMarkup = (verification) => {
  const verifications = Array.isArray(verification) ? verification : Object.values(verification ?? {})

  if (!verifications.length) {
    return '<p class="verification-empty">The theoretical verification has not yet been submitted.</p>'
  }

  const formatValue = (value) => (
    value == null || String(value).trim() === '' || !Number.isFinite(Number(value))
      ? '—' : formatNumber(value, 2)
  )
  const rows = [...verifications].sort((a, b) => a.readingId - b.readingId).map((entry, index) => {
    const status = entry.result == null ? 'Pending' : entry.result.correct ? 'Verified' : 'Not verified'
    const statusClass = entry.result == null ? 'is-pending' : entry.result.correct ? 'is-correct' : 'is-wrong'
    return `<tr>
      <td>${index + 1}</td>
      <td scope="row">Reading ${escapeHtml(entry.readingId)} (${formatValue(entry.voltage)} V)</td>
      <td>${formatValue(entry.answers?.equivalentResistance)} </td>
      <td>${formatValue(entry.answers?.i1Result)}</td>
      <td>${formatValue(entry.answers?.i2Result)}</td>
      <td>${formatValue(entry.answers?.i3Result)}</td>
      <td><span class="verification-report__status ${statusClass}">${status}</span></td>
    </tr>`
  }).join('')

  return `<div class="table-shell"><table class="verification-report__table" aria-label="Theoretical verification">
    <thead><tr><th scope="col">S.No.</th><th scope="col">Verified Reading</th><th scope="col">R (kΩ)</th><th scope="col">I<sub>1</sub> (mA)</th><th scope="col">I<sub>2</sub> (mA)</th><th scope="col">I<sub>3</sub> (mA)</th><th scope="col">Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`
}

const createReportHtml = ({
  baseHref,
  iitLogoSrc,
  observations,
  resistances,
  sessionStart,
  verification,
  virtualLabsLogoSrc,
}) => {
  const reportDate = new Date()
  const sessionEnd = reportDate.getTime()
  const reportDateText = reportDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const startTimeText = new Date(sessionStart).toLocaleTimeString()
  const endTimeText = reportDate.toLocaleTimeString()
  const durationText = getSessionDurationText(sessionStart, sessionEnd)
  const firstObservation = observations[0] ?? {}
  const r1 = toNumber(resistances?.r1 ?? firstObservation.r1)
  const r2 = toNumber(resistances?.r2 ?? firstObservation.r2)
  const r3 = toNumber(resistances?.r3 ?? firstObservation.r3)
  const observationRows = createObservationRows(observations)
  const graphSvg = createReportGraphSvg(observations)
  const verificationMarkup = createVerificationMarkup(verification)

  const css = `
body {
  font-family: 'Inter', 'Segoe UI', sans-serif;
  background: linear-gradient(180deg, #eef4fb 0%, #f7f9fc 100%);
  color: #1f2d3d;
  margin: 0;
  padding: 18px 14px 30px;
  font-size: 14px;
  line-height: 1.42;
  overflow-wrap: break-word;
}
*,
*::before,
*::after {
  box-sizing: border-box;
}
.report-page {
  width: min(100%, 960px);
  margin: 0 auto 18px;
  padding: 22px 26px;
  background-color: #ffffff;
  border-radius: 16px;
  border: 1px solid #d3ddea;
  box-shadow: 0 12px 28px rgba(23, 50, 77, 0.1);
  break-inside: avoid-page;
  page-break-inside: avoid;
  overflow: visible;
  background-clip: padding-box;
}
.report-page:last-of-type {
  margin-bottom: 0;
}
h1,
h2,
h3 {
  color: #1f2d3d;
  margin-top: 0;
  font-weight: 700;
}
h1 {
  font-size: 28px;
  margin: 0;
  padding: 0;
  line-height: 1.15;
}
h2 {
  font-size: 20px;
  margin-bottom: 12px;
  color: #243b53;
}
h3 {
  font-size: 15px;
  margin-bottom: 7px;
  color: #2d4b68;
}
p {
  margin: 0 0 8px;
  text-align: justify;
  text-align-last: left;
}
li {
  margin-bottom: 4px;
  text-align: justify;
}
.section {
  background: linear-gradient(180deg, #f9fbfe 0%, #f4f7fb 100%);
  padding: 16px 18px;
  margin-bottom: 14px;
  border-radius: 12px;
  border: none;
  box-shadow: none;
  break-inside: auto;
  page-break-inside: auto;
  background-clip: padding-box;
}
.section:last-child {
  margin-bottom: 0;
}
.section > h2:first-child {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e1e9f3;
}
.label {
  font-weight: 600;
  color: #1f2d3d;
}
ul {
  padding-left: 20px;
  margin: 7px 0 0;
}
.two-column-list {
  column-count: 2;
  column-gap: 32px;
  list-style-position: inside;
  margin-top: 10px;
}
.report-overview-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.report-stamp {
  margin: 0;
  padding: 7px 11px;
  border-radius: 999px;
  background: #ffffff;
  border: none;
  color: #50657c;
  font-size: 13px;
  font-weight: 600;
}
.report-experiment-label {
  margin: 0 0 6px;
  font-size: 12px;
  letter-spacing: 0;
  text-transform: uppercase;
  color: #60778f;
  font-weight: 700;
}
.report-experiment-title {
  margin: 0 0 14px;
  font-size: 22px;
  line-height: 1.3;
  font-weight: 700;
  color: #16324b;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-top: 10px;
}
.info-card {
  background: #fff;
  border: none;
  border-radius: 9px;
  padding: 10px 12px;
  box-shadow: none;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 4px;
}
.table-shell {
  display: block;
  width: 100%;
  align-self: stretch;
  overflow-x: auto;
  overflow-y: visible;
  border: none;
  border-radius: 12px;
  max-width: 100%;
  background: #ffffff;
  box-shadow: none;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0;
  box-shadow: none;
  background-color: white;
  table-layout: auto;
}
th,
td {
  border: 1px solid #d9e2ec;
  padding: 9px 10px;
  text-align: center;
  font-size: 13px;
  vertical-align: middle;
  overflow-wrap: anywhere;
  word-break: break-word;
}
th {
  background: linear-gradient(135deg, #2f7bfa 0%, #1f62d0 100%);
  border-color: #c6d7ec;
  border-bottom-color: #b4cae5;
  color: white;
  font-weight: 700;
  letter-spacing: 0;
}
thead {
  display: table-header-group;
}
tbody {
  display: table-row-group;
}
tr {
  break-inside: avoid-page;
  page-break-inside: avoid;
}
tr:nth-child(even) {
  background-color: #f8fbff;
}
.results-stack {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.results-card {
  background: #ffffff;
  border: none;
  border-radius: 12px;
  padding: 14px;
  box-shadow: none;
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 9px;
  overflow: visible;
  background-clip: padding-box;
}
.results-card h3 {
  margin: 0;
  text-align: left;
  padding-bottom: 0;
  border-bottom: none;
}
.results-card--table {
  break-inside: auto;
  page-break-inside: auto;
}
.results-card--graph {
  break-inside: avoid-page;
  page-break-inside: avoid;
}
.compact-table {
  margin-top: 0;
}
.compact-table th,
.compact-table td {
  padding: 8px 10px;
  font-size: 13px;
}
.graph {
  text-align: center;
  margin-top: 0;
}
.report-graph-card {
  padding: 14px;
}
.report-graph-card #report-graph {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  position: relative;
  width: 100%;
  min-height: 340px;
  padding: 8px 0 0;
  background: linear-gradient(180deg, #f8fbfe 0%, #eef5fb 100%);
  border: none;
  border-radius: 12px;
  overflow: visible;
  background-clip: padding-box;
  box-shadow: none;
}
.report-graph-card #report-graph > * {
  max-width: 100%;
}
.report-graph-card #report-graph em {
  color: #5e738c;
  font-style: normal;
  font-weight: 600;
}
.report-graph__image {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
}
.report-graph__svg {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
}
.verification-report__status { display: inline-block; padding: 4px 8px; border-radius: 6px; font-weight: 700; }
.verification-report__status.is-correct { color: #17633b; background: #e8f7ee; }
.verification-report__status.is-wrong { color: #92372f; background: #fff0ee; }
.verification-report__status.is-pending { color: #526579; background: #edf2f7; }
.verification-report__table { table-layout: fixed; margin-top: 12px; }
.verification-report__table caption { caption-side: bottom; padding-top: 8px; color: #66788a; font-size: 11px; text-align: left; }
.verification-report__table th, .verification-report__table td { padding: 7px 8px; font-size: 11px; font-variant-numeric: tabular-nums; }
.verification-report__table thead th:first-child { width: 6%; }
.verification-report__table thead th:nth-child(2) { width: 26%; }
.verification-report__table thead th:last-child { width: 24%; }
.verification-report__table tbody th { color: #233a50; background: #f8fafc; border-color: #d9e2ec; text-align: left; font-weight: 600; }
.verification-empty { color: #66788a; font-style: italic; }
.report-graph__plot-bg {
  fill: #fffdf8;
  stroke: rgba(112, 82, 55, 0.28);
  stroke-width: 1;
}
.report-graph__band:nth-of-type(odd) {
  fill: rgba(51, 124, 102, 0.035);
}
.report-graph__band:nth-of-type(even) {
  fill: rgba(210, 78, 58, 0.025);
}
.report-graph__axis {
  fill: none;
  stroke: #563927;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.4;
}
.report-graph__svg marker path {
  fill: #563927;
}
.report-graph__grid {
  stroke: rgba(117, 88, 62, 0.2);
  stroke-width: 0.8;
}
.report-graph__grid--horizontal {
  stroke-dasharray: 4 8;
}
.report-graph__tick {
  stroke: rgba(74, 43, 31, 0.38);
  stroke-linecap: round;
  stroke-width: 1;
}
.report-graph__tick-label {
  fill: #6a4b34;
  font-size: 13px;
  font-weight: 700;
}
.report-graph__tick-label--y {
  font-size: 12px;
}
.report-graph__axis-title {
  fill: #38271c;
  font-size: 15px;
  font-weight: 800;
}
.report-graph__line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.2;
}
.report-graph__line--i1,
.report-graph__point--i1 {
  stroke: #c83f35;
}
.report-graph__line--i2,
.report-graph__point--i2 {
  stroke: #1579a8;
}
.report-graph__line--i3,
.report-graph__point--i3 {
  stroke: #3f8f43;
}
.report-graph__point {
  fill: #ffffff;
  stroke-width: 1.6;
}
.report-graph__series-label {
  dominant-baseline: middle;
  font-size: 13px;
  font-weight: 800;
  paint-order: stroke;
  stroke: #fffdf8;
  stroke-linejoin: round;
  stroke-width: 5px;
}
.report-graph__series-label--i1 {
  fill: #c83f35;
}
.report-graph__series-label--i2 {
  fill: #1579a8;
}
.report-graph__series-label--i3 {
  fill: #3f8f43;
}
.report-graph__series-label-sub {
  baseline-shift: sub;
  font-size: 72%;
}
.header-row {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr) 108px;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  break-inside: avoid-page;
  page-break-inside: avoid;
}
.report-title-block {
  text-align: center;
  margin: 0;
  padding-bottom: 10px;
  border-bottom: 3px solid #2f7bfa;
  min-width: 0;
}
.report-title-block h1 {
  font-size: 25px;
}
.report-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: #5c6f84;
}
.badge {
  margin: 0;
  padding: 7px 12px;
  border-radius: 20px;
  background: #e8f1ff;
  color: #1f62d0;
  font-weight: 600;
  font-size: 12px;
}
.report-logo {
  height: auto;
  width: auto;
  max-width: 108px;
  max-height: 84px;
  object-fit: contain;
  flex-shrink: 0;
  justify-self: center;
}
.report-logo--virtual-labs {
  max-width: 190px;
  max-height: 86px;
  justify-self: start;
}
.report-logo--iit {
  max-width: 88px;
  max-height: 88px;
  justify-self: end;
}
.report-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  width: min(100%, 960px);
  margin: 20px auto 0;
}
.print-btn,
.download-btn {
  padding: 12px 24px;
  font-size: 15px;
  border: none;
  border-radius: 30px;
  color: white;
  cursor: pointer;
  transition: all 0.25s ease;
}
.print-btn {
  background: linear-gradient(to right, #2f7bfa, #1f62d0);
}
.download-btn {
  background: linear-gradient(to right, #28a745, #1f8d38);
}
.print-btn:hover,
.download-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(31, 45, 61, 0.12);
}
@media screen and (max-width: 768px) {
  body {
    padding: 20px 14px 30px;
  }
  #report-print-frame .report-page {
    margin-bottom: 18px;
    padding: 20px 18px;
    border-radius: 16px;
  }
  #report-print-frame .header-row {
    grid-template-columns: 1fr;
    gap: 14px;
    text-align: center;
  }
  #report-print-frame .report-title-block {
    padding-bottom: 12px;
  }
  #report-print-frame .report-logo,
  #report-print-frame .report-logo--virtual-labs,
  #report-print-frame .report-logo--iit {
    max-height: 72px;
    justify-self: center;
  }
  #report-print-frame .two-column-list {
    column-count: 1;
    column-gap: 0;
  }
  #report-print-frame .compact-table th,
  #report-print-frame .compact-table td {
    padding: 9px 8px;
    font-size: 13px;
  }
  .report-actions {
    justify-content: center;
  }
  #report-print-frame .report-graph-card #report-graph {
    min-height: 300px;
  }
}
/* Exports use a hidden copy so the visible report never changes size or position. */
.report-export-stage { position: fixed; left: -10000px; top: 0; width: 1000px; height: 0; overflow: hidden; visibility: hidden; pointer-events: none; }
.report-output .report-document { display: flow-root; width: 1000px; padding: 6px; font-size: 14px; line-height: 1.25; }
.report-output .report-page { width: 100%; margin: 0 0 8px; padding: 8px 12px; break-before: auto; break-after: auto; break-inside: auto; page-break-before: auto; page-break-after: auto; page-break-inside: auto; }
.report-output .report-page:last-child { margin-bottom: 0; }
.report-output .section { padding: 8px 10px; margin-bottom: 6px; }
.report-output .section:last-child { margin-bottom: 0; }
.report-output .section > h2:first-child { margin-bottom: 6px; padding-bottom: 5px; }
.report-output h2 { font-size: 18px; }
.report-output h3 { font-size: 14px; margin-bottom: 4px; }
.report-output p { margin-bottom: 5px; }
.report-output .header-row { grid-template-columns: 150px minmax(0, 1fr) 86px; gap: 12px; margin-bottom: 8px; }
.report-output .report-title-block { padding-bottom: 6px; }
.report-output .report-title-block h1 { font-size: 24px; }
.report-output .report-logo { max-height: 54px; }
.report-output .report-logo--virtual-labs { max-width: 150px; }
.report-output .report-logo--iit { max-width: 70px; }
.report-output .report-overview-top { margin-bottom: 6px; }
.report-output .badge, .report-output .report-stamp { padding: 5px 8px; font-size: 12px; }
.report-output .report-experiment-label { margin-bottom: 4px; font-size: 11px; }
.report-output .report-experiment-title { margin-bottom: 6px; font-size: 20px; }
.report-output .info-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 6px; }
.report-output .info-card { padding: 6px 8px; gap: 2px; font-size: 12px; }
.report-output .two-column-list { margin-top: 6px; column-gap: 24px; }
.report-output li { margin-bottom: 2px; font-size: 13px; }
.report-output .results-stack { gap: 6px; }
.report-output .results-card { padding: 7px; gap: 4px; }
.report-output .compact-table th, .report-output .compact-table td { padding: 3px 6px; font-size: 12px; }
.report-output .verification-report__table { margin-top: 0; }
.report-output .verification-report__table th, .report-output .verification-report__table td { padding: 3px 6px; }
.report-output .verification-report__status { padding: 2px 5px; }
.report-output .report-graph-card #report-graph { height: 210px; min-height: 0; padding: 0; }
.report-output .report-graph__svg { width: 100%; height: 210px; }
.report-output .report-graph__tick-label, .report-output .report-graph__series-label { font-size: 18px; }
.report-output .report-graph__axis-title { font-size: 21px; }
@page { size: A4 portrait; margin: 8mm; }
@media print {
  *, *::before, *::after {
    print-color-adjust: exact !important;
    -webkit-print-color-adjust: exact !important;
  }
  html, body { width: 194mm; min-height: 0; margin: 0; padding: 0; background: #ffffff; }
  body > :not(#report-print-stage) { display: none !important; }
  #report-print-stage {
    display: block;
    position: relative;
    left: 0;
    visibility: visible;
    width: 194mm;
    height: var(--report-print-height);
    max-height: 281mm;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  #report-print-stage .report-document {
    position: absolute;
    top: 0;
    left: calc((194mm - var(--report-print-width)) / 2);
    margin: 0;
    transform: scale(var(--report-print-scale, 1));
    transform-origin: top left;
  }
}

  `

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kirchhoff Current Law Simulation Report</title>
  <base href="${escapeHtml(baseHref)}">
  <style>${css}</style>
</head>
<body id="report-root">
  <div id="report-print-frame">
  <main class="report-document" id="report-document">
  <div class="report-page report-page--overview">
    <div class="header-row">
      <img src="${escapeHtml(virtualLabsLogoSrc)}" class="report-logo report-logo--virtual-labs" alt="Virtual Labs logo">
      <div class="report-title-block">
        <h1>Virtual Labs Simulation Report</h1>

      </div>
      <img src="${escapeHtml(iitLogoSrc)}" class="report-logo report-logo--iit" alt="Indian Institute of Technology Roorkee logo">
    </div>

    <div class="section report-overview">
      <div class="report-overview-top">
        <p class="badge">AI Enhanced Basic Electrical Science Lab</p>
        <p class="report-stamp">Generated on ${escapeHtml(reportDateText)}</p>
      </div>
      <p class="report-experiment-label">Experiment Title</p>
      <p class="report-experiment-title">To Verify Kirchhoff's Current Law</p>
      <div class="info-grid">
        <div class="info-card"><span class="label">Start Time:</span>${escapeHtml(startTimeText)}</div>
        <div class="info-card"><span class="label">End Time:</span>${escapeHtml(endTimeText)}</div>
        <div class="info-card"><span class="label">Total Time Spent:</span>${escapeHtml(durationText)}</div>
      </div>
    </div>

    <div class="section">
      <h2>Summary</h2>
      <h3>Aim</h3>
      <p style="text-align: justify;">To verify Kirchhoff’s Current Law by measuring that the total current entering the junction is equal to the total current leaving it in a resistive DC circuit.
</p>
      <h3>Simulation Summary</h3>
      <p style="text-align: justify;">The guided walkthrough familiarised the user with the simulation's interface. The circuit was connected, and the connections were verified successfully. The resistance values were selected, and the DC supply voltage was varied to measure the branch currents at different voltage values. The ammeter readings were recorded, and the measured currents were used to verify Kirchhoff’s Current Law (KCL) by confirming that the total current entering a junction is equal to the total current leaving the junction. Along with the KCL verification, the current v/s voltage graph was also plotted using the measured readings.</p>

      <h3>Components and Key Parameters</h3>
      <ul class="two-column-list">
        <li>DC power supply: 15 V</li>
        <li>DC Ammeter A<sub>1</sub> for total current I<sub>1</sub>: 0 - 10 mA</li>
        <li>DC Ammeter A<sub>2</sub> for branch current I<sub>2</sub>: 0 - 10 mA</li>
        <li>DC Ammeter A<sub>3</sub> for branch current I<sub>3</sub>: 0 - 10 mA</li>
        <li>R<sub>1</sub>: ${formatResistance(r1)} k&Omega;</li>
        <li>R<sub>2</sub>: ${formatResistance(r2)} k&Omega;</li>
        <li>R<sub>3</sub>: ${formatResistance(r3)} k&Omega;</li>
        <li>Connecting leads</li>
      </ul>

    </div>
  </div>

  <div class="report-page report-page--results">
    <div class="section results-section">
      <h2>Results</h2>
      <div class="results-stack">
        <div class="results-card results-card--table">
          <h3>Observation Table</h3>
          <div class="table-shell">
            <table class="compact-table">
              <thead>
                <tr>
                  <th>S.No.</th>
                  <th>Voltage (V)</th>
                  <th>I<sub>1</sub> (mA)</th>
                  <th>I<sub>2</sub> (mA)</th>
                  <th>I<sub>3</sub> (mA)</th>
                </tr>
              </thead>
              <tbody>${observationRows}</tbody>
            </table>
          </div>
        </div>


      </div>
    </div>
  </div>

  <div class="report-page report-page--graph">
    <div class="section results-section">
      <h2>GRAPH AND THEORETICAL VERIFICATION</h2>
      <div class="results-stack">
        <div class="graph report-graph-card results-card results-card--graph">
          <h3 style="text-align: center;">Current v/s Voltage Graph</h3>
          <div id="report-graph">${graphSvg}</div>
        </div>

        <div class="results-card verification-report-card">
          <h3>Theoretical Verification</h3>
          ${verificationMarkup}
        </div>

        <div class="results-card">
          <h3>Conclusion</h3>
          <p style="text-align: justify;">For each recorded voltage value, the total current I<sub>1</sub> was found to be equal to the sum of branch currents I<sub>2</sub> and I<sub>3</sub>. Moreover, the theoretically calculated currents were found to be the same as the recorded readings. Hence, Kirchhoff’s Current Law was successfully verified for the given resistive DC circuit.</p>
        </div>
      </div>
    </div>
  </div>
  </main>
  </div>

  <div class="report-actions">
    <button class="print-btn" type="button" onclick="printReport()">PRINT</button>
    <button class="download-btn" type="button" onclick="downloadReport()">DOWNLOAD REPORT</button>
  </div>

  <script>
    var getReportPageScale = ${getReportPageScale.toString()};
    var createReportPdf = ${createReportPdf.toString()};
    var renderReportCanvas = ${renderReportCanvas.toString()};
    var reportAssets = ${JSON.stringify({
      script: new URL(pdfScriptUrl, baseHref).href,
    }).replaceAll('<', '\\u003c')};
    var pdfAssetsPromise;
    var downloadInProgress = false;
    var reportExportCount = 0;

    function waitForReportAssets() {
      var images = Array.from(document.querySelectorAll('#report-document img'));
      return Promise.all([
        document.fonts ? document.fonts.ready : Promise.resolve(),
        ...images.map(function(image) {
          if (image.complete) return Promise.resolve();
          return new Promise(function(resolve) {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
          });
        })
      ]);
    }

    function createReportOutput() {
      var stage = document.createElement('div');
      stage.className = 'report-export-stage report-output';
      stage.setAttribute('aria-hidden', 'true');
      var report = document.getElementById('report-document').cloneNode(true);
      report.removeAttribute('id');
      // Keep the copy's graph markers and clipping paths independent of the preview.
      var suffix = '-export-' + (++reportExportCount);
      report.querySelectorAll('svg [id]').forEach(function(definition) {
        var originalId = definition.id;
        definition.id = originalId + suffix;
        report.querySelectorAll('svg [marker-end], svg [clip-path]').forEach(function(element) {
          ['marker-end', 'clip-path'].forEach(function(attribute) {
            var value = element.getAttribute(attribute);
            if (value) element.setAttribute(attribute, value.replaceAll('url(#' + originalId + ')', 'url(#' + definition.id + ')'));
          });
        });
      });
      stage.appendChild(report);
      document.body.appendChild(stage);
      return stage;
    }

    function fitReportForPrint() {
      var stage = document.getElementById('report-print-stage') || createReportOutput();
      stage.id = 'report-print-stage';
      var report = stage.querySelector('.report-document');
      // The report's base URL points to app assets; printed SVG references must
      // point to this report document instead of that base URL.
      report.querySelectorAll('svg [marker-end], svg [clip-path]').forEach(function(element) {
        ['marker-end', 'clip-path'].forEach(function(attribute) {
          var value = element.getAttribute(attribute);
          if (value) element.setAttribute(attribute, value.replace('url(#', 'url(' + document.URL.split('#')[0] + '#'));
        });
      });
      // Measure the full, unscaled document, including repeated beforeprint events.
      report.style.transform = 'none';
      var width = Math.max(report.scrollWidth, report.getBoundingClientRect().width);
      var height = Math.max(report.scrollHeight, report.getBoundingClientRect().height);
      // A4 with 8 mm margins; reserve two pixels for browser rounding.
      var scale = getReportPageScale(width, height, 194 * 96 / 25.4 - 2, 281 * 96 / 25.4 - 2);
      document.documentElement.style.setProperty('--report-print-scale', scale);
      document.documentElement.style.setProperty('--report-print-width', (width * scale) + 'px');
      document.documentElement.style.setProperty('--report-print-height', (height * scale) + 'px');
      report.style.removeProperty('transform');
    }

    function restoreReportLayout() {
      var stage = document.getElementById('report-print-stage');
      if (stage) stage.remove();
      document.documentElement.style.removeProperty('--report-print-scale');
      document.documentElement.style.removeProperty('--report-print-width');
      document.documentElement.style.removeProperty('--report-print-height');
    }

    function printReport() {
      return waitForReportAssets().then(function() {
        fitReportForPrint();
        try {
          window.print();
        } catch (error) {
          restoreReportLayout();
          throw error;
        }
      });
    }

    window.addEventListener('beforeprint', fitReportForPrint);
    window.addEventListener('afterprint', restoreReportLayout);

    function loadPdfAssets() {
      if (pdfAssetsPromise) return pdfAssetsPromise;
      pdfAssetsPromise = (window.jspdf ? Promise.resolve() : new Promise(function(resolve, reject) {
        var script = document.createElement('script');
        script.src = reportAssets.script;
        script.onload = resolve;
        script.onerror = function() { script.remove(); reject(new Error('Unable to load the PDF renderer.')); };
        document.head.appendChild(script);
      })).catch(function(error) {
        pdfAssetsPromise = null;
        throw error;
      });
      return pdfAssetsPromise;
    }

    async function downloadReport() {
      if (downloadInProgress) return;
      downloadInProgress = true;
      var buttons = Array.from(document.querySelectorAll('.report-actions button'));
      buttons.forEach(function(button) { button.disabled = true; });
      var stage;
      try {
        await loadPdfAssets();
        await waitForReportAssets();
        stage = createReportOutput();
        var capture = await renderReportCanvas(stage.querySelector('.report-document'));
        var pdf = createReportPdf(window.jspdf.jsPDF, capture);
        if (pdf.internal.getNumberOfPages() !== 1) throw new Error('Report did not fit on one page.');
        pdf.save('KCL Simulation Report.pdf');
      } catch {
        alert("Unable to download the report automatically. Please use PRINT and select Save as PDF.");
      } finally {
        if (stage) stage.remove();
        downloadInProgress = false;
        buttons.forEach(function(button) { button.disabled = false; });
      }
    }

  </script>
</body>
</html>
  `
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
