import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import VerificationPanel from '../src/components/VerificationPanel.jsx'
import { calculateReadings } from '../src/utils/circuitMath.js'
import { getExpectedAnswers, getValueFeedback, verifyAnswers, VERIFICATION_FIELDS } from '../src/utils/verification.js'

const observations = [
  { id: 1, voltage: 6, r1: 1000, r2: 1000, r3: 1000, totalResistance: 1500, i1: 4, i2: 2, i3: 2 },
  { id: 2, voltage: 9, r1: 1000, r2: 1000, r3: 1000, totalResistance: 1500, i1: 6, i2: 3, i3: 3 },
]

const selectReading = (id) => {
  fireEvent.change(screen.getByRole('combobox', { name: 'Select reading to verify' }), { target: { value: String(id) } })
}

const wheel = (target, options = {}) => {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100, ...options })
  fireEvent(target, event)
  return event
}

afterEach(cleanup)

describe('VerificationPanel wheel protection', () => {
  it('prevents focused input scrolling without changing its value, focus, or draft', () => {
    const onVerificationChange = vi.fn()
    render(<VerificationPanel observations={observations} onVerificationChange={onVerificationChange} plotted />)
    selectReading(1)
    const input = screen.getByRole('spinbutton', { name: 'Equivalent resistance' })
    fireEvent.change(input, { target: { value: '1.5' } })
    input.focus()
    onVerificationChange.mockClear()

    expect(wheel(input).defaultPrevented).toBe(true)
    expect(input.value).toBe('1.5')
    expect(document.activeElement).toBe(input)
    expect(onVerificationChange).not.toHaveBeenCalled()
  })

  it('allows scrolling over unfocused inputs and the rest of the panel', () => {
    render(<VerificationPanel observations={observations} plotted />)
    selectReading(1)
    const input = screen.getByRole('spinbutton', { name: 'Equivalent resistance' })

    expect(wheel(input).defaultPrevented).toBe(false)
    input.focus()
    expect(wheel(screen.getByLabelText('Calculated current verification')).defaultPrevented).toBe(false)
  })

  it('preserves Ctrl+wheel zoom when a number input is focused', () => {
    render(<VerificationPanel observations={observations} plotted />)
    selectReading(1)
    const input = screen.getByRole('spinbutton', { name: 'Equivalent resistance' })
    input.focus()

    expect(wheel(input, { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(input)
  })
})

describe('VerificationPanel existing behavior', () => {
  it('accepts manually truncated currents and records successful theoretical verification', () => {
    const reading = { id: 1, voltage: 1, r1: 1000, r2: 1000, r3: 1000 }
    Object.assign(reading, calculateReadings(reading))
    const onVerificationResult = vi.fn()
    const onVerificationChange = vi.fn()
    render(<VerificationPanel observations={[reading]} onVerificationResult={onVerificationResult} onVerificationChange={onVerificationChange} plotted />)
    selectReading(1)
    for (const [name, value] of Object.entries(getExpectedAnswers(reading))) {
      const manualValue = Math.floor(value * 100) / 100
      fireEvent.change(screen.getByRole('spinbutton', { name: VERIFICATION_FIELDS[name].label }), { target: { value: manualValue.toFixed(2) } })
    }
    expect(screen.getByRole('spinbutton', { name: 'Calculated I1' }).value).toBe('0.66')
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    expect(onVerificationResult).toHaveBeenLastCalledWith('verificationCorrect')
    expect(onVerificationChange).toHaveBeenLastCalledWith(expect.objectContaining({
      result: expect.objectContaining({ correct: true }),
    }))
  })

  it.each([
    ['0.66', 0.67, 'Matches'],
    ['0.68', 0.67, 'Matches'],
    ['0.66', 0.674, 'Matches'],
    ['0.68', 0.6666666667, 'Matches'],
    ['0.65', 0.67, 'Check calculation'],
    ['0.69', 0.67, 'Check calculation'],
    ['0.72', 2 / 3, 'Check calculation'],
    ['-0.01', 0, 'Enter a non-negative number'],
    ['NaN', 0.67, 'Enter a non-negative number'],
  ])('checks %s against %s with a one-hundredth rounding allowance', (value, expected, feedback) => {
    expect(getValueFeedback(value, expected)).toBe(feedback)
  })

  it('allows accumulated current rounding while still rejecting incorrect, missing and out-of-range answers', () => {
    const reading = { voltage: 1, r1: 1000, r2: 1000, r3: 1000 }
    Object.assign(reading, calculateReadings(reading))
    const expected = getExpectedAnswers(reading)
    const answers = Object.fromEntries(Object.entries(expected).map(([name, value]) => [name, value.toFixed(2)]))
    Object.assign(answers, { i1Result: '0.68', i2Result: '0.32', i3Result: '0.32' })
    expect(verifyAnswers(answers, expected)).toBe('verificationCorrect')
    expect(verifyAnswers({ ...answers, i2Result: '0.31' }, expected)).toBe('verificationIncorrect')
    expect(verifyAnswers({ ...answers, voltage: '0.99' }, expected)).toBe('verificationIncorrect')
    expect(verifyAnswers({ ...answers, resistance: '' }, expected)).toBe('verificationMissingOne')
    expect(verifyAnswers({ ...answers, resistance: '', voltage: '' }, expected)).toBe('verificationMissingMultiple')
  })

  it('accepts two-decimal answers for repeating currents and keeps units beside every field', () => {
    const reading = { id: 1, voltage: 1, r1: 1000, r2: 1000, r3: 1000 }
    Object.assign(reading, calculateReadings(reading))
    const onVerificationResult = vi.fn()
    render(<VerificationPanel observations={[reading]} onVerificationResult={onVerificationResult} plotted />)
    selectReading(1)
    for (const [name, value] of Object.entries(getExpectedAnswers(reading))) {
      const { label, unit } = VERIFICATION_FIELDS[name]
      const input = screen.getByRole('spinbutton', { name: label })
      expect(input.closest('label').textContent).toContain(unit)
      fireEvent.change(input, { target: { value: value.toFixed(2) } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    expect(onVerificationResult).toHaveBeenLastCalledWith('verificationCorrect')
    const input = screen.getByRole('spinbutton', { name: 'Calculated I1' })
    fireEvent.change(input, { target: { value: '0.72' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    expect(onVerificationResult).toHaveBeenLastCalledWith('verificationIncorrect')
  })

  it('formats a completed input to two decimals without interrupting typing', () => {
    render(<VerificationPanel observations={observations} plotted />)
    selectReading(1)
    const input = screen.getByRole('spinbutton', { name: 'Equivalent resistance' })
    fireEvent.change(input, { target: { value: '1.5' } })
    expect(input.value).toBe('1.5')
    fireEvent.blur(input)
    expect(input.value).toBe('1.50')
  })

  it('rejects excess decimals, exponent notation, and out-of-range edits in every field', () => {
    render(<VerificationPanel observations={observations} plotted />)
    selectReading(1)
    for (const input of screen.getAllByRole('spinbutton')) {
      fireEvent.change(input, { target: { value: '1.23' } })
      expect(input.value).toBe('1.23')
      for (const value of ['1.234', '2.999', '1e0', '-0.01', String(Number(input.max) + 0.01), String(Number(input.min) - 0.01)]) {
        fireEvent.change(input, { target: { value } })
        expect(input.value).toBe('1.23')
      }
      for (const value of [input.min, input.max, '']) {
        fireEvent.change(input, { target: { value } })
        expect(input.value).toBe(value)
      }
    }
  })

  it('enables answers and verification only after plotting and selecting a reading', () => {
    const { rerender } = render(<VerificationPanel observations={observations} plotted={false} />)
    const select = screen.getByRole('combobox', { name: 'Select reading to verify' })
    const verify = screen.getByRole('button', { name: 'Verify' })

    expect(select.disabled).toBe(true)
    expect(verify.disabled).toBe(true)
    expect(screen.getAllByRole('spinbutton').every((input) => input.disabled)).toBe(true)

    rerender(<VerificationPanel observations={observations} plotted />)
    expect(select.disabled).toBe(false)
    expect(verify.disabled).toBe(true)
    expect(screen.getAllByRole('spinbutton').every((input) => input.disabled)).toBe(true)

    selectReading(1)
    expect(verify.disabled).toBe(false)
    expect(screen.getAllByRole('spinbutton').every((input) => !input.disabled)).toBe(true)
  })

  it('verifies the known 6 V reading with decimal resistance and all branch answers', () => {
    const onVerificationChange = vi.fn()
    const onVerificationResult = vi.fn()
    render(<VerificationPanel observations={observations} onVerificationChange={onVerificationChange} onVerificationResult={onVerificationResult} plotted />)
    selectReading(1)

    const answers = {
      'Equivalent resistance': '1.5',
      'Voltage for I1': '6',
      'Resistance for I1': '1.5',
      'Calculated I1': '4',
      'I1 value for I2': '4',
      'R3 numerator for I2': '1',
      'R2 denominator for I2': '1',
      'R3 denominator for I2': '1',
      'Calculated I2': '2',
      'I1 value for I3': '4',
      'R2 numerator for I3': '1',
      'R2 denominator for I3': '1',
      'R3 denominator for I3': '1',
      'Calculated I3': '2',
    }
    for (const [label, value] of Object.entries(answers)) {
      fireEvent.change(screen.getByRole('spinbutton', { name: label }), { target: { value } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))

    expect(onVerificationResult).toHaveBeenCalledWith('verificationCorrect')
    expect(onVerificationChange).toHaveBeenLastCalledWith(expect.objectContaining({
      readingId: 1,
      voltage: 6,
      result: expect.objectContaining({ correct: true }),
    }))
    expect(screen.queryByRole('status')).toBe(null)
    expect(screen.getByRole('spinbutton', { name: 'Equivalent resistance' }).value).toBe('1.50')
  })

  it('retains independent decimal drafts when switching readings', () => {
    render(<VerificationPanel observations={observations} plotted />)
    selectReading(1)
    const input = screen.getByRole('spinbutton', { name: 'Equivalent resistance' })
    fireEvent.change(input, { target: { value: '1.5' } })

    selectReading(2)
    expect(input.value).toBe('')
    fireEvent.change(input, { target: { value: '2.75' } })
    selectReading(1)
    expect(input.value).toBe('1.5')
    selectReading(2)
    expect(input.value).toBe('2.75')
  })
})
