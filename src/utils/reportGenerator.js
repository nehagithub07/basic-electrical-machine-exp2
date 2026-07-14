const GRAPH_VIEWBOX = {
  height: 320,
  width: 960,
}

const GRAPH_CHART = {
  height: 178,
  left: 92,
  top: 48,
  width: 762,
}

const GRAPH_VOLTAGE_MAX = 12
const GRAPH_X_TICKS = [0, 2, 4, 6, 8, 10, 12]
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

const formatResistance = (value) => formatNumber(value, 1)

const calculateTotalResistance = ({ r1, r2, r3 }) => {
  const parallelDenominator = r2 + r3

  if (parallelDenominator === 0) {
    return 0
  }

  return r1 + ((r2 * r3) / parallelDenominator)
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
        Current (A)
      </text>

      <g clip-path="url(#report-graph-plot-clip)">
        ${lineMarkup}
      </g>
      ${pointMarkup}
      ${labelMarkup}
    </svg>
  `
}

const getKclStats = (observations) => {
  const errors = observations.map((row) => Math.abs(toNumber(row.i1) - (toNumber(row.i2) + toNumber(row.i3))))
  const totalError = errors.reduce((sum, error) => sum + error, 0)

  return {
    averageError: errors.length ? totalError / errors.length : 0,
    maxError: errors.length ? Math.max(...errors) : 0,
  }
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
        <td>${formatNumber(row.voltage, 1)}</td>
        <td>${formatNumber(row.i1)}</td>
        <td>${formatNumber(row.i2)}</td>
        <td>${formatNumber(row.i3)}</td>
      </tr>
    `
  }).join('')
)

