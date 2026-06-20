// Shim de tipos mínimo pra mailparser (não publica declarations embutidas e
// @types/mailparser exigiria outra dependência). Cobre só o que usamos em
// lib/email/imap-client.ts: simpleParser → campos de cabeçalho + corpo.
declare module 'mailparser' {
  export interface EmailAddress {
    address?: string
    name?: string
  }
  export interface AddressObject {
    value: EmailAddress[]
    text: string
  }
  export interface ParsedMail {
    subject?: string
    from?: AddressObject
    to?: AddressObject
    date?: Date
    text?: string
    html?: string | false
    textAsHtml?: string
  }
  export function simpleParser(
    source: Buffer | string | NodeJS.ReadableStream,
    options?: Record<string, unknown>,
  ): Promise<ParsedMail>
}
