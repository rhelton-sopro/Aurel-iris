// Tipos da caixa de suporte (IMAP). SEM 'server-only' — importável por client
// components (a UI da inbox no admin). A implementação fica em imap-client.ts.

export interface SupportEmailHeader {
  uid: number
  fromName: string
  fromAddress: string
  subject: string
  date: string // ISO
  seen: boolean
}

export interface SupportEmailBody {
  uid: number
  fromName: string
  fromAddress: string
  subject: string
  date: string
  text: string
  html: string | null
}
