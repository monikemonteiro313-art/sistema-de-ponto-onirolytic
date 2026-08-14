// Módulo de Cura Oculta (Offline-First Background Reconciliation)
// Monitora a fila local do PontinhoDB e valida existência no Firebase por ID único

import { loadOfflineQueue, clearSyncedPunches, setPref, getPref, OfflinePunchItem } from "./preferencesService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { AuditLogEntry } from "../types";
import { saveAuditLogToDb } from "../lib/firebaseService";

export interface CuraOcultaConfig {
  registerPrePonto?: (
    userId: number,
    userName: string,
    matricula: string,
    dayKey: string,
    idx: number,
    tipo: "auto" | "manual"
  ) => Promise<string | void>;
  onAddLog?: (acao: string, alvo: string, detalhe: string) => void;
  getUserId?: () => number | null;
}

let isRunning = false;
let intervalTimer: any = null;
let activeConfig: CuraOcultaConfig = {};

/**
 * Retorna identificador textual do dispositivo para logs de auditoria
 */
function getDispositivoInfo(): string {
  if (typeof navigator === "undefined") return "Desconhecido";
  const ua = navigator.userAgent || "";
  let browser = "Navegador Web";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";

  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  return `${isMobile ? "Dispositivo Móvel" : "Desktop"} (${browser})`;
}

/**
 * Obtém a lista de IDs de pontos já marcados como resolvidos no PontinhoDB
 */
