/**
 * Centralized utility for Brasília (America/Sao_Paulo) fuso clock synchronization.
 * This file replaces all external NTP calls with local same-origin synchronization
 * and ensures full compliance by avoiding external API dependencies.
 */

import { getSecureTimeSync } from "./preferencesService";

export function getHorarioBrasilia(): Date {
  return getSecureTimeSync();
}

export function formatarHorarioBrasilia(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    ...options
  });
}
