export function voterColumns(applications, writers) {
  const included = new Set()
  for (const application of applications) {
    for (const voter of application.voters ?? []) included.add(voter.id)
  }
  const columns = []
  const seen = new Set()
  for (const writer of writers) {
    if (!included.has(writer.id)) continue
    columns.push(writer)
    seen.add(writer.id)
  }
  for (const application of applications) {
    for (const voter of application.voters ?? []) {
      if (seen.has(voter.id)) continue
      columns.push(voter)
      seen.add(voter.id)
    }
  }
  return columns
}

export function isVoteParticipant(application, userId) {
  return (application.voters ?? []).some((voter) => voter.id === userId)
}
