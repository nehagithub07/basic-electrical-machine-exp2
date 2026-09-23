import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import VerificationPanel from '../src/components/VerificationPanel.jsx'
import { calculateReadings } from '../src/utils/circuitMath.js'
import { getExpectedAnswers, VERIFICATION_FIELDS } from '../src/utils/verification.js'

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
    fireEvent.change(input, { target: { value: '1.567' } })
    expect(input.value).toBe('1.567')
    fireEvent.blur(input)
    expect(input.value).toBe('1.57')
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
