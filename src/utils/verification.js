export const VERIFICATION_FIELDS = {
  equivalentResistance: { label: 'Equivalent resistance', unit: 'kΩ' },
  voltage: { label: 'Voltage for I1', unit: 'V' },
  resistance: { label: 'Resistance for I1', unit: 'kΩ' },
  i1Result: { label: 'Calculated I1', unit: 'mA' },
  i1ForI2: { label: 'I1 value for I2', unit: 'mA' },
  r3Numerator: { label: 'R3 numerator for I2', unit: 'kΩ' },
  r2ForI2: { label: 'R2 denominator for I2', unit: 'kΩ' },
  r3ForI2: { label: 'R3 denominator for I2', unit: 'kΩ' },
  i2Result: { label: 'Calculated I2', unit: 'mA' },
  i1ForI3: { label: 'I1 value for I3', unit: 'mA' },
  r2Numerator: { label: 'R2 numerator for I3', unit: 'kΩ' },
  r2ForI3: { label: 'R2 denominator for I3', unit: 'kΩ' },
  r3ForI3: { label: 'R3 denominator for I3', unit: 'kΩ' },
  i3Result: { label: 'Calculated I3', unit: 'mA' },
}

export const EMPTY_ANSWERS = Object.fromEntries(Object.keys(VERIFICATION_FIELDS).map((key) => [key, '']))
export const isMissingValue = (value) => value == null || String(value).trim() === ''
const tolerance = (value) => Math.max(Math.abs(value) * 0.001, 0.001)

export const getExpectedAnswers = (reading) => reading ? ({
  equivalentResistance: reading.totalResistance / 1000,
  voltage: reading.voltage,
  resistance: reading.totalResistance / 1000,
  i1Result: reading.i1,
  i1ForI2: reading.i1,
  r3Numerator: reading.r3 / 1000,
  r2ForI2: reading.r2 / 1000,
  r3ForI2: reading.r3 / 1000,
  i2Result: reading.i2,
  i1ForI3: reading.i1,
  r2Numerator: reading.r2 / 1000,
  r2ForI3: reading.r2 / 1000,
  r3ForI3: reading.r3 / 1000,
  i3Result: reading.i3,
}) : {}

export const getValueFeedback = (value, expected, submitted = false) => {
  if (isMissingValue(value)) return submitted ? 'Required' : ''
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return 'Enter a non-negative number'
  return Math.abs(number - expected) <= tolerance(expected) ? 'Matches' : 'Check calculation'
}

export const verifyAnswers = (answers, expected) => {
  const keys = Object.keys(VERIFICATION_FIELDS)
  const missingCount = keys.filter((key) => isMissingValue(answers[key])).length
  if (missingCount > 1) return 'verificationMissingMultiple'
  if (missingCount === 1) return 'verificationMissingOne'
  const valuesMatch = keys.every((key) => getValueFeedback(answers[key], expected[key]) === 'Matches')
  const kclMatches = Math.abs(Number(answers.i1Result) - Number(answers.i2Result) - Number(answers.i3Result))
    <= tolerance(expected.i1Result) + tolerance(expected.i2Result) + tolerance(expected.i3Result)
  return valuesMatch && kclMatches ? 'verificationCorrect' : 'verificationIncorrect'
}

export const hasVerifiedReading = (observations, verificationReport) => (
  observations.some((reading) => verificationReport[reading.id]?.result?.correct === true)
)
