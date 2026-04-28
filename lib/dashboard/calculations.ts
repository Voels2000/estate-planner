export function adjustSSForClaimingAge(pia: number, claimingAge: number, birthYear: number): number {
  if (!pia || !claimingAge) return pia ?? 0
  const fra = birthYear >= 1960 ? 67 : 66
  const diff = claimingAge - fra
  if (diff === 0) return pia
  if (diff > 0) return Math.round(pia * (1 + Math.min(diff, 3) * 0.08))
  const early = Math.abs(diff)
  const first3 = Math.min(early, 3) * (1 / 15)
  const beyond = Math.max(early - 3, 0) * (1 / 20)
  return Math.round(pia * (1 - first3 - beyond))
}

export function getRmdStartAge(birthYear: number): number {
  if (birthYear >= 1960) return 75
  if (birthYear >= 1951) return 73
  return 72
}

export function getRmdFactor(age: number): number {
  return Math.max(1, 27.4 - (age - 72))
}

export function calcRmdAmount(age: number, balance: number, birthYear: number): number {
  const rmdAge = getRmdStartAge(birthYear)
  if (age < rmdAge || balance <= 0) return 0
  return Math.round(balance / getRmdFactor(age))
}
