import { notFound } from "next/navigation"
import ClearOpenAttempt from "../../components/ClearOpenAttempt"
import EstablishSession from "../../components/EstablishSession"
import { isJoinAccount } from "../../lib/access"
import { getUser } from "../../lib/auth"
import { tokenMatchesSession, tokenPattern } from "../../lib/login"
import { HomeScreen } from "../page"
import { JoinScreen } from "../beitritt/page"

export const dynamic = "force-dynamic"

export async function generateMetadata() {
  const user = await getUser()
  if (isJoinAccount(user)) {
    return { title: "Mitglied werden · Schulverein Gymnasium Heidberg" }
  }
  return { title: "Förderanträge · Schulverein Gymnasium Heidberg" }
}

export default async function TokenPage({ params, searchParams }) {
  const { token } = await params
  if (!tokenPattern.test(token ?? "")) notFound()
  const user = await getUser()
  if (!(await tokenMatchesSession(user, token))) {
    return <EstablishSession token={token} />
  }

  return (
    <>
      <ClearOpenAttempt />
      {isJoinAccount(user) ? (
        <JoinScreen searchParams={searchParams} />
      ) : (
        <HomeScreen searchParams={searchParams} />
      )}
    </>
  )
}
