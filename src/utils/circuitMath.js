const toFiniteNumber = (value) => {
  const number = Number(value)

  return Number.isFinite(number) ? number : 0
}

export const calculateReadings = ({ voltage, r1, r2, r3 }) => {
  const powerSupply = Math.max(toFiniteNumber(voltage), 0)
  const r1Value = Math.max(toFiniteNumber(r1), 0)
  const r2Value = Math.max(toFiniteNumber(r2), 0)
  const r3Value = Math.max(toFiniteNumber(r3), 0)
  const branchResistance = r2Value + r3Value
  const parallelResistance = branchResistance > 0
    ? (r2Value * r3Value) / branchResistance
    : 0
  const totalResistance = r1Value + parallelResistance
  // Ohm's-law calculations produce amperes; the simulation consistently
  // exposes currents in milliamperes.
  const i1 = totalResistance > 0 ? (powerSupply / totalResistance) * 1000 : 0
  const i2 = branchResistance > 0 ? (r3Value / branchResistance) * i1 : 0
  const i3 = branchResistance > 0 ? (r2Value / branchResistance) * i1 : 0

  return {
    totalResistance,
    i1,
    i2,
    i3,
  }
}

export const formatCurrent = (value) => {
  const current = toFiniteNumber(value)

  return Number.isInteger(current) ? String(current) : current.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}
