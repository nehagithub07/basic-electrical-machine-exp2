// Keep these functions self-contained: the report embeds them in its own window.
export const createSinglePagePdf = (canvas, PdfDocument) => {
  const pdf = new PdfDocument({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 8
  const scale = Math.min((pageWidth - 2 * margin) / canvas.width, (pageHeight - 2 * margin) / canvas.height)
  const width = canvas.width * scale
  const height = canvas.height * scale
  pdf.setProperties({ title: 'KCL Simulation Report', subject: 'Kirchhoff’s Current Law' })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageWidth - width) / 2, margin, width, height)
  return pdf
}

export const installReportActions = (assets, createPdf) => {
  const report = document.getElementById('report-document')
  const printButton = document.getElementById('print-report-button')
  const downloadButton = document.getElementById('download-report-button')
  const status = document.getElementById('report-export-status')
  let librariesPromise

  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = resolve
    script.onerror = () => reject(new Error('Unable to load PDF export.'))
    document.head.appendChild(script)
  })

  const ready = async () => {
    await document.fonts?.ready
    await Promise.all(Array.from(report.querySelectorAll('img'), (image) => image.decode().catch(() => {})))
  }

  const fitPrint = () => {
    // A4 with 8 mm margins; reserve a little room for browser rounding.
    const width = 194 * 96 / 25.4
    const height = 281 * 96 / 25.4
    const scale = Math.min(1, width / report.scrollWidth, height / report.scrollHeight) * 0.98
    report.style.setProperty('--report-print-scale', String(scale))
  }
  window.addEventListener('beforeprint', fitPrint)
  ready().then(fitPrint)

  printButton.addEventListener('click', async () => {
    await ready()
    fitPrint()
    window.print()
  })

  downloadButton.addEventListener('click', async () => {
    downloadButton.disabled = true
    status.textContent = 'Preparing report…'
    let graphImage
    let graphSvg
    let graphUrl
    try {
      await ready()
      if (!librariesPromise) {
        librariesPromise = Promise.all([
          window.html2canvas ? Promise.resolve() : loadScript(assets.canvas),
          window.jspdf ? Promise.resolve() : loadScript(assets.pdf),
        ])
      }
      await librariesPromise
      // html2canvas renders the graph reliably as an image with its embedded SVG styles.
      graphSvg = report.querySelector('#report-graph svg')
      if (graphSvg) {
        graphUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(graphSvg)], { type: 'image/svg+xml' }))
        graphImage = new Image()
        graphImage.src = graphUrl
        graphImage.alt = 'Current v/s Voltage Graph'
        graphImage.className = 'report-graph__image'
        await graphImage.decode()
        graphSvg.replaceWith(graphImage)
      }
      const canvas = await window.html2canvas(report, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1000,
      })
      const pdf = createPdf(canvas, window.jspdf.jsPDF)
      pdf.save('KCL Simulation Report.pdf')
      status.textContent = 'Report downloaded.'
    } catch {
      librariesPromise = null
      status.textContent = 'Unable to download. Use Print and choose Save as PDF.'
    } finally {
      if (graphImage?.isConnected && graphSvg) graphImage.replaceWith(graphSvg)
      if (graphUrl) URL.revokeObjectURL(graphUrl)
      downloadButton.disabled = false
    }
  })
}
