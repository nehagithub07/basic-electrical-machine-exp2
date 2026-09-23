// Kept self-contained so the same renderer runs in the standalone report and in QA.
export const readReportPdfContent = (report, graph) => {
  const text = (element) => element?.textContent.replace(/\s+/g, ' ').trim() ?? ''
  const table = (selector) => {
    const element = report.querySelector(selector)
    return {
      headers: Array.from(element?.querySelectorAll('thead th') ?? [], text),
      rows: Array.from(element?.querySelectorAll('tbody tr') ?? [], (row) => Array.from(row.cells, text)),
    }
  }
  const summary = report.querySelector('.report-page--overview .section:not(.report-overview)')
  const conclusion = report.querySelector('.report-page--graph .results-card:last-child')
  return {
    title: text(report.querySelector('h1')),
    brand: text(report.querySelector('.badge')),
    date: text(report.querySelector('.report-stamp')),
    experiment: text(report.querySelector('.report-experiment-title')),
    session: Array.from(report.querySelectorAll('.info-card'), text),
    summaryTitle: text(summary?.querySelector('h2')),
    summary: Array.from(summary?.querySelectorAll('h3') ?? [], (heading) => ({
      heading: text(heading),
      paragraph: heading.nextElementSibling?.tagName === 'P' ? text(heading.nextElementSibling) : '',
      items: Array.from(heading.nextElementSibling?.querySelectorAll('li') ?? [], text),
    })),
    observation: table('.compact-table'),
    verification: table('.verification-report__table'),
    verificationEmpty: text(report.querySelector('.verification-empty')),
    graphTitle: text(report.querySelector('.report-graph-card h3')),
    graph,
    conclusionTitle: text(conclusion?.querySelector('h3')),
    conclusion: text(conclusion?.querySelector('p')),
  }
}

