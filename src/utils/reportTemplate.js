import { getExpectedAnswers, getValueFeedback } from './verification.js'
import { createSinglePagePdf, installReportActions } from './reportExport.js'

const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
const number = (value) => value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(2)

const verificationTables = (observations, verification) => {
  const entries = Object.values(verification ?? {})
  const rows = observations.map((reading) => ({
    reading,
    expected: getExpectedAnswers(reading),
    entry: entries.find((entry) => String(entry.readingId) === String(reading.id)),
  }))
  const resistanceRows = rows.map(({ reading, expected, entry }) => {
    const entered = entry?.answers?.equivalentResistance
    const feedback = getValueFeedback(entered, expected.equivalentResistance, true)
    return `<tr><td>${escape(reading.id)}</td><td>${number(reading.voltage)}</td>
      <td>${number(entered)}</td><td>${number(expected.equivalentResistance)}</td>
      <td>${feedback === 'Required' ? 'Not entered' : feedback}</td></tr>`
  }).join('')
  const currentRows = rows.map(({ reading, expected, entry }) => {
    const answers = entry?.answers ?? {}
    const sum = answers.i2Result != null && answers.i2Result !== '' && answers.i3Result != null && answers.i3Result !== ''
      ? Number(answers.i2Result) + Number(answers.i3Result) : null
    const state = entry?.result ? (entry.result.correct ? 'Verified' : 'Check values') : 'Pending'
    return `<tr><td>${escape(reading.id)}</td>${['i1Result', 'i2Result', 'i3Result'].map((key) =>
      `<td>${number(answers[key])} / ${number(expected[key])}</td>`).join('')}
      <td>${number(sum)}</td><td class="${entry?.result?.correct ? 'verified' : ''}">${state}</td></tr>`
  }).join('')
  return `
    <h3>Equivalent Resistance (R)</h3>
    <p class="formula">R = R<sub>1</sub> + (R<sub>2</sub> × R<sub>3</sub>) / (R<sub>2</sub> + R<sub>3</sub>)</p>
    <table aria-label="Equivalent resistance verification"><thead><tr><th>Reading</th><th>V (V)</th><th>Entered R (kΩ)</th><th>Expected R (kΩ)</th><th>Result</th></tr></thead><tbody>${resistanceRows}</tbody></table>
    <h3>I<sub>1</sub>, I<sub>2</sub> and I<sub>3</sub> — KCL verification: I<sub>1</sub> = I<sub>2</sub> + I<sub>3</sub></h3>
    <p class="formula">I<sub>1</sub> = V / R; I<sub>2</sub> = I<sub>1</sub> × R<sub>3</sub> / (R<sub>2</sub> + R<sub>3</sub>); I<sub>3</sub> = I<sub>1</sub> × R<sub>2</sub> / (R<sub>2</sub> + R<sub>3</sub>)</p>
    <table aria-label="KCL current verification"><thead><tr><th>Reading</th><th>I<sub>1</sub> (mA)<small>Entered / Expected</small></th><th>I<sub>2</sub> (mA)<small>Entered / Expected</small></th><th>I<sub>3</sub> (mA)<small>Entered / Expected</small></th><th>I<sub>2</sub> + I<sub>3</sub><small>(mA)</small></th><th>KCL result</th></tr></thead><tbody>${currentRows}</tbody></table>
    <p class="note">Values are rounded to two decimal places. Verification allows for rounding; unsubmitted readings remain pending.</p>`
}

