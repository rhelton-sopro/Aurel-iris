// Pure phone-number sanitizer. Dedicado — NÃO reusa cpfDigits (CR-01): acoplar
// telefone ao stripper de CPF arrisca corromper o telefone se cpfDigits mudar
// (ex. passar a validar 11 dígitos). Strip de tudo que não for dígito.

export function phoneDigits(v: string | null | undefined): string {
  return (v ?? '').replace(/\D/g, '')
}
