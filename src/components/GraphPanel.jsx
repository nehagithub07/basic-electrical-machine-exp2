const MIN_GRAPH_READINGS = 6
const VOLTAGE_MAX = 12
const CHART_VIEWBOX = {
  height: 220,
  width: 960,
}
const CHART = {
  height: 136,
  left: 88,
  top: 28,
  width: 784,
}
const X_TICKS = [0, 2, 4, 6, 8, 10, 12]
const Y_TICK_COUNT = 5
// Tune labelLeft and labelTop to manually adjust graph labels in SVG units.
const SERIES = [
  { className: 'i1', key: 'i1', labelIndex: '1', labelLeft: 0, labelOffset: -1, labelTop: 0, pointRadius: 1.9 },
  { className: 'i2', key: 'i2', labelIndex: '2', labelLeft: 0, labelOffset: 0, labelTop: 0, pointRadius: 1.8 },
  { className: 'i3', key: 'i3', labelIndex: '3', labelLeft: 0, labelOffset: -3, labelTop: 0, pointRadius: 2 },
]
const SERIES_LABEL = {
  height: 10,
  width: 18,
}
const SERIES_LABEL_GAP = 5

const getMaxCurrent = (observations) => {
  const maxCurrent = observations.reduce(
    (currentMax, row) => Math.max(currentMax, row.i1, row.i2, row.i3),
    0,
  )
  const paddedCurrent = Math.max(maxCurrent * 1.08, 0.1)
  const roughStep = paddedCurrent / (Y_TICK_COUNT - 1)
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const normalizedStep = roughStep / magnitude
  const niceStep = (
    normalizedStep <= 1 ? 1
      : normalizedStep <= 2 ? 2
        : normalizedStep <= 2.5 ? 2.5
          : normalizedStep <= 5 ? 5
            : 10
  ) * magnitude

  return niceStep * (Y_TICK_COUNT - 1)
}

const getPoint = (row, current, maxCurrent) => {
  return {
    x: getXFromVoltage(row.voltage),
    y: getYFromCurrent(current, maxCurrent),
  }
}

const getXFromVoltage = (voltage) => {
  const ratio = Math.min(Math.max(voltage / VOLTAGE_MAX, 0), 1)

  return CHART.left + ratio * CHART.width
}

const getYFromCurrent = (current, maxCurrent) => {
  const ratio = Math.min(Math.max(current / maxCurrent, 0), 1)

  return CHART.top + CHART.height - ratio * CHART.height
}

const formatCurrentTick = (value) => {
  if (value === 0) {
    return '0'
  }

  return value.toFixed(2)
}

const getYTicks = (maxCurrent) => (
  Array.from({ length: Y_TICK_COUNT }, (_, index) => (
    (maxCurrent / (Y_TICK_COUNT - 1)) * index
  ))
)

