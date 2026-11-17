"use client"

import { formatEuro, formatGermanDate } from "../lib/money"
import { givenName } from "../lib/names"
import CloseControl from "./CloseControl"
import EditableApplication from "./EditableApplication"
import RemoveApplication from "./RemoveApplication"
import StatusIcon from "./StatusIcon"
import VoteControl from "./VoteControl"

export default function ApplicationCards({
  applications,
  writers,
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
                <div className="fs-5 fw-semibold text-nowrap">
                  {formatEuro(application.amount_cents)} €
                </div>
                <StatusIcon approved={application.approved} />
              </div>
            </div>
            <p className="purpose purpose-mobile mt-2 mb-3">{application.purpose}</p>
            <div className="small text-secondary mb-1">Stimmen</div>
            {writers.map((writer) => (
              <div className="border-top py-2" key={writer.id}>
                <div className="fw-semibold">{givenName(writer.name)}</div>
                {writer.role_label ? (
                  <div className="small text-secondary mb-1">{writer.role_label}</div>
                ) : null}
                <VoteControl application={application} voter={writer} user={user} />
              </div>
            ))}
            <div className="border-top pt-3 mt-2">
              <div className="fw-semibold mb-2">Abstimmung abgeschlossen</div>
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
