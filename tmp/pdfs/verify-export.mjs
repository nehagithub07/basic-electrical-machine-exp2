import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'vite'
import { JSDOM } from 'jsdom'
import { jsPDF } from 'jspdf'
import { createReportPdf, readReportPdfContent } from '../../src/utils/reportPdf.js'
import { getExpectedAnswers } from '../../src/utils/verification.js'

const assets = {
  regularFont: readFileSync('src/assets/fonts/Inter-Report-Regular.ttf').toString('base64'),
  boldFont: readFileSync('src/assets/fonts/Inter-Report-Bold.ttf').toString('base64'),
  virtualLabsLogo: new Uint8Array(readFileSync('src/assets/image.png')),
  iitLogo: new Uint8Array(readFileSync('src/assets/IIT Logo.png')),
}
const observations = [3.5, 1, 5.2, 9.8, 15].map((voltage, index) => ({
  id: index + 1, voltage, r1: 1000, r2: 1000, r3: 1000, totalResistance: 1500,
  i1: voltage / 1.5, i2: voltage / 3, i3: voltage / 3,
}))
const entries = observations.map((reading) => ({
  readingId: reading.id, voltage: reading.voltage, expected: getExpectedAnswers(reading),
  answers: Object.fromEntries(Object.entries(getExpectedAnswers(reading)).map(([key, value]) => [key, value.toFixed(2)])),
  result: { correct: true, message: 'KCL verified' },
}))
globalThis.window = { location: { origin: 'http://localhost:5173' } }
let reportBlob
URL.createObjectURL = (blob) => { reportBlob = blob; return 'blob:qa' }
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { prepareKclReport } = await server.ssrLoadModule('/src/utils/reportGenerator.js')
  mkdirSync('output/pdf', { recursive: true })
  for (const allRows of [false, true]) {
    prepareKclReport({ observations, resistances: { r1: 1000, r2: 1000, r3: 1000 }, sessionStart: Date.now(), verification: allRows ? entries : [entries[1]] })
    const html = await reportBlob.text()
    const document = new JSDOM(html).window.document
    document.querySelector('.report-stamp').textContent = 'Generated on September 23, 2026'
    const session = ['Start Time: 4:39:28 PM', 'End Time: 4:50:40 PM', 'Total Time Spent: 11 min 12 sec']
    document.querySelectorAll('.info-card').forEach((element, index) => { element.textContent = session[index] })
    const content = readReportPdfContent(document.getElementById('report-document'), { observations, maxCurrent: 20 })
    const pdf = createReportPdf(jsPDF, content, assets)
    const target = allRows ? 'tmp/pdfs/max-readings.pdf' : 'output/pdf/KCL Simulation Report.pdf'
    writeFileSync(target, Buffer.from(pdf.output('arraybuffer')))
    writeFileSync('tmp/pdfs/report-content.json', JSON.stringify(content, null, 2))
    console.log(target, 'pages:', pdf.internal.getNumberOfPages())
  }
} finally {
  await server.close()
}
