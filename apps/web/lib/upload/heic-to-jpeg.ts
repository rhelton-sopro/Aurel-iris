// apps/web/lib/upload/heic-to-jpeg.ts
// Sem 'use client' / 'use server' — lib pura (roda só no browser via import dinâmico
// dentro de upload-client). NÃO tem import top-level de 'heic2any' — bundle splitting
// garante que a lib (~600KB) só é baixada quando o terapeuta arrasta um HEIC real.
//
// CONTEXT D-11: conversão client-side; bundle restrito à rota /upload via
// dynamic import — não vaza pro resto do app.
//
// CONTEXT do executor (2026-05-03): heic2any@0.0.4 está fora da janela de 24 meses
// definida no PLAN (~37 meses sem release), mas o desenvolvedor aprovou explicitamente
// no checkpoint:decision (Opção A). Razões registradas no 04-01-SUMMARY.md "Deviations":
// MIT > LGPL-3.0 (libheif-js) em SaaS comercial; T-04-01-03 do threat model já registra
// `accept` da supply-chain; deps zero + zero CVEs históricos + HEIC é formato estável.
// Auditoria de manutenção/licenciamento volta na Fase 9 (revisão jurídica healthtech).

/**
 * Converte HEIC/HEIF para JPEG via dynamic import de heic2any.
 *
 * Chamado APENAS quando validateUploadFile sinaliza needsHeicConversion=true
 * (MIME ∈ {image/heic, image/heif} OU extensão .heic/.heif).
 *
 * Não há teste vitest para esta função: jsdom não consegue rodar o pipeline
 * real do heic2any (depende de decodificadores nativos do browser via Canvas
 * que jsdom não implementa). A cobertura virá no UAT smoke da Wave 5
 * (plan 04-07) com um arquivo HEIC real.
 *
 * Throws: lança Error com mensagem do heic2any quando o decode falha. O caller
 * (upload-client) faz `toast.error` com mensagem amigável pt-BR — ver PLAN
 * 04-05 / 04-PATTERNS.md (mensagem fallback "Não consegui converter este HEIC...").
 *
 * @param file - File ou Blob com payload HEIC/HEIF
 * @returns Promise<Blob> com MIME image/jpeg, qualidade 0.92
 */
export async function convertHeicToJpeg(file: File | Blob): Promise<Blob> {
  // Dynamic import — só carrega heic2any quando necessário (bundle splitting).
  // Importante: NÃO usar import top-level — viola CONTEXT D-11.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = (await import('heic2any')) as any
  const heic2any = mod.default ?? mod
  const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
  // heic2any pode retornar Blob | Blob[] (HEIC multi-frame: live photos, bursts).
  // Convenção: pegamos o primeiro frame — terapeuta espera "uma foto = uma imagem".
  return Array.isArray(result) ? result[0] : result
}