const getLinePath = (observations, currentKey, maxCurrent) => (
  observations
    .map((row, index) => {
      const point = getPoint(row, row[currentKey], maxCurrent)
      const command = index === 0 ? 'M' : 'L'

      return `${command}${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    })
    .join(' ')
)

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getSeriesLabelPoint = (observations, currentKey, maxCurrent, offset) => {
  const row = observations.at(-1)
  const point = getPoint(row, row[currentKey], maxCurrent)
  const minY = CHART.top + SERIES_LABEL.height / 2 + 2
  const maxY = CHART.top + CHART.height - SERIES_LABEL.height / 2 - 2

  return {
    point,
    x: Math.min(point.x + 14, CHART_VIEWBOX.width - SERIES_LABEL.width - 8),
    y: clamp(point.y + offset, minY, maxY),
  }
}

const getSeriesLabelPoints = (observations, maxCurrent) => {
  const minY = CHART.top + SERIES_LABEL.height / 2 + 2
  const maxY = CHART.top + CHART.height - SERIES_LABEL.height / 2 - 2
  const minGap = SERIES_LABEL.height + SERIES_LABEL_GAP
  const labels = SERIES
    .map((series) => ({
      ...getSeriesLabelPoint(observations, series.key, maxCurrent, series.labelOffset),
      series,
    }))
    .sort((current, next) => current.y - next.y)

  labels.forEach((label, index) => {
    if (index === 0) {
      label.y = Math.max(label.y, minY)
      return
    }

    label.y = Math.max(label.y, labels[index - 1].y + minGap)
  })

  if (labels.at(-1)?.y > maxY) {
    labels[labels.length - 1].y = maxY

    for (let index = labels.length - 2; index >= 0; index -= 1) {
      labels[index].y = Math.min(labels[index].y, labels[index + 1].y - minGap)
    }
  }

  if (labels[0]?.y < minY) {
    const shift = minY - labels[0].y

    labels.forEach((label) => {
      label.y += shift
    })
  }

  return labels.map((label) => ({
    ...label,
    x: label.x + (label.series.labelLeft ?? 0),
    y: label.y + (label.series.labelTop ?? 0),
  }))
}

const SvgCurrentLabel = ({ index }) => (
  <>
    I<tspan className="graph-panel__series-label-sub" dx="1">{index}</tspan>
  </>
)

const GraphPanel = ({ className = '', id, observations = [], plotted = false }) => {
  const shouldPlot = plotted && observations.length >= MIN_GRAPH_READINGS
  const plottedObservations = [...observations].sort((current, next) => current.voltage - next.voltage)
  const maxCurrent = getMaxCurrent(plottedObservations)
  const yTicks = getYTicks(maxCurrent)
  const chartBottom = CHART.top + CHART.height
  const chartRight = CHART.left + CHART.width
  const yAxisTitleX = 27
  const yAxisTitleY = CHART.top + CHART.height / 2
  const seriesLabelPoints = shouldPlot ? getSeriesLabelPoints(plottedObservations, maxCurrent) : []

  return (
    <section className={`graph-panel ${shouldPlot ? 'graph-panel--plotted' : ''} ${className}`} id={id} aria-label="Observation graph">
      <div className="graph-panel__heading">
        <div>
          
          <h2>GRAPH</h2>
        </div>

        {/* <div className="graph-panel__legend" aria-label="Current lines">
          <span><i className="graph-panel__dot graph-panel__dot--i1" /><CurrentLabel index="1" /></span>
          <span><i className="graph-panel__dot graph-panel__dot--i2" /><CurrentLabel index="2" /></span>
          <span><i className="graph-panel__dot graph-panel__dot--i3" /><CurrentLabel index="3" /></span>
        </div> */}
      </div>

      <div className="graph-panel__body">
        <svg
          className="graph-panel__chart"
          preserveAspectRatio="none"
          role="img"
          aria-label="Line graph of current in amperes against voltage in volts"
          viewBox={`0 0 ${CHART_VIEWBOX.width} ${CHART_VIEWBOX.height}`}
        >
          <defs>
            <marker id="graph-axis-arrow" markerHeight="6" markerWidth="7" orient="auto" refX="6" refY="3">
              <path d="M0 0 6 3 0 6z" />
            </marker>
            <clipPath id="graph-plot-clip">
              <rect height={CHART.height} width={CHART.width} x={CHART.left} y={CHART.top} />
            </clipPath>
          </defs>

          <rect className="graph-panel__plot-bg" height={CHART.height} width={CHART.width} x={CHART.left} y={CHART.top} />
          {yTicks.slice(0, -1).map((tick, index) => {
            const nextTick = yTicks[index + 1]
            const y = getYFromCurrent(nextTick, maxCurrent)
            const height = getYFromCurrent(tick, maxCurrent) - y

            return <rect className="graph-panel__band" height={height} key={`band-${tick}`} width={CHART.width} x={CHART.left} y={y} />
          })}

          {X_TICKS.map((tick) => {
            const x = getXFromVoltage(tick)

            return (
              <g key={`x-${tick}`}>
                <line className="graph-panel__grid-line graph-panel__grid-line--vertical" x1={x} x2={x} y1={CHART.top} y2={chartBottom} />
                <line className="graph-panel__tick-line" x1={x} x2={x} y1={chartBottom} y2={chartBottom + 6} />
                <text className="graph-panel__tick-label" textAnchor="middle" x={x} y={chartBottom + 22}>{tick}</text>
              </g>
            )
          })}

          {yTicks.map((tick) => {
            const y = getYFromCurrent(tick, maxCurrent)

            return (
              <g key={`y-${tick}`}>
                <line className="graph-panel__grid-line graph-panel__grid-line--horizontal" x1={CHART.left} x2={chartRight} y1={y} y2={y} />
                <line className="graph-panel__tick-line" x1={CHART.left - 6} x2={CHART.left} y1={y} y2={y} />
                <text className="graph-panel__tick-label graph-panel__tick-label--y" textAnchor="end" x={CHART.left - 11} y={y + 4}>{formatCurrentTick(tick)}</text>
              </g>
            )
          })}

          <path className="graph-panel__axis-line graph-panel__axis-line--x" d={`M${CHART.left} ${chartBottom}H${chartRight + 15}`} markerEnd="url(#graph-axis-arrow)" />
          <path className="graph-panel__axis-line graph-panel__axis-line--y" d={`M${CHART.left} ${chartBottom}V${CHART.top - 12}`} markerEnd="url(#graph-axis-arrow)" />

          <text className="graph-panel__axis-title graph-panel__axis-title--x" textAnchor="middle" x={CHART.left + CHART.width / 2} y={CHART_VIEWBOX.height - 12}>
            Voltage (V)
          </text>
          <text
            className="graph-panel__axis-title graph-panel__axis-title--y"
            textAnchor="middle"
            transform={`rotate(-90 ${yAxisTitleX} ${yAxisTitleY})`}
            x={yAxisTitleX}
            y={yAxisTitleY}
          >
            Current (A)
          </text>

          {!shouldPlot && (
            <text className="graph-panel__message" textAnchor="middle" x={CHART.left + CHART.width / 2} y={CHART.top + CHART.height / 2} />
          )}

          {shouldPlot && (
            <g className="graph-panel__plot">
              <g clipPath="url(#graph-plot-clip)">
                {SERIES.map((series) => (
                  <path
                    className={`graph-panel__line graph-panel__line--${series.className}`}
                    d={getLinePath(plottedObservations, series.key, maxCurrent)}
                    key={series.key}
                  />
                ))}
              </g>

              {SERIES.map((series) => (
                <g key={`${series.key}-points`}>
                  {plottedObservations.map((row) => {
                    const point = getPoint(row, row[series.key], maxCurrent)

                    return (
                      <circle
                        className={`graph-panel__point graph-panel__point--${series.className}`}
                        cx={point.x}
                        cy={point.y}
                        key={`${series.key}-${row.id}`}
                        r={series.pointRadius}
                      />
                    )
                  })}
                </g>
              ))}

              {seriesLabelPoints.map(({ point, series, x, y }) => {
                return (
                  <g className="graph-panel__series-label-group" key={`${series.key}-label`}>
                    <path
                      className={`graph-panel__series-label-leader graph-panel__series-label-leader--${series.className}`}
                      d={`M${point.x + 5} ${point.y}L${x - 8} ${y}`}
                    />
                    <rect
                      className={`graph-panel__series-label-bg graph-panel__series-label-bg--${series.className}`}
                      height={SERIES_LABEL.height}
                      rx="5"
                      width={SERIES_LABEL.width}
                      x={x - 6}
                      y={y - SERIES_LABEL.height / 2}
                    />
                    <text
                      className={`graph-panel__series-label graph-panel__series-label--${series.className}`}
                      x={x}
                      y={y}
                    >
                      <SvgCurrentLabel index={series.labelIndex} />
                    </text>
                  </g>
                )
              })}
            </g>
          )}
        </svg>
      </div>
    </section>
  )
}

export default GraphPanel
