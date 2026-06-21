// Tipos da caixa de suporte (IMAP). SEM 'server-only' — importável por client
// components (a UI da inbox no admin). A implementação fica em imap-client.ts.

export interface SupportMailbox {
  path: string // caminho IMAP real (ex: "INBOX", "INBOX.Sent")
  name: string // rótulo amigável
  specialUse: string | null // \Sent \Trash \Drafts \Junk \Archive
  unread: number
}

export interface SupportAttachment {
  index: number // posição no array de anexos (pra download)
  filename: string
  contentType: string
  size: number
}

export interface SupportEmailHeader {
  uid: number
  fromName: string
  fromAddress: string
  subject: string
  date: string // ISO
  seen: boolean
  hasAttachments: boolean
}

export interface SupportListResult {
  emails: SupportEmailHeader[]
  total: number
  page: number
  pageSize: number
}

export interface SupportEmailBody {
  uid: number
  fromName: string
  fromAddress: string
  subject: string
  date: string
  messageId: string | null // pra threading (In-Reply-To/References ao responder)
  text: string
  html: string | null
  attachments: SupportAttachment[]
}
