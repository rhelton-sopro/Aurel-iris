// Shim de tipos mínimo pra nodemailer (não publica declarations e @types/nodemailer
// exigiria outra dependência). Cobre só o que usamos em lib/email/smtp-client.ts.
declare module 'nodemailer' {
  export interface SendMailOptions {
    from?: string
    to?: string
    cc?: string
    bcc?: string
    replyTo?: string
    subject?: string
    text?: string
    html?: string
    inReplyTo?: string
    references?: string | string[]
  }
  export interface SentMessageInfo {
    messageId: string
    accepted: string[]
    rejected: string[]
  }
  export interface Transporter {
    sendMail(mail: SendMailOptions): Promise<SentMessageInfo>
    verify(): Promise<true>
  }
  export interface TransportOptions {
    host?: string
    port?: number
    secure?: boolean
    auth?: { user: string; pass: string }
  }
  export function createTransport(opts: TransportOptions): Transporter
  const _default: { createTransport: typeof createTransport }
  export default _default
}

declare module 'nodemailer/lib/mail-composer' {
  import type { SendMailOptions } from 'nodemailer'
  export default class MailComposer {
    constructor(opts: SendMailOptions)
    compile(): { build(cb: (err: Error | null, message: Buffer) => void): void }
  }
}
