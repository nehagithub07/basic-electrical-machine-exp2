// Kept self-contained so the same renderer runs in the standalone report window.
export const renderReportCanvas = async (report) => {
  const document = report.ownerDocument
  const width = Math.ceil(Math.max(report.scrollWidth, report.getBoundingClientRect().width))
  const height = Math.ceil(Math.max(report.scrollHeight, report.getBoundingClientRect().height))
  const clone = report.cloneNode(true)
  clone.style.transform = 'none'
  clone.style.position = 'static'
  clone.style.margin = '0'

  // Inline the logos so the captured report has no external image dependencies.
  await Promise.all(Array.from(clone.querySelectorAll('img'), async (image) => {
    const response = await fetch(image.src)
    if (!response.ok) throw new Error('Unable to load a report image.')
    const blob = await response.blob()
    image.src = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    image.removeAttribute('srcset')
  }))

  // The browser renders the original HTML, including justification, grid, and SVG.
  const wrapper = document.createElement('div')
  wrapper.className = 'report-output'
  const computed = document.defaultView.getComputedStyle(report)
  for (const property of ['font-family', 'font-size', 'color', 'overflow-wrap']) {
    wrapper.style.setProperty(property, computed.getPropertyValue(property))
  }
  // Preserve unitless inheritance for smaller table cells and larger headings.
  wrapper.style.lineHeight = parseFloat(computed.lineHeight) / parseFloat(computed.fontSize)
  wrapper.style.width = width + 'px'
  wrapper.style.background = '#ffffff'
  const style = document.createElement('style')
  style.textContent = Array.from(document.querySelectorAll('style'), (element) => element.textContent).join('\n')
  wrapper.append(style, clone)

  const namespace = 'http://www.w3.org/2000/svg'
  const pixelRatio = 3
  const svg = document.createElementNS(namespace, 'svg')
  svg.setAttribute('width', width * pixelRatio)
  svg.setAttribute('height', height * pixelRatio)
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)
  const foreignObject = document.createElementNS(namespace, 'foreignObject')
  foreignObject.setAttribute('width', '100%')
  foreignObject.setAttribute('height', '100%')
  foreignObject.append(wrapper)
  svg.append(foreignObject)
  const image = new Image()
  image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg))
  await image.decode()

  const canvas = document.createElement('canvas')
  canvas.width = width * pixelRatio
  canvas.height = height * pixelRatio
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to render the report.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return { canvas, width, height }
}

export const createReportPdf = (PdfDocument, { canvas, width, height }) => {
  const pdf = new PdfDocument({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true })
  pdf.setProperties({ title: 'KCL Simulation Report', subject: "Kirchhoff's Current Law" })
  const pointsPerPixel = 72 / 96
  const margin = 8 * 72 / 25.4
  // Match Print's 8 mm margins and two-pixel rounding allowance exactly.
  const scale = Math.min(1,
    ((pdf.internal.pageSize.getWidth() - margin * 2) / pointsPerPixel - 2) / width,
    ((pdf.internal.pageSize.getHeight() - margin * 2) / pointsPerPixel - 2) / height,
  ) * pointsPerPixel
  const left = (pdf.internal.pageSize.getWidth() - width * scale) / 2
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', left, margin, width * scale, height * scale)
  return pdf
}
