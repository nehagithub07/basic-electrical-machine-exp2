const SPOTLIGHT_PADDING = 12
const round = (value) => Math.round(value)

const getSpotlightBox = (rect) => {
  if (!rect) {
    return null
  }

  return {
    height: round(Math.max(rect.height + SPOTLIGHT_PADDING * 2, 28)),
    left: round(rect.left - SPOTLIGHT_PADDING),
    top: round(rect.top - SPOTLIGHT_PADDING),
    width: round(Math.max(rect.width + SPOTLIGHT_PADDING * 2, 28)),
  }
}

const getDimPanels = (spotlightBox) => {
  const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 768 : window.innerHeight

  if (!spotlightBox) {
    return [{
      height: viewportHeight,
      key: 'full',
      left: 0,
      top: 0,
      width: viewportWidth,
    }]
  }

  const top = Math.max(spotlightBox.top, 0)
  const left = Math.max(spotlightBox.left, 0)
  const right = Math.min(spotlightBox.left + spotlightBox.width, viewportWidth)
  const bottom = Math.min(spotlightBox.top + spotlightBox.height, viewportHeight)

  return [
    {
      height: top,
      key: 'top',
      left: 0,
      top: 0,
      width: viewportWidth,
    },
    {
      height: Math.max(viewportHeight - bottom, 0),
      key: 'bottom',
      left: 0,
      top: bottom,
      width: viewportWidth,
    },
    {
      height: Math.max(bottom - top, 0),
      key: 'left',
      left: 0,
      top,
      width: left,
    },
    {
      height: Math.max(bottom - top, 0),
      key: 'right',
      left: right,
      top,
      width: Math.max(viewportWidth - right, 0),
    },
  ]
}

const getBoxStyle = (box) => ({
  height: box.height,
  left: box.left,
  top: box.top,
  width: box.width,
})

const Spotlight = ({ rect }) => {
  const spotlightBox = getSpotlightBox(rect)
  const dimPanels = getDimPanels(spotlightBox)

  return (
    <>
      {dimPanels.map((panel) => (
        <div
          aria-hidden="true"
          className="walkthrough-dim-panel"
          key={panel.key}
          style={getBoxStyle(panel)}
        />
      ))}

      {spotlightBox ? (
        <div
          aria-hidden="true"
          className="walkthrough-spotlight-ring"
          style={getBoxStyle(spotlightBox)}
        />
      ) : null}
    </>
  )
}

export default Spotlight
