import net from "net"
import tls from "tls"
import { clubName } from "./mail-templates.mjs"

const emailPattern = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/

function oneLine(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim()
}

function mailBody({ from, to, subject, text }) {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`
  const normalized = String(text ?? "").replace(/\r\n/g, "\n").replace(/\n/g, "\r\n")
  const stuffed = normalized.replace(/^\./gm, "..")
  return [
    `From: ${oneLine(clubName)} <${from}>`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    stuffed,
  ].join("\r\n")
}

function readReply(socket) {
  return new Promise((resolve, reject) => {
    let settled = false
    let buffer = ""
    const timer = setTimeout(() => finish(() => reject(new Error("smtp"))), 12000)
    function onData(chunk) {
      buffer += chunk.toString("utf8")
      const lines = buffer.split(/\r?\n/).filter((line) => line.length > 0)
      const last = lines[lines.length - 1]
      if (!last || last.length < 4 || last[3] === "-") return
      const code = Number(last.slice(0, 3))
      if (!Number.isInteger(code)) {
        finish(() => reject(new Error("smtp")))
        return
      }
      finish(() => resolve(code))
    }
    function onError() {
      finish(() => reject(new Error("smtp")))
    }
    function finish(done) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.off("data", onData)
      socket.off("error", onError)
      done()
    }
    socket.on("data", onData)
    socket.on("error", onError)
  })
}

async function talk(socket, line, accepted) {
  const pending = readReply(socket)
  if (line != null) socket.write(`${line}\r\n`)
  const code = await pending
  if (!accepted.includes(code)) throw new Error("smtp")
  return code
}

function openSocket(host, port) {
  return new Promise((resolve, reject) => {
    const secure = port === 465
    const socket = secure
      ? tls.connect({ host, port, servername: host })
      : net.connect({ host, port })
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error("smtp"))
    }, 12000)
    socket.once("error", () => {
      clearTimeout(timer)
      reject(new Error("smtp"))
    })
    socket.once(secure ? "secureConnect" : "connect", () => {
      clearTimeout(timer)
      resolve(socket)
    })
  })
}

function upgrade(socket, host) {
  return new Promise((resolve, reject) => {
    const secure = tls.connect({ socket, servername: host })
    const timer = setTimeout(() => {
      secure.destroy()
      reject(new Error("smtp"))
    }, 12000)
    secure.once("error", () => {
      clearTimeout(timer)
      reject(new Error("smtp"))
    })
    secure.once("secureConnect", () => {
      clearTimeout(timer)
      resolve(secure)
    })
  })
}

export async function sendPlainMail({ to, subject, text }) {
  const host = String(process.env.MAIL_HOST ?? "").trim()
  const user = String(process.env.MAIL_USER ?? "").trim()
  const password = String(process.env.MAIL_PASSWORD ?? "")
  const from = String(process.env.MAIL_FROM ?? user).trim()
  const port = Number(process.env.MAIL_PORT || 587)
  const recipient = oneLine(to)
  const mailSubject = oneLine(subject).slice(0, 200)
  const mailText = String(text ?? "")
  if (!host || !user || !password || !emailPattern.test(from) || !emailPattern.test(recipient)) return false
  if (!mailSubject || !mailText.trim()) return false

  let socket
  try {
    socket = await openSocket(host, port)
    await talk(socket, null, [220])
    await talk(socket, "EHLO schulverein.vercel.app", [250])
    let channel = socket
    if (port !== 465) {
      await talk(socket, "STARTTLS", [220])
      channel = await upgrade(socket, host)
      await talk(channel, "EHLO schulverein.vercel.app", [250])
    }
    await talk(channel, "AUTH LOGIN", [334])
    await talk(channel, Buffer.from(user, "utf8").toString("base64"), [334])
    await talk(channel, Buffer.from(password, "utf8").toString("base64"), [235])
    await talk(channel, `MAIL FROM:<${from}>`, [250])
    await talk(channel, `RCPT TO:<${recipient}>`, [250, 251])
    await talk(channel, "DATA", [354])
    const body = mailBody({
      from,
      to: recipient,
      subject: mailSubject,
      text: mailText,
    })
    const accepted = readReply(channel)
    channel.write(`${body}\r\n.\r\n`)
    const code = await accepted
    if (code !== 250) throw new Error("smtp")
    await talk(channel, "QUIT", [221, 250]).catch(() => {})
    channel.destroy()
    return true
  } catch {
    socket?.destroy()
    return false
  }
}
