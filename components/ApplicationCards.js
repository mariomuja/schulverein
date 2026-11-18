"use client"

import { formatEuro, formatGermanDate } from "../lib/money"
import { givenName } from "../lib/names"
import CloseControl from "./CloseControl"
import EditableApplication from "./EditableApplication"
import RemoveApplication from "./RemoveApplication"
import Receipts from "./Receipts"
import StatusIcon from "./StatusIcon"
import VoteControl from "./VoteControl"

export default function ApplicationCards({
  applications,
  user,
  sort,
  filter,
  editId = null,
}) {
  return applications.map((application) => {
    const editable = user.can_write && !application.sealed && !application.voting_closed
    return (
      <EditableApplication
        key={application.id}
        as="article"
        className={`card shadow-sm mb-3${editable ? " application-card-editable" : ""}`}
        enabled={editable}
        editOnLoad={editId === application.id}
        application={application}
        sort={sort}
        filter={filter}
      >
        <div className="card-body">
            <div className="d-flex justify-content-between gap-3">
              <div>
                <div>
                  <span className="text-secondary">Antrag vom: </span>
                  <span className="fw-semibold">{formatGermanDate(application.application_date)}</span>
                </div>
                <div>
                  <span className="text-secondary">Antragsteller: </span>
                  {application.applicant}
                </div>
              </div>
              <div className="text-end">
                <div className="small text-secondary">Höchstbetrag</div>
                <div className="fs-5 fw-semibold text-nowrap">
                  {formatEuro(application.amount_cents)} €
                </div>
              </div>
            </div>
            <StatusIcon application={application} />
            <p className="purpose purpose-mobile mt-2 mb-3">{application.purpose}</p>
            <div className="mb-3">
              <div className="small text-secondary mb-1">Beleg</div>
              <Receipts application={application} user={user} />
            </div>
            <div className="small text-secondary mb-1">Stimmen</div>
            <ul className="list-unstyled mb-2">
              {application.voters.map((writer) => (
                <li className="d-flex align-items-center gap-2 py-1" key={writer.id}>
                  <span className="fw-semibold">{givenName(writer.name)}:</span>
                  <VoteControl
                    application={application}
                    voter={writer}
                    user={user}
                    compact
                  />
                </li>
              ))}
            </ul>
            <div className="border-top pt-2">
              <CloseControl application={application} user={user} />
              {user.can_write && !application.hasVotes ? (
                <RemoveApplication applicationId={application.id} />
              ) : null}
            </div>
          </div>
      </EditableApplication>
    )
  })
}
