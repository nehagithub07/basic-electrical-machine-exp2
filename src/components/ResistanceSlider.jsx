import { useState } from 'react'

const MIN_RESISTANCE = 1000
const MAX_RESISTANCE = 5000
const RESISTANCE_STEP = 1000

const normalizeResistance = (value) => {
  const number = Number(value)
  const bounded = Math.min(Math.max(Number.isFinite(number) ? number : 0, MIN_RESISTANCE), MAX_RESISTANCE)

  return Math.round(bounded / RESISTANCE_STEP) * RESISTANCE_STEP
}

const ResistanceSlider = ({ disabled = false, label, onChange, value }) => {
  const [draftValue, setDraftValue] = useState(value)
  const [isEditing, setIsEditing] = useState(false)
  const sliderValue = isEditing ? draftValue : value

  const commitValue = () => {
    const committedValue = normalizeResistance(sliderValue)

    setDraftValue(committedValue)
    setIsEditing(false)
    onChange(committedValue)
  }

  return (
    <div className={`resistance-slider ${disabled ? 'resistance-slider--locked' : ''}`}>
      <label className="resistance-slider__label" htmlFor={`${label}-slider`}>
        {label.slice(0, 1)}
        <sub>{label.slice(1)}</sub> (k&Omega;)
      </label>

      <div className="resistance-slider__control">
        <input
          aria-label={`${label} resistance`}
          aria-valuetext={`${sliderValue / 1000} kilo-ohms`}
          className="resistance-slider__input"
          disabled={disabled}
          id={`${label}-slider`}
          max={MAX_RESISTANCE}
          min={MIN_RESISTANCE}
          onBlur={commitValue}
          onChange={(event) => {
            setIsEditing(true)
            setDraftValue(Number(event.target.value))
          }}
          onKeyUp={commitValue}
          onPointerCancel={commitValue}
          onPointerUp={commitValue}
          step={RESISTANCE_STEP}
          type="range"
          value={sliderValue}
        />
      </div>

      <span className="resistance-slider__value">{sliderValue / 1000}</span>
    </div>
  )
}

export default ResistanceSlider