export const renderReportTemplate = ({ baseHref, iitLogoSrc, virtualLabsLogoSrc, observations, verification,
  resistances, observationRows, graphSvg, reportDateText, startTimeText, endTimeText, durationText, assets }) => {
  const verifiedCount = observations.filter((reading) => verification?.[reading.id]?.result?.correct).length
  const conclusion = verifiedCount > 0
    ? `KCL was verified for ${verifiedCount} of ${observations.length} recorded readings: the total current equals the sum of the branch currents within the rounding tolerance.`
    : 'The recorded currents satisfy KCL. Complete theoretical verification to confirm the entered calculations.'
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>KCL Simulation Report</title><base href="${escape(baseHref)}">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 20px 12px; background: #eef3f8; color: #20364b; font: 11px/1.35 Arial, sans-serif; }
  .report-document { width: 760px; margin: 0 auto; padding: 20px 24px; background: white; border: 1px solid #d7e0e9; border-radius: 12px; box-shadow: 0 8px 30px #20364b18; }
  .header-row { display: grid; grid-template-columns: 100px 1fr 58px; align-items: center; gap: 14px; border-bottom: 2px solid #28629a; padding-bottom: 10px; }
  .header-row img { width: 100%; max-height: 50px; object-fit: contain; }
  .report-title { text-align: center; }
  h1 { margin: 0; font-size: 23px; color: #173c60; }
  .report-title p { margin: 3px 0 0; font-size: 11px; }
  h2 { margin: 0 0 6px; font-size: 13px; color: #173c60; }
  h3 { margin: 8px 0 4px; font-size: 11px; color: #244f76; }
  p { margin: 4px 0; }
  .metadata { display: flex; justify-content: space-between; gap: 10px; padding: 7px 0; font-size: 10px; }
  .aim { padding: 7px 9px; background: #f2f6fa; border-left: 3px solid #28629a; }
  section { margin-top: 10px; break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; font-variant-numeric: tabular-nums; }
  th, td { padding: 4px 6px; border: 1px solid #cdd9e4; text-align: center; overflow-wrap: anywhere; vertical-align: middle; }
  th { background: #eaf1f8; color: #173c60; font-weight: 700; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  th small { display: block; font-size: 9px; font-weight: 400; }
  .components th:first-child, .components td:first-child { width: 30%; text-align: left; }
  .graph-title { text-align: center; }
  #report-graph { height: 210px; }
  .report-graph__svg, .report-graph__image { display: block; width: 100%; height: 100%; object-fit: contain; }
  .formula { font-size: 10px; color: #476077; margin: 3px 0 5px; }
  .note { color: #607488; font-size: 9px; }
  .verified { color: #17653e; font-weight: 700; }
  .conclusion { padding-top: 7px; border-top: 1px solid #d7e0e9; }
  footer { margin-top: 8px; text-align: center; color: #607488; font-size: 9px; }
  .report-actions { width: 760px; margin: 14px auto 0; display: flex; justify-content: flex-end; align-items: center; gap: 10px; }
  button { border: 0; border-radius: 7px; padding: 11px 18px; color: white; background: #28629a; cursor: pointer; font-weight: 700; }
  button:disabled { cursor: wait; opacity: .6; }
  #download-report-button { background: #24764b; }
  #report-export-status { margin-right: auto; }
  @page { size: A4 portrait; margin: 8mm; }
  @media print {
    html, body { margin: 0; padding: 0; background: white; }
    * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .report-document { margin: 0 auto; border: 0; border-radius: 0; box-shadow: none; zoom: var(--report-print-scale, 0.9); break-inside: avoid; }
    .report-actions { display: none; }
  }
</style></head><body>
<main id="report-document" class="report-document">
  <header class="header-row">
    <img src="${escape(virtualLabsLogoSrc)}" alt="Virtual Labs">
    <div class="report-title"><h1>KCL Simulation Report</h1><p>AI Enhanced Basic Electrical Science Lab · IIT Roorkee</p></div>
    <img src="${escape(iitLogoSrc)}" alt="IIT Roorkee">
  </header>
  <div class="metadata"><span>${escape(reportDateText)}</span><span>Start: ${escape(startTimeText)}</span><span>End: ${escape(endTimeText)}</span><span>Duration: ${escape(durationText)}</span></div>
  <p class="aim"><strong>Aim:</strong> To verify Kirchhoff’s Current Law: the total current entering a junction equals the total current leaving it in a resistive DC circuit.</p>
  <section><h2>Components and Key Parameters</h2>
    <table class="components"><thead><tr><th>Component</th><th>Rating / Range</th><th>Experiment values</th></tr></thead><tbody>
      <tr><td>Regulated DC power supply</td><td>1.00–15.00 V DC</td><td>Varied as recorded below</td></tr>
      <tr><td>DC ammeters A<sub>1</sub>, A<sub>2</sub>, A<sub>3</sub></td><td>0.00–10.00 mA each</td><td>Measure I<sub>1</sub>, I<sub>2</sub>, I<sub>3</sub></td></tr>
      <tr><td>Resistors R<sub>1</sub>, R<sub>2</sub>, R<sub>3</sub></td><td>1.00–5.00 kΩ each</td><td>R<sub>1</sub> = ${number(resistances.r1 / 1000)}, R<sub>2</sub> = ${number(resistances.r2 / 1000)}, R<sub>3</sub> = ${number(resistances.r3 / 1000)} kΩ</td></tr>
    </tbody></table>
  </section>
  <section><h2>Observation Table</h2><table aria-label="Observation table"><thead><tr><th>S.No.</th><th>Voltage (V)</th><th>I<sub>1</sub> (mA)</th><th>I<sub>2</sub> (mA)</th><th>I<sub>3</sub> (mA)</th></tr></thead><tbody>${observationRows}</tbody></table></section>
  <section><h2 class="graph-title">Current v/s Voltage Graph</h2><div id="report-graph">${graphSvg}</div></section>
  <section><h2>THEORETICAL VERIFICATION</h2>${verificationTables(observations, verification)}</section>
  <section class="conclusion"><h2>Conclusion</h2><p>${escape(conclusion)}</p></section>
  <footer>© 2026 Virtual Labs IIT Roorkee</footer>
</main>
<div class="report-actions"><span id="report-export-status" role="status"></span><button id="print-report-button" type="button">PRINT</button><button id="download-report-button" type="button">DOWNLOAD REPORT</button></div>
<script>(${installReportActions.toString()})(${JSON.stringify(assets).replaceAll('<', '\\u003c')}, ${createSinglePagePdf.toString()});</script>
</body></html>`
}
