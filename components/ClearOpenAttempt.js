"use client"

import { useEffect } from "react"

export default function ClearOpenAttempt() {
  useEffect(() => {
    sessionStorage.removeItem("sv-open-attempt")
  }, [])
  return null
}
