"use client"

import { deleteMember } from "../app/actions"

export default function DeleteMemberButton({ id, letter }) {
  return (
    <form
      action={deleteMember}
      onSubmit={(event) => {
        if (!window.confirm("Dieses Mitglied löschen?")) event.preventDefault()
      }}
    >
      <input type="hidden" name="memberId" value={id} />
      <input type="hidden" name="letter" value={letter} />
      <button className="btn btn-sm btn-outline-danger" type="submit">
        Löschen
      </button>
    </form>
  )
}
