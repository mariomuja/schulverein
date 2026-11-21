"use client"

import { useRouter } from "next/navigation"

export default function PotSelect({ pots, selectedId }) {
  const router = useRouter()

  return (
    <select
      className="form-select"
      aria-label="Spendentopf"
      value={selectedId ? String(selectedId) : ""}
      onChange={(event) => {
        const id = event.target.value
        router.push(id ? `/spenden?topf=${id}` : "/spenden")
      }}
    >
      <option value=""> </option>
      {pots.map((pot) => (
        <option key={pot.id} value={pot.id}>
          {pot.name}
        </option>
      ))}
    </select>
  )
}
