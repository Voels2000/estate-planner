import { calcRmdAmount, getRmdStartAge } from '@/lib/dashboard/calculations'

type TaxDeferredAsset = {
  value: number | string | null
  owner: string | null
}

type WithdrawalRow = {
  amount: number | string | null
  ss_person: string | null
  start_year: number | null
  end_year: number | null
}

type BuildRmdStatusInput = {
  currentYear: number
  hasSpouse: boolean
  p1BirthYear: number | null
  p2BirthYear: number | null
  p1NameRaw: string | null
  p2NameRaw: string | null
  p1DisplayName: string
  p2DisplayName: string | null
  taxDeferredAssets: TaxDeferredAsset[]
  currentYearWithdrawals: WithdrawalRow[]
}

export function buildRmdStatus(input: BuildRmdStatusInput) {
  const p1TaxDeferred = input.taxDeferredAssets
    .filter(
      (asset) =>
        asset.owner === 'person1' ||
        asset.owner === (input.p1NameRaw ?? '').trim().toLowerCase(),
    )
    .reduce((sum, asset) => sum + Number(asset.value), 0)

  const p2TaxDeferred = input.hasSpouse
    ? input.taxDeferredAssets
        .filter(
          (asset) =>
            asset.owner === 'person2' ||
            asset.owner === (input.p2NameRaw ?? '').trim().toLowerCase(),
        )
        .reduce((sum, asset) => sum + Number(asset.value), 0)
    : 0

  const p1AgeNow = input.p1BirthYear ? input.currentYear - input.p1BirthYear : null
  const p2AgeNow = input.p2BirthYear ? input.currentYear - input.p2BirthYear : null

  const p1RmdRequired =
    p1AgeNow && input.p1BirthYear
      ? calcRmdAmount(p1AgeNow, p1TaxDeferred, input.p1BirthYear)
      : 0

  const p2RmdRequired =
    p2AgeNow && input.p2BirthYear && input.hasSpouse
      ? calcRmdAmount(p2AgeNow, p2TaxDeferred, input.p2BirthYear)
      : 0

  const activeWithdrawals = input.currentYearWithdrawals.filter((withdrawal) => {
    if (withdrawal.start_year && withdrawal.start_year > input.currentYear) return false
    if (withdrawal.end_year && withdrawal.end_year < input.currentYear) return false
    return true
  })

  const p1RmdPlanned = activeWithdrawals
    .filter((withdrawal) => withdrawal.ss_person === 'person1')
    .reduce((sum, withdrawal) => sum + Number(withdrawal.amount), 0)

  const p2RmdPlanned = activeWithdrawals
    .filter((withdrawal) => withdrawal.ss_person === 'person2')
    .reduce((sum, withdrawal) => sum + Number(withdrawal.amount), 0)

  return {
    p1Name: input.p1DisplayName,
    p2Name: input.hasSpouse ? input.p2DisplayName : null,
    p1Required: p1RmdRequired,
    p1Planned: p1RmdPlanned,
    p1StartYear: input.p1BirthYear ? input.p1BirthYear + getRmdStartAge(input.p1BirthYear) : null,
    p2Required: p2RmdRequired,
    p2Planned: p2RmdPlanned,
    p2StartYear:
      input.p2BirthYear && input.hasSpouse
        ? input.p2BirthYear + getRmdStartAge(input.p2BirthYear)
        : null,
    hasSpouse: input.hasSpouse,
  }
}