export const createReportPdf = (PdfDocument, content, assets) => {
  const pdf = new PdfDocument({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true, putOnlyUsedFonts: true })
  pdf.addFileToVFS('Report-Regular.ttf', assets.regularFont)
  pdf.addFont('Report-Regular.ttf', 'Report', 'normal')
  pdf.addFileToVFS('Report-Bold.ttf', assets.boldFont)
  pdf.addFont('Report-Bold.ttf', 'Report', 'bold')
  pdf.setProperties({ title: 'KCL Simulation Report', subject: "Kirchhoff's Current Law" })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 24
  const fullWidth = pageWidth - margin * 2
  const colors = { ink: '#243b53', muted: '#526579', blue: '#2473dc', pale: '#f4f7fb', line: '#d9e2ec' }

  const layout = (scale) => {
    const commands = []
    let y = margin
    const font = (size, bold = false) => {
      pdf.setFont('Report', bold ? 'bold' : 'normal')
      pdf.setFontSize(size * scale)
    }
    const rectangle = (x, top, width, height, fill, border) => commands.push(() => {
      pdf.setFillColor(fill)
      if (border) { pdf.setDrawColor(border); pdf.setLineWidth(0.4) }
      pdf.rect(x, top, width, height, border ? 'FD' : 'F')
    })
    const line = (x1, y1, x2, y2, color, width = 0.6) => commands.push(() => {
      pdf.setDrawColor(color)
      pdf.setLineWidth(width * scale)
      pdf.line(x1, y1, x2, y2)
    })
    const text = (value, x, top, width, { size = 9.2, bold = false, color = colors.ink, align = 'left' } = {}) => {
      font(size, bold)
      const lines = pdf.splitTextToSize(String(value), width)
      const height = lines.length * size * scale * 1.25
      commands.push(() => {
        font(size, bold)
        pdf.setTextColor(color)
        pdf.text(lines, x + (align === 'center' ? width / 2 : align === 'right' ? width : 0), top,
          { baseline: 'top', lineHeightFactor: 1.25, align })
      })
      return height
    }
    const card = (heading, build) => {
      const top = y
      const start = commands.length
      const padding = 9 * scale
      const x = margin + padding
      const width = fullWidth - 2 * padding
      y += padding
      if (heading) {
        y += text(heading, x, y, width, { size: 11, bold: true }) + 5 * scale
      }
      build(x, width)
      y += padding
      const bottom = y
      commands.splice(start, 0, () => {
        pdf.setFillColor(colors.pale)
        pdf.roundedRect(margin, top, fullWidth, bottom - top, 5 * scale, 5 * scale, 'F')
      })
      y += 7 * scale
    }
    const logo = (data, x, top, width, height) => {
      if (!data) return
      const image = pdf.getImageProperties(data)
      const ratio = Math.min(width / image.width, height / image.height)
      commands.push(() => pdf.addImage(data, 'PNG', x, top, image.width * ratio, image.height * ratio))
    }
    logo(assets.virtualLabsLogo, margin, y, 78 * scale, 40 * scale)
    logo(assets.iitLogo, pageWidth - margin - 40 * scale, y, 40 * scale, 40 * scale)
    text(content.title, margin + 90 * scale, y + 10 * scale, fullWidth - 140 * scale, { size: 15, bold: true, align: 'center' })
    y += 47 * scale
    line(margin, y, pageWidth - margin, y, colors.blue, 1.5)
    y += 8 * scale

    card('', (x, width) => {
      const rowHeight = Math.max(
        text(content.brand, x, y, width * 0.57, { size: 8, bold: true, color: colors.blue }),
        text(content.date, x + width * 0.59, y, width * 0.41, { size: 8, color: colors.muted, align: 'right' }),
      )
      y += rowHeight + 7 * scale
      y += text(content.experiment, x, y, width, { size: 14, bold: true }) + 7 * scale
      const columnWidth = width / 3
      y += Math.max(...content.session.map((value, index) => text(value, x + index * columnWidth, y, columnWidth - 8 * scale, { size: 8 })))
    })

    card(content.summaryTitle, (x, width) => {
      content.summary.forEach((section, index) => {
        if (index) y += 5 * scale
        y += text(section.heading, x, y, width, { size: 9.5, bold: true }) + 3 * scale
        if (section.paragraph) y += text(section.paragraph, x, y, width)
        if (section.items.length) {
          const midpoint = Math.ceil(section.items.length / 2)
          const top = y
          y = Math.max(...[section.items.slice(0, midpoint), section.items.slice(midpoint)].map((items, column) => {
            let rowY = top
            items.forEach((item) => { rowY += text('• ' + item, x + column * width / 2, rowY, width / 2 - 8 * scale, { size: 8.6 }) + 2 * scale })
            return rowY
          }))
        }
      })
    })

    const table = (data, x, width, ratios) => {
      const widths = ratios.map((ratio) => ratio * width)
      const padding = 4 * scale
      ;[data.headers, ...data.rows].forEach((cells, row) => {
        font(8.5, row === 0)
        const wrapped = cells.map((value, column) => pdf.splitTextToSize(String(value), widths[column] - padding * 2))
        const height = Math.max(18 * scale, ...wrapped.map((lines) => lines.length * 8.5 * scale * 1.25 + padding * 2))
        let left = x
        cells.forEach((value, column) => {
          let fill = row === 0 ? colors.blue : row % 2 === 0 ? '#f1f6fc' : '#ffffff'
          let color = row === 0 ? '#ffffff' : colors.ink
          if (row > 0 && column === cells.length - 1 && data === content.verification) {
            if (value === 'Verified') { fill = '#e8f7ee'; color = '#17633b' }
            else if (value === 'Not verified') { fill = '#fff0ee'; color = '#92372f' }
          }
          rectangle(left, y, widths[column], height, fill, colors.line)
          text(value, left + padding, y + padding, widths[column] - padding * 2, { size: 8.5, bold: row === 0, color, align: 'center' })
          left += widths[column]
        })
        y += height
      })
    }
    card('Observation Table', (x, width) => table(content.observation, x, width, [0.1, 0.24, 0.22, 0.22, 0.22]))

    card('', (x, width) => {
      y += text(content.graphTitle, x, y, width, { size: 10.5, bold: true, align: 'center' }) + 7 * scale
      const left = x + 38 * scale
      const top = y + 7 * scale
      const chartWidth = width - 55 * scale
      const chartHeight = 108 * scale
      const bottom = top + chartHeight
      const maxCurrent = content.graph.maxCurrent || 1
      rectangle(left, top, chartWidth, chartHeight, '#fffdf8', colors.line)
      for (let tick = 0; tick <= 4; tick++) {
        const tickY = bottom - chartHeight * tick / 4
        line(left, tickY, left + chartWidth, tickY, colors.line, 0.4)
        text((maxCurrent * tick / 4).toFixed(2), x, tickY - 4 * scale, 32 * scale, { size: 7, align: 'right' })
      }
      for (let tick = 0; tick <= 15; tick += 3) {
        const tickX = left + chartWidth * tick / 15
        line(tickX, top, tickX, bottom, colors.line, 0.4)
        text(String(tick), tickX - 9 * scale, bottom + 4 * scale, 18 * scale, { size: 7, align: 'center' })
      }
      line(left, bottom, left + chartWidth, bottom, colors.ink)
      line(left, top, left, bottom, colors.ink)
      const series = [['i1', '#c83f35'], ['i2', '#1579a8'], ['i3', '#3f8f43']]
      const observations = [...content.graph.observations].sort((a, b) => a.voltage - b.voltage)
      series.forEach(([key, color], index) => {
        let previous
        observations.forEach((reading) => {
          const pointX = left + Math.min(15, Math.max(0, Number(reading.voltage))) / 15 * chartWidth
          const pointY = bottom - Math.min(maxCurrent, Math.max(0, Number(reading[key]))) / maxCurrent * chartHeight
          if (previous) line(previous.x, previous.y, pointX, pointY, color, 1)
          commands.push(() => {
            pdf.setDrawColor(color)
            pdf.setFillColor('#ffffff')
            pdf.setLineWidth(0.8 * scale)
            pdf.circle(pointX, pointY, 1.6 * scale, 'FD')
          })
          previous = { x: pointX, y: pointY }
        })
        text(key.toUpperCase(), left + chartWidth - (100 - index * 35) * scale, top - 10 * scale, 30 * scale, { size: 7.5, bold: true, color })
      })
      text('Current (mA)', x, top - 14 * scale, 90 * scale, { size: 7.5 })
      y = bottom + 16 * scale
      y += text('Voltage (V)', left, y, chartWidth, { size: 7.5, align: 'center' })
    })
    card('Theoretical Verification', (x, width) => {
      if (content.verification.headers.length) table(content.verification, x, width, [0.07, 0.26, 0.12, 0.12, 0.12, 0.12, 0.19])
      else y += text(content.verificationEmpty, x, y, width)
    })
    card(content.conclusionTitle, (x, width) => { y += text(content.conclusion, x, y, width) })
    return { commands, bottom: y - 7 * scale }
  }

  let scale = 1
  let result = layout(scale)
  for (let attempt = 0; result.bottom > pageHeight - margin && attempt < 12; attempt++) {
    scale *= Math.min(0.97, (pageHeight - margin * 2) / (result.bottom - margin))
    result = layout(scale)
  }
  if (result.bottom > pageHeight - margin) throw new Error('The report could not fit on one page.')
  result.commands.forEach((draw) => draw())
  return pdf
}
