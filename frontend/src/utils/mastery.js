export function calculateNewMastery(currentMastery, minutes) {
  const current = Number.isFinite(Number(currentMastery)) ? Number(currentMastery) : 0
  const duration = Number.isFinite(Number(minutes)) ? Number(minutes) : 25

  // Controlled incremental improvement
  const improvement = Math.min(8, Math.max(1, duration / 15))

  return Math.max(0, Math.min(100, Math.round((current + improvement) * 10) / 10))
}
