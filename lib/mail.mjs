import net from "net"
import tls from "tls"
import { randomBytes } from "crypto"
import { clubName } from "./mail-templates.mjs"

const emailPattern = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/

function oneLine(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim()
}

function mailBody({ from, to, subject, text, attachment }) {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`
  const headers = [
    `From: ${oneLine(clubName)} <${from}>`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
  ]
  const normalized = String(text ?? "").replace(/\r\n/g, "\n").replace(/\n/g, "\r\n")
  if (!attachment) {
    return [
      ...headers,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      normalized,
    ].join("\r\n").replace(/^\./gm, "..")
  }
  const boundary = `----schulverein-${randomBytes(16).toString("hex")}`
  const filename = oneLine(attachment.filename).replace(/["\\]/g, "") || "Tagesordnung.pdf"
  const encoded = attachment.content.toString("base64").replace(/.{1,76}/g, "$&\r\n").trim()
  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    normalized,
    `--${boundary}`,
    "Content-Type: application/pdf",
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${filename}"`,
    "",
    encoded,
    `--${boundary}--`,
    "",
  ].join("\r\n").replace(/^\./gm, "..")
}

function readReply(socket, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    let settled = false
    let buffer = ""
    const timer = setTimeout(() => finish(() => reject(new Error("smtp"))), timeoutMs)
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

function writeAll(socket, data) {
  return new Promise((resolve, reject) => {
    socket.write(data, "utf8", (error) => (error ? reject(error) : resolve()))
  })
}

function mailConfig() {
  const host = String(process.env.MAIL_HOST ?? "").trim()
  const user = String(process.env.MAIL_USER ?? "").trim()
  const password = String(process.env.MAIL_PASSWORD ?? "")
  const from = String(process.env.MAIL_FROM ?? user).trim()
  const port = Number(process.env.MAIL_PORT || 587)
  if (!host || !user || !password || !emailPattern.test(from)) return null
  return { host, user, password, from, port }
}

export async function sendPlainMails(messages) {
  const config = mailConfig()
  const results = []
  if (!config) return messages.map(() => false)
  let socket
  try {
    socket = await openSocket(config.host, config.port)
    await talk(socket, null, [220])
    await talk(socket, "EHLO schulverein.vercel.app", [250])
    let channel = socket
    if (config.port !== 465) {
      await talk(socket, "STARTTLS", [220])
      channel = await upgrade(socket, config.host)
      await talk(channel, "EHLO schulverein.vercel.app", [250])
    }
    await talk(channel, "AUTH LOGIN", [334])
    await talk(channel, Buffer.from(config.user, "utf8").toString("base64"), [334])
    await talk(channel, Buffer.from(config.password, "utf8").toString("base64"), [235])
    for (const message of messages) {
      const recipient = oneLine(message.to)
      const subject = oneLine(message.subject).slice(0, 200)
      const text = String(message.text ?? "")
      if (!emailPattern.test(recipient) || !subject || !text.trim()) {
        results.push(false)
        continue
      }
      try {
        await talk(channel, `MAIL FROM:<${config.from}>`, [250])
        await talk(channel, `RCPT TO:<${recipient}>`, [250, 251])
        await talk(channel, "DATA", [354])
        const accepted = readReply(channel, 60000)
        await writeAll(channel, `${mailBody({
          from: config.from,
          to: recipient,
          subject,
          text,
          attachment: message.attachment,
        })}\r\n.\r\n`)
        const code = await accepted
        if (code !== 250) throw new Error("smtp")
        results.push(true)
      } catch {
        results.push(false)
        try {
          await talk(channel, "RSET", [250])
        } catch {
          break
        }
      }
    }
    await talk(channel, "QUIT", [221, 250]).catch(() => {})
    channel.destroy()
  } catch {
    socket?.destroy()
  }
  while (results.length < messages.length) results.push(false)
  return results
}

export async function sendPlainMail(message) {
  const [sent] = await sendPlainMails([message])
  return Boolean(sent)
}
