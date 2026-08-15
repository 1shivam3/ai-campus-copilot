export function calculateNewMastery(currentMastery, minutes) {
  const current = Number(currentMastery || 0)

  // Small, controlled improvement.
  const improvement = Math.min(
    8,
    Math.max(1, minutes / 15)
  )

  return Math.min(
    100,
    Math.round((current + improvement) * 10) / 10
  )
}