async function getResolvidosIds(): Promise<string[]> {
  try {
    const raw = await getPref("cura_oculta_resolvidos", "[]");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Marca um ID de ponto como resolvido localmente no PontinhoDB para evitar reprocessamento
 */
export async function marcarPrePontoResolvidoLocal(punchId: string, infoLog?: string): Promise<void> {
  if (!punchId) return;
  try {
    const resolvidos = await getResolvidosIds();
    if (!resolvidos.includes(punchId)) {
      resolvidos.push(punchId);
      if (resolvidos.length > 500) {
        resolvidos.splice(0, resolvidos.length - 500);
      }
      await setPref("cura_oculta_resolvidos", JSON.stringify(resolvidos));
    }

    // Registrar log de auditoria da resolução
    const nowIso = new Date().toISOString();
    const log: AuditLogEntry = {
      id: `cura_oculta_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      quando: nowIso,
      quem: "Cura Oculta (Sistema)",
      quemMat: "SISTEMA",
      acao: "Cura Oculta: Pré-Ponto Resolvido",
      alvo: `ID: ${punchId}`,
      detalhe: infoLog || `ID único ${punchId} marcado como resolvido localmente no PontinhoDB. Reprocessamento desativado.`,
      dispositivo: getDispositivoInfo()
    };

    await saveAuditLogToDb(log).catch(err => {
      console.warn("[CuraOculta] Falha ao salvar log de resolução no Firebase:", err);
    });

    if (activeConfig.onAddLog) {
      activeConfig.onAddLog(log.acao, log.alvo, log.detalhe || "");
    }
    console.log(`[CuraOculta] ✅ Ponto ${punchId} marcado como resolvido no PontinhoDB.`);
  } catch (err) {
    console.error("[CuraOculta] Erro ao marcar ponto como resolvido:", err);
  }
}

/**
 * Executa uma varredura leve na fila local do PontinhoDB
 */
export async function executarVarreduraCuraOculta(): Promise<void> {
  if (typeof window === "undefined" || !navigator.onLine || isRunning) return;

  isRunning = true;
  console.log("[CuraOculta] 🔍 Iniciando varredura background da fila local...");

  try {
    const queue = await loadOfflineQueue();
    if (!queue || queue.length === 0) {
      isRunning = false;
      return;
    }

    const resolvidosIds = await getResolvidosIds();
    const confirmedToClear: any[] = [];

    for (const item of queue) {
      // Obter ou gerar ID único do ponto (prioriza solicitacaoId, id, ou gera assinatura determinística)
      const punchId =
        (item as any).id ||
        (item as any).solicitacaoId ||
        `${item.userId}_${item.dayKey}_${item.slotIdx}_${item.registradoEm}`;

      // Se já foi resolvido anteriormente, pula
      if (resolvidosIds.includes(punchId)) {
        continue;
      }

      // Verificação de idade mínima (janela de graça de 2 minutos contra falso pré-ponto)
      const itemTime = Date.parse(item.registradoEm || item.dispositivoLocalHora || "");
      if (!isNaN(itemTime) && Date.now() - itemTime < 2 * 60 * 1000) {
        continue;
      }

      const mes = item.dayKey.length >= 7 ? item.dayKey.substring(0, 7) : new Date().toISOString().substring(0, 7);
      const docId = `${item.userId}_${mes}`;
      const docRef = doc(db, "pontos", docId);

      let pontoExisteNoServidor = false;
      let confirmacaoViaFallbackFraco = false;

      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          const diaArr = data?.dias?.[item.dayKey];
          if (Array.isArray(diaArr)) {
            const slot = diaArr[item.slotIdx];
            if (slot && (slot.hora || slot.registradoEm)) {
              // Verifica se a confirmação veio por match exato de ID/timestamp ou fallback fraco
              const matchExato =
                slot.solicitacaoId === punchId ||
                slot.id === punchId ||
                (!!slot.registradoEm && slot.registradoEm === item.registradoEm) ||
                (!!slot.dispositivoLocalHora && slot.dispositivoLocalHora === item.dispositivoLocalHora);

              const matchFraco = slot.hora === item.hora && slot.tipo === item.tipo;

              if (matchExato) {
                pontoExisteNoServidor = true;
                confirmacaoViaFallbackFraco = false;
              } else if (matchFraco) {
                pontoExisteNoServidor = true;
                confirmacaoViaFallbackFraco = true;
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[CuraOculta] Erro ao consultar servidor para ID ${punchId}:`, err);
        continue; // Em caso de falha de rede/banco na consulta pontual, tenta novamente no próximo ciclo
      }

      const nowIso = new Date().toISOString();
      const dispositivo = getDispositivoInfo();

      if (pontoExisteNoServidor) {
        // ID JÁ EXISTE NO SERVIDOR:
        // Corrigir estado local para confirmado sem duplicar/reenviar
        confirmedToClear.push(item);

        const sufixoFallback = confirmacaoViaFallbackFraco
          ? " · Confirmado via fallback fraco (horário+tipo) — sem match de ID exato"
          : "";

        await marcarPrePontoResolvidoLocal(
          punchId,
          `Ponto pré-existente confirmado no Firebase. ID: ${punchId} · Clique Original: ${item.registradoEm || item.dispositivoLocalHora}${sufixoFallback}`
        );

        const log: AuditLogEntry = {
          id: `cura_oculta_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          quando: nowIso,
          quem: "Cura Oculta (Sistema)",
          quemMat: "SISTEMA",
          userId: item.userId,
          dayKey: item.dayKey,
          slotIdx: item.slotIdx,
          acao: "Cura Oculta: Ponto Confirmado",
          alvo: `User #${item.userId} - Dia ${item.dayKey}`,
          detalhe: `ID Único: ${punchId} · Status: Confirmado no Servidor · Timestamp do Clique Mantido: ${item.registradoEm || item.dispositivoLocalHora}${sufixoFallback}`,
          dispositivo
        };

        await saveAuditLogToDb(log).catch(() => {});
        if (activeConfig.onAddLog) {
          activeConfig.onAddLog(log.acao, log.alvo, log.detalhe || "");
        }
      } else {
        // ID NÃO EXISTE NO SERVIDOR:
        // Notificar autocura central registrando pré-ponto, sem subir automaticamente
        if (activeConfig.registerPrePonto) {
          try {
            await activeConfig.registerPrePonto(
              item.userId,
              `Colaborador #${item.userId}`,
              String(item.userId),
              item.dayKey,
              item.slotIdx,
              (item.tipo as any) || "auto"
            );

            const log: AuditLogEntry = {
              id: `cura_oculta_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              quando: nowIso,
              quem: "Cura Oculta (Sistema)",
              quemMat: "SISTEMA",
              userId: item.userId,
              dayKey: item.dayKey,
              slotIdx: item.slotIdx,
              acao: "Cura Oculta: Pré-Ponto Detectado",
              alvo: `User #${item.userId} - Dia ${item.dayKey}`,
              detalhe: `ID Único: ${punchId} não encontrado no Firebase. Pré-ponto gerado para auditoria central. Timestamp do Clique Preservado: ${item.registradoEm || item.dispositivoLocalHora}`,
              dispositivo
            };

            await saveAuditLogToDb(log).catch(() => {});
            if (activeConfig.onAddLog) {
              activeConfig.onAddLog(log.acao, log.alvo, log.detalhe || "");
            }
          } catch (preErr) {
            console.warn(`[CuraOculta] Erro ao registrar pré-ponto para ID ${punchId}:`, preErr);
          }
        }
      }
    }

    // Limpa do disco local os itens confirmados
    if (confirmedToClear.length > 0) {
      await clearSyncedPunches(confirmedToClear);
      console.log(`[CuraOculta] 🧹 ${confirmedToClear.length} registros sincronizados e removidos da fila offline.`);
    }
  } catch (err) {
    console.error("[CuraOculta] Exceção inesperada na varredura:", err);
  } finally {
    isRunning = false;
  }
}

/**
 * Inicializa a escuta em background da Cura Oculta
 */
export function iniciarCuraOculta(config: CuraOcultaConfig): () => void {
  activeConfig = config;

  if (typeof window === "undefined") return () => {};

  let debounceTimeout: any = null;

  const handleOnline = () => {
    console.log("[CuraOculta] Conexão reestabelecida. Agendando varredura...");
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      executarVarreduraCuraOculta().catch(() => {});
    }, 3000); // 3 segundos de debounce para estabilização de rede
  };

  window.addEventListener("online", handleOnline);

  // Executa uma varredura inicial suave se já estiver online
  if (navigator.onLine) {
    setTimeout(() => {
      executarVarreduraCuraOculta().catch(() => {});
    }, 5000);
  }

  // Intervalo em segundo plano a cada 5 minutos
  if (intervalTimer) clearInterval(intervalTimer);
  intervalTimer = setInterval(() => {
    if (navigator.onLine) {
      executarVarreduraCuraOculta().catch(() => {});
    }
  }, 5 * 60 * 1000);

  return () => {
    window.removeEventListener("online", handleOnline);
    if (debounceTimeout) clearTimeout(debounceTimeout);
    if (intervalTimer) clearInterval(intervalTimer);
  };
}
