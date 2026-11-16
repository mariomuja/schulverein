export function isApproved(yesCount, eligibleCount) {
  return eligibleCount > 0 && yesCount * 2 > eligibleCount
}
