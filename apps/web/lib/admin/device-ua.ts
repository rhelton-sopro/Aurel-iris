/**
 * Parser leve de user-agent — zero dep, regex local.
 *
 * Cobre o que importa pro /admin/relatorios: OS family (iOS, Android,
 * Windows, macOS, Linux), device type (mobile/tablet/desktop), browser
 * family (Safari, Chrome, Firefox, Edge, Samsung, Opera). Para análise
 * mais profunda (versão exata de OS, modelo de aparelho), o user_agent
 * cru fica persistido em capture_attempts.user_agent e pode ser
 * pós-processado.
 *
 * Decisão (vs ua-parser-js / bowser / etc.): nossa janela de uso é
 * iridologia em smartphone + raros desktops dos terapeutas. As 6
 * categorias de OS + 6 de browser cobrem 99% dos casos sem custar
 * deps no client (este módulo é só server-side mas o princípio se
 * mantém: bibliotecas de UA têm 60-200kb e mudam frequente).
 */

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown'
export type OsFamily =
  | 'iOS'
  | 'Android'
  | 'Windows'
  | 'macOS'
  | 'Linux'
  | 'ChromeOS'
  | 'Other'
  | 'unknown'
export type BrowserFamily =
  | 'Safari'
  | 'Chrome'
  | 'Firefox'
  | 'Edge'
  | 'Samsung'
  | 'Opera'
  | 'Other'
  | 'unknown'

export interface ParsedUserAgent {
  device_type: DeviceType
  os_family: OsFamily
  browser_family: BrowserFamily
}

export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua || ua.trim().length === 0) {
    return { device_type: 'unknown', os_family: 'unknown', browser_family: 'unknown' }
  }

  return {
    os_family: detectOs(ua),
    device_type: detectDeviceType(ua),
    browser_family: detectBrowser(ua),
  }
}

function detectOs(ua: string): OsFamily {
  // Ordem importa: iPad e iPhone aparecem antes de "Mac OS X" em iPadOS
  // novos (Safari finge ser desktop). Por isso iOS/iPadOS-explicit primeiro.
  if (/\b(iPhone|iPod)\b/.test(ua)) return 'iOS'
  if (/\biPad\b/.test(ua)) return 'iOS'
  if (/\bAndroid\b/.test(ua)) return 'Android'
  if (/\bCrOS\b/.test(ua)) return 'ChromeOS'
  if (/\bWindows\b/.test(ua)) return 'Windows'
  if (/\b(Macintosh|Mac OS X)\b/.test(ua)) return 'macOS'
  if (/\bLinux\b/.test(ua)) return 'Linux'
  return 'Other'
}

function detectDeviceType(ua: string): DeviceType {
  if (/\b(bot|crawler|spider|HeadlessChrome)\b/i.test(ua)) return 'bot'
  if (/\biPad\b/.test(ua)) return 'tablet'
  // Android tablet: "Android" sem "Mobile" geralmente é tablet.
  if (/\bAndroid\b/.test(ua) && !/Mobile/.test(ua)) return 'tablet'
  // Mobile genérico (iPhone, iPod, Android Mobile, Windows Phone).
  if (/\b(Mobi|iPhone|iPod|Android.*Mobile|Windows Phone)\b/.test(ua)) {
    return 'mobile'
  }
  return 'desktop'
}

function detectBrowser(ua: string): BrowserFamily {
  // Ordem importa: Edge contém "Chrome" no UA; Samsung contém "Chrome";
  // Opera (OPR) contém "Chrome"; etc.
  if (/\bEdg\//.test(ua)) return 'Edge'
  if (/\bSamsungBrowser\//.test(ua)) return 'Samsung'
  if (/\bOPR\//.test(ua) || /\bOpera\//.test(ua)) return 'Opera'
  if (/\bFirefox\//.test(ua) || /\bFxiOS\//.test(ua)) return 'Firefox'
  if (/\bChrome\//.test(ua) || /\bCriOS\//.test(ua)) return 'Chrome'
  // Safari por último: aparece em quase todo UA-string de WebKit (incl.
  // Chrome). Só é "Safari real" se não tiver Chrome/CriOS/etc. já tratado.
  if (/\bSafari\//.test(ua)) return 'Safari'
  return 'Other'
}
