export const VERIFICATION_FIELDS = {
  equivalentResistance: { label: 'Equivalent resistance', unit: 'kΩ', min: 0, max: 15 },
  voltage: { label: 'Voltage for I1', unit: 'V', min: 1, max: 15 },
  resistance: { label: 'Resistance for I1', unit: 'kΩ', min: 0, max: 15 },
  i1Result: { label: 'Calculated I1', unit: 'mA', min: 0, max: 15 },
  i1ForI2: { label: 'I1 value for I2', unit: 'mA', min: 0, max: 15 },
  r3Numerator: { label: 'R3 numerator for I2', unit: 'kΩ', min: 1, max: 5 },
  r2ForI2: { label: 'R2 denominator for I2', unit: 'kΩ', min: 1, max: 5 },
  r3ForI2: { label: 'R3 denominator for I2', unit: 'kΩ', min: 1, max: 5 },
  i2Result: { label: 'Calculated I2', unit: 'mA', min: 0, max: 15 },
  i1ForI3: { label: 'I1 value for I3', unit: 'mA', min: 0, max: 15 },
  r2Numerator: { label: 'R2 numerator for I3', unit: 'kΩ', min: 1, max: 5 },
  r2ForI3: { label: 'R2 denominator for I3', unit: 'kΩ', min: 1, max: 5 },
  r3ForI3: { label: 'R3 denominator for I3', unit: 'kΩ', min: 1, max: 5 },
  i3Result: { label: 'Calculated I3', unit: 'mA', min: 0, max: 15 },
}

export const isWithinVerificationRange = (name, value) => {
  const { min, max } = VERIFICATION_FIELDS[name]
  const number = Number(value)
  return value !== '' && Number.isFinite(number) && number >= min && number <= max
}

export const EMPTY_ANSWERS = Object.fromEntries(Object.keys(VERIFICATION_FIELDS).map((key) => [key, '']))
export const isMissingValue = (value) => value == null || String(value).trim() === ''
// Accept one last-place digit of calculator rounding against the displayed value.
const roundedAnswer = (value) => Number(value.toFixed(2))
const ANSWER_TOLERANCE = 0.01 + 1e-9
// KCL combines three answers, so include each answer's display-rounding error.
const tolerance = (value) => ANSWER_TOLERANCE + Math.abs(value - roundedAnswer(value))

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
  return Math.abs(number - roundedAnswer(expected)) <= ANSWER_TOLERANCE ? 'Matches' : 'Check calculation'
}

export const verifyAnswers = (answers, expected) => {
  const keys = Object.keys(VERIFICATION_FIELDS)
  const missingCount = keys.filter((key) => isMissingValue(answers[key])).length
  if (missingCount > 1) return 'verificationMissingMultiple'
  if (missingCount === 1) return 'verificationMissingOne'
  const valuesMatch = keys.every((key) => isWithinVerificationRange(key, answers[key])
    && getValueFeedback(answers[key], expected[key]) === 'Matches')
  const kclMatches = Math.abs(Number(answers.i1Result) - Number(answers.i2Result) - Number(answers.i3Result))
    <= tolerance(expected.i1Result) + tolerance(expected.i2Result) + tolerance(expected.i3Result)
  return valuesMatch && kclMatches ? 'verificationCorrect' : 'verificationIncorrect'
}

export const hasVerifiedReading = (observations, verificationReport) => (
  observations.some((reading) => verificationReport[reading.id]?.result?.correct === true)
)
