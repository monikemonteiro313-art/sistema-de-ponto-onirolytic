export interface HoraOficial {
  iso: string;           // "2026-08-13T13:37:00-03:00"
  timestamp: number;     // ms
  fonte: "brasilia-api" | "firebase-server" | "local-offline";
  offsetBrasilia: string;
}

let lastKnownHoraOficial: HoraOficial | null = null;
let lastFetchTime = 0;

/**
 * Retorna o horário OFICIAL de Brasília quando online.
 * Offline: retorna horário local do celular com flag "local-offline".
 */
export async function getHoraOficial(): Promise<HoraOficial> {
  const agoraLocal = new Date();

  // 1. Tenta API pública de Brasília (HTTPS para evitar mixed content)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch("https://worldtimeapi.org/api/timezone/America/Sao_Paulo", {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const ts = new Date(data.datetime).getTime();
      const oficial: HoraOficial = {
        iso: data.datetime,
        timestamp: ts,
        fonte: "brasilia-api",
        offsetBrasilia: data.utc_offset || "-03:00",
      };
      lastKnownHoraOficial = oficial;
      lastFetchTime = Date.now();

      // Salva o offset do relógio em relação ao tempo real de Brasília
      const offset = ts - Date.now();
      try {
        localStorage.setItem("hr_clock_offset", String(offset));
        localStorage.setItem("last_clock_sync", String(Date.now()));
      } catch (_) {}

      return oficial;
    }
  } catch {
    // falhou, tenta backup
  }

  // 2. Backup de API alternativa (timeapi.io)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch("https://timeapi.io/api/v1/time/current/zone?timeZone=America/Sao_Paulo", {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const dtIso = `${data.year}-${String(data.month).padStart(2, "0")}-${String(data.day).padStart(2, "0")}T${String(data.hour).padStart(2, "0")}:${String(data.minute).padStart(2, "0")}:${String(data.second).padStart(2, "0")}-03:00`;
      const oficial: HoraOficial = {
        iso: dtIso,
        timestamp: new Date(dtIso).getTime(),
        fonte: "brasilia-api",
        offsetBrasilia: "-03:00",
      };
      lastKnownHoraOficial = oficial;
      lastFetchTime = Date.now();
      return oficial;
    }
  } catch {
    // falhou
  }

  // 3. Se temos cache recente (< 5 min), usa ele com ajuste de tempo decorrido
  if (lastKnownHoraOficial && (Date.now() - lastFetchTime) < 300000) {
    const elapsed = Date.now() - lastFetchTime;
    const currentTs = lastKnownHoraOficial.timestamp + elapsed;
    return {
      ...lastKnownHoraOficial,
      timestamp: currentTs,
      iso: new Date(currentTs).toISOString(),
    };
  }

  // 4. Último recurso: horário local do dispositivo (marcado como local-offline)
  return {
    iso: agoraLocal.toISOString(),
    timestamp: agoraLocal.getTime(),
    fonte: "local-offline",
    offsetBrasilia: "-03:00",
  };
}

/**
 * Versão síncrona — só use quando precisar do horário IMEDIATO
 * e não puder esperar a API. Retorna local com flag.
 */
export function getHoraLocal(): HoraOficial {
  const agora = new Date();
  return {
    iso: agora.toISOString(),
    timestamp: agora.getTime(),
    fonte: "local-offline",
    offsetBrasilia: "-03:00",
  };
}
