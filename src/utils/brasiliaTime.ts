/**
 * Centralized utility for Brasília (America/Sao_Paulo) fuso clock synchronization.
 * This file replaces all external NTP calls with local same-origin synchronization
 * and ensures full compliance by avoiding external API dependencies.
 */

export function getHorarioBrasilia(): Date {
  let offset = 0;
  try {
    const cached = localStorage.getItem("hr_clock_offset");
    if (cached) {
      offset = Number(cached);
    }
  } catch (_) {}
  
  return new Date(Date.now() + offset);
}

export function formatarHorarioBrasilia(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    ...options
  });
}
