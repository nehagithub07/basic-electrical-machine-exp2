import { useEffect, useRef, useState } from 'react'
import { EXPERIMENT_ALERTS } from '../alerts/experimentStepAlerts.js'
import { EMPTY_ANSWERS, VERIFICATION_FIELDS, getExpectedAnswers, isWithinVerificationRange, verifyAnswers } from '../utils/verification.js'

const formatAnswer = (value) => value !== '' && Number.isFinite(Number(value)) ? Number(value).toFixed(2) : value

const VerificationInput = ({ disabled, label, name, onChange, unit, value }) => (
  <label className="verification-panel__input-wrap">
    <span className="sr-only">{label}</span>
    <input
      aria-label={label}
      className="verification-panel__input"
      disabled={disabled}
      inputMode="decimal"
      min={VERIFICATION_FIELDS[name].min}
      max={VERIFICATION_FIELDS[name].max}
      placeholder={`${VERIFICATION_FIELDS[name].min}–${VERIFICATION_FIELDS[name].max}`}
      title={`Enter ${VERIFICATION_FIELDS[name].min} to ${VERIFICATION_FIELDS[name].max} ${unit}`}
      name={name}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => {
        const formatted = formatAnswer(value)
        if (formatted !== value) onChange(formatted)
      }}
      step="0.01"
      type="number"
      value={value}
    />
    {unit && <span className="verification-panel__unit">{unit}</span>}
  </label>
)

const EMPTY_DRAFT = { answers: EMPTY_ANSWERS, result: null }

const VerificationPanel = ({ observations, onVerificationChange, onVerificationResult, plotted }) => {
  const panelRef = useRef(null)
  const [readingId, setReadingId] = useState('')
  const [drafts, setDrafts] = useState({})
  const reading = observations.find((row) => String(row.id) === readingId)
  const { answers } = drafts[readingId] ?? EMPTY_DRAFT
  const expected = getExpectedAnswers(reading)

  useEffect(() => {
    const panel = panelRef.current
    const preventWheelChange = (event) => {
      if (
        !event.ctrlKey
        && event.target instanceof HTMLInputElement
        && event.target.type === 'number'
        && event.target === document.activeElement
      ) {
        event.preventDefault()
      }
    }

    // Native, non-passive handling blocks wheel stepping without blurring the field.
    panel.addEventListener('wheel', preventWheelChange, { passive: false })
    return () => panel.removeEventListener('wheel', preventWheelChange)
  }, [])

  const updateAnswer = (name, value) => {
    if (!reading || (value !== '' && !isWithinVerificationRange(name, value))) return
    const nextAnswers = { ...answers, [name]: value }
    setDrafts((current) => ({ ...current, [readingId]: { answers: nextAnswers, result: null } }))
    // Keep report eligibility tied to the latest submitted values for this reading.
    onVerificationChange?.({ answers: nextAnswers, expected, readingId: reading.id, result: null, voltage: reading.voltage })
  }

  const field = (name, label, unit) => (
    <VerificationInput disabled={!plotted || !reading} label={label} name={name} onChange={(value) => updateAnswer(name, value)} unit={unit ?? VERIFICATION_FIELDS[name].unit} value={answers[name]} />
  )

  const verify = () => {
    if (!reading || !plotted) return
    const formattedAnswers = Object.fromEntries(Object.entries(answers).map(([name, value]) => [name, formatAnswer(value)]))
    const outcome = verifyAnswers(formattedAnswers, expected)
    const nextResult = { correct: outcome === 'verificationCorrect', message: EXPERIMENT_ALERTS[outcome].description }
    setDrafts((current) => ({ ...current, [readingId]: { answers: formattedAnswers, result: nextResult } }))
    onVerificationChange?.({ answers: formattedAnswers, expected, readingId: reading.id, result: nextResult, voltage: reading.voltage })
    onVerificationResult?.(outcome)
  }

  return (
    <div className="verification-panel" id="verification-panel" aria-label="Calculated current verification" ref={panelRef}>
      <div className="verification-panel__toolbar">
        <h3>Verification for</h3>
        <select aria-label="Select reading to verify" disabled={!plotted} onChange={(event) => setReadingId(event.target.value)} value={readingId}>
          <option value="">Select reading</option>
          {observations.map((row) => <option key={row.id} value={row.id}>Reading {row.id} — {row.voltage.toFixed(2)} V</option>)}
        </select>
      </div>
      <div className="verification-panel__equation verification-panel__equation--total">
        <strong>Equivalent Resistance (R)</strong><span>=</span>{field('equivalentResistance', 'Equivalent resistance', 'kΩ')}
      </div>
      <div className="verification-panel__equation">
        <strong>I<sub>1</sub></strong><span>=</span><span className="verification-panel__fraction"><span>V {field('voltage', 'Voltage for I1')}</span><span>R {field('resistance', 'Resistance for I1', 'kΩ')}</span></span><span>=</span>{field('i1Result', 'Calculated I1', 'mA')}
      </div>
      <div className="verification-panel__equation">
        <strong>I<sub>2</sub></strong><span>= I<sub>1</sub> {field('i1ForI2', 'I1 value for I2')} ×</span><span className="verification-panel__fraction"><span>R<sub>3</sub> {field('r3Numerator', 'R3 numerator for I2')}</span><span>R<sub>2</sub> {field('r2ForI2', 'R2 denominator for I2')} + R<sub>3</sub> {field('r3ForI2', 'R3 denominator for I2')}</span></span><span>=</span>{field('i2Result', 'Calculated I2', 'mA')}
      </div>
      <div className="verification-panel__equation">
        <strong>I<sub>3</sub></strong><span>= I<sub>1</sub> {field('i1ForI3', 'I1 value for I3')} ×</span><span className="verification-panel__fraction"><span>R<sub>2</sub> {field('r2Numerator', 'R2 numerator for I3')}</span><span>R<sub>2</sub> {field('r2ForI3', 'R2 denominator for I3')} + R<sub>3</sub> {field('r3ForI3', 'R3 denominator for I3')}</span></span><span>=</span>{field('i3Result', 'Calculated I3', 'mA')}
      </div>
      <div className="verification-panel__actions"><button disabled={!plotted || !reading} id="verify-button" onClick={verify} type="button">Verify</button></div>
    </div>
  )
}

export default VerificationPanel
