export function isApproved(yesCount, eligibleCount) {
  return eligibleCount > 0 && yesCount * 2 > eligibleCount
}

export function isRejected(noCount, eligibleCount) {
  return eligibleCount > 0 && noCount * 2 > eligibleCount
}

export function statusSentence(application) {
  if (application.approved) {
    return "Der Antrag wurde von der Mehrheit der Stimmberechtigten angenommen."
  }
  const voters = application.voters ?? []
  let noCount = 0
  for (const voter of voters) {
    if (application.votes?.[voter.id] === "no") noCount += 1
  }
  if (isRejected(noCount, voters.length)) {
    return "Der Antrag wurde abgelehnt."
  }
  return "Die Abstimmung läuft noch. Es liegen noch nicht genug Stimmen vor."
}