const createReportHtml = ({
  baseHref,
  iitLogoSrc,
  observations,
  resistances,
  sessionStart,
  virtualLabsLogoSrc,
}) => {
  const reportDate = new Date()
  const sessionEnd = reportDate.getTime()
  const reportDateText = reportDate.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const startTimeText = new Date(sessionStart).toLocaleTimeString()
  const endTimeText = reportDate.toLocaleTimeString()
  const durationText = getSessionDurationText(sessionStart, sessionEnd)
  const firstObservation = observations[0] ?? {}
  const r1 = toNumber(resistances?.r1 ?? firstObservation.r1)
  const r2 = toNumber(resistances?.r2 ?? firstObservation.r2)
  const r3 = toNumber(resistances?.r3 ?? firstObservation.r3)
  const totalResistance = toNumber(firstObservation.totalResistance ?? calculateTotalResistance({ r1, r2, r3 }))
  const { averageError, maxError } = getKclStats(observations)
  const observationRows = createObservationRows(observations)
  const graphSvg = createReportGraphSvg(observations)

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
.report-page--results {
  break-before: page;
  page-break-before: always;
}
.report-page--graph {
  break-before: page;
  page-break-before: always;
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
.pdf-exporting .report-page {
  border-color: transparent !important;
  box-shadow: none !important;
  margin-bottom: 0 !important;
}
.pdf-exporting .section,
.pdf-exporting .results-card,
.pdf-exporting .table-shell,
.pdf-exporting .report-graph-card #report-graph {
  overflow: visible !important;
}
.pdf-exporting .report-page--overview,
.pdf-exporting .report-page--results {
  break-after: page !important;
  page-break-after: always !important;
}
@media (max-width: 768px) {
  body {
    padding: 20px 14px 30px;
  }
  .report-page {
    margin-bottom: 18px;
    padding: 20px 18px;
    border-radius: 16px;
  }
  .header-row {
    grid-template-columns: 1fr;
    gap: 14px;
    text-align: center;
  }
  .report-title-block {
    padding-bottom: 12px;
  }
  .report-logo,
  .report-logo--virtual-labs,
  .report-logo--iit {
    max-height: 72px;
    justify-self: center;
  }
  .two-column-list {
    column-count: 1;
    column-gap: 0;
  }
  .compact-table th,
  .compact-table td {
    padding: 9px 8px;
    font-size: 13px;
  }
  .report-actions {
    justify-content: center;
  }
  .report-graph-card #report-graph {
    min-height: 300px;
  }
}
@media print {
  @page {
    size: A4;
    margin: 12mm;
  }
  *,
  *::before,
  *::after {
    print-color-adjust: exact !important;
    -webkit-print-color-adjust: exact !important;
  }
  .print-btn,
  .download-btn,
  .report-actions {
    display: none !important;
  }
  body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    overflow: visible;
  }
  .report-document {
    width: 100%;
  }
  .report-page {
    width: 100%;
    margin: 0;
    padding: 16px 18px;
    border: none;
    box-shadow: none;
    border-radius: 0;
  }
  .header-row {
    grid-template-columns: 150px minmax(0, 1fr) 86px;
    gap: 16px;
  }
  .report-experiment-title {
    font-size: 22px;
  }
  .report-graph-card #report-graph {
    width: 100%;
    height: 320px;
    min-height: 0;
    overflow: hidden;
  }
  .report-graph__svg,
  .report-graph__image {
    display: block;
    width: 100%;
    height: 320px;
    object-fit: contain;
  }
  h1,
  h2,
  h3,
  table,
  .table-shell,
  .results-card,
  .results-section,
  .report-title-block,
  .section,
  .header-row,
  .info-grid,
  .report-graph-card,
  .graph,
  thead,
  tr {
    break-inside: avoid;
    page-break-inside: avoid;
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
      <p style="text-align: justify;">To verify Kirchhoff’s Current Law by measuring the total current entering and leaving a junction in a resistive DC circuit.</p>
      <h3>Simulation Summary</h3>
      <p style="text-align: justify;">The circuit was connected, and the connections were verified successfully. The resistance values were selected, and the DC supply voltage was varied to measure the branch currents at different voltage values. The ammeter readings were recorded, and the current–voltage graph was plotted using the measured readings.</p>

      <h3>Components and Key Parameters</h3>
      <ul class="two-column-list">
        <li>DC power supply: 10 V</li>
        <li>DC Ammeter A<sub>1</sub> for total current I<sub>1</sub>: 0 - 10 V</li>
        <li>DC Ammeter A<sub>2</sub> for branch current I<sub>2</sub>: 0 - 10 V</li>
        <li>DC Ammeter A<sub>3</sub> for branch current I<sub>3</sub>: 0 - 10 V</li>
        <li>R<sub>1</sub>: ${formatResistance(r1)} &Omega;</li>
        <li>R<sub>2</sub>: ${formatResistance(r2)} &Omega;</li>
        <li>R<sub>3</sub>: ${formatResistance(r3)} &Omega;</li>
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
                  <th>I<sub>1</sub> (A)</th>
                  <th>I<sub>2</sub> (A)</th>
                  <th>I<sub>3</sub> (A)</th>
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
      <h2>Graph and Conclusion</h2>
      <div class="results-stack">
        <div class="graph report-graph-card results-card results-card--graph">
          <h3>Current versus Voltage Graph</h3>
          <div id="report-graph">${graphSvg}</div>
        </div>

        <div class="results-card">
          <h3>Conclusion</h3>
          <p style="text-align: justify;">For each recorded voltage value, the total current I<sub>1</sub>  was found to be equal to the sum of branch currents I<sub>2</sub> and I<sub>3</sub>. Hence, Kirchhoff’s Current Law was verified for the given resistive DC circuit.</p>
        </div>
      </div>
    </div>
  </div>
  </main>

  <div class="report-actions" data-html2canvas-ignore="true">
    <button class="print-btn" type="button" onclick="window.print()">PRINT</button>
    <button class="download-btn" type="button" onclick="downloadReport()">DOWNLOAD REPORT</button>
  </div>

  <script>
    function ensureHtml2Pdf() {
      return new Promise(function(resolve, reject) {
        if (window.html2pdf) return resolve();
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    function prepareReportGraphImage() {
      return new Promise(function(resolve) {
        var graphContainer = document.getElementById('report-graph');
        var svg = graphContainer && graphContainer.querySelector('svg');

        if (!graphContainer || !svg) return resolve();

        try {
          var viewBox = svg.viewBox && svg.viewBox.baseVal;
          var width = viewBox && viewBox.width ? viewBox.width : 960;
          var height = viewBox && viewBox.height ? viewBox.height : 320;
          var svgText = new XMLSerializer().serializeToString(svg);
          var svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
          var svgUrl = URL.createObjectURL(svgBlob);
          var image = new Image();

          image.onload = function() {
            var canvas = document.createElement('canvas');
            var scale = 2;
            canvas.width = width * scale;
            canvas.height = height * scale;

            var context = canvas.getContext('2d');
            context.fillStyle = '#f8fbfe';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            var png = new Image();
            png.className = 'report-graph__image';
            png.alt = 'Current versus voltage graph';
            png.src = canvas.toDataURL('image/png');
            graphContainer.innerHTML = '';
            graphContainer.appendChild(png);

            URL.revokeObjectURL(svgUrl);
            resolve();
          };

          image.onerror = function() {
            URL.revokeObjectURL(svgUrl);
            resolve();
          };

          image.src = svgUrl;
        } catch {
          resolve();
        }
      });
    }

    function downloadReport() {
      prepareReportGraphImage().then(ensureHtml2Pdf).then(function() {
        var element = document.getElementById('report-document') || document.body;
        var opts = {
          margin: [0.18, 0.18, 0.18, 0.18],
          filename: 'kcl-simulation-report.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            scrollX: 0,
            scrollY: 0,
            onclone: function(clonedDoc) {
              clonedDoc.body.classList.add('pdf-exporting');
            }
          },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
          pagebreak: {
            mode: ['css', 'legacy'],
            before: ['.report-page--results', '.report-page--graph'],
            avoid: ['.report-page', '.header-row', '.report-overview', '.info-grid', '.report-graph-card', 'thead', 'tr']
          }
        };
        return window.html2pdf().set(opts).from(element).save();
      }).catch(function() {
        alert('Unable to download the report automatically. Please use your browser\\'s Save as PDF option.');
      });
    }
  </script>
</body>
</html>
  `
}

export const generateKclReport = ({ observations, resistances, sessionStart }) => {
  const baseHref = new URL(import.meta.env.BASE_URL, window.location.origin).href
  const iitLogoSrc = new URL('../assets/IIT Logo.png', import.meta.url).href
  const virtualLabsLogoSrc = new URL('../assets/image.png', import.meta.url).href
  const reportHtml = createReportHtml({
    baseHref,
    iitLogoSrc,
    observations,
    resistances,
    sessionStart,
    virtualLabsLogoSrc,
  })
  const reportBlob = new Blob([reportHtml], { type: 'text/html' })
  const reportUrl = URL.createObjectURL(reportBlob)
  const reportWindow = window.open(reportUrl, '_blank')

  if (!reportWindow) {
    URL.revokeObjectURL(reportUrl)
    return false
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(reportUrl)
  }, 60000)
  reportWindow.focus()

  return true
}
