import { useState, useEffect, useCallback, useRef } from "react";
import { User, Batida, DiaPontos } from "../types";
import { recreateDbConnection } from "../lib/firebase";

export interface JourneyAnomalyAlert {
  id: string;
  type: "warning" | "info" | "danger";
  title: string;
  message: string;
  timestamp: string;
}

export interface AutoHealStatus {
  isOnline: boolean;
  connectivityMessage: string | null;
  firebaseHealthOk: boolean;
  firebaseHealthMessage: string | null;
  journeyAlerts: JourneyAnomalyAlert[];
  punchCooldownSeconds: number;
  isPunchDisabled: boolean;
  triggerPunchCooldown: (seconds?: number) => void;
  resetFirebaseConnection: () => Promise<boolean>;
}

/**
 * Serviço de Autocura (Auto-Heal v3.0) — Passivo, UI/UX, Saúde do App e Alertas.
 * 
 * DIRETRIZES RESTRITAS:
 * 1. O SDK do Firebase (persistentLocalCache) gerencia 100% da sincronização online/offline e fila de envio.
 * 2. O serviço de Autocura NUNCA realiza escritas, atualizações ou exclusões no Firestore ou no armazenamento local para forçar sincronia.
 * 3. Monitoramento de conectividade para alertas na interface (online/offline).
 * 4. Check-up de saúde do Firebase SDK contra falhas fatais do IndexedDB/c050.
 * 5. Alertas de marcações faltantes (apenas leitura do dia atual).
 * 6. Trava de interface contra duplicidade no botão "Bater Ponto" (cooldown de 30s-60s).
 */

/**
 * Analisa a jornada do colaborador no dia atual e identifica marcações pendentes (APENAS LEITURA)
 */
export function checkJourneyAnomalies(
  todayPunches?: DiaPontos | (Batida | null)[],
  currentDate: Date = new Date()
): JourneyAnomalyAlert[] {
  const alerts: JourneyAnomalyAlert[] = [];
  if (!todayPunches || !Array.isArray(todayPunches)) return alerts;

  const validPunches = todayPunches.filter((b): b is Batida => b !== null && !!b.hora);
  if (validPunches.length === 0) return alerts;

  const nowMs = currentDate.getTime();

  const e1 = todayPunches[0];
  const s1 = todayPunches[1];
  const e2 = todayPunches[2];
  const s2 = todayPunches[3];

  // Entrada registrada (slot 0), mas sem saída para almoço há mais de 5 horas
  if (e1 && e1.hora && !s1) {
    const entryTime = new Date(e1.hora).getTime();
    const hoursElapsed = (nowMs - entryTime) / (1000 * 60 * 60);
    if (hoursElapsed >= 5) {
      alerts.push({
        id: "alert_missing_lunch_exit",
        type: "warning",
        title: "Atenção: Saída para Almoço Pendente",
        message: `Você registrou a entrada às ${new Date(e1.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} e já se passaram ${Math.floor(hoursElapsed)}h. Lembre-se de registrar o almoço!`,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Retorno do almoço (slot 2), mas sem encerramento de expediente há mais de 5 horas
  if (e2 && e2.hora && !s2) {
    const returnTime = new Date(e2.hora).getTime();
    const hoursElapsed = (nowMs - returnTime) / (1000 * 60 * 60);
    if (hoursElapsed >= 5) {
      alerts.push({
        id: "alert_missing_end_shift",
        type: "warning",
        title: "Atenção: Encerramento de Expediente Pendente",
        message: `Você retornou do almoço às ${new Date(e2.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} e já se passaram ${Math.floor(hoursElapsed)}h. Lembre-se de registrar a saída!`,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Número ímpar de marcações
  if (validPunches.length % 2 !== 0 && (nowMs - new Date(validPunches[validPunches.length - 1].hora).getTime() > 6 * 60 * 60 * 1000)) {
    alerts.push({
      id: "alert_odd_punches",
      type: "info",
      title: "Jornada Incompleta",
      message: "Você possui um número ímpar de marcações registradas no dia de hoje.",
      timestamp: new Date().toISOString()
    });
  }

  return alerts;
}

/**
 * Hook de Autocura Passiva para React Components
 */
export function useAutoHeal(
  currentUser?: User | null,
  todayPunches?: DiaPontos | (Batida | null)[]
): AutoHealStatus {
  // 1. Monitoramento de Conectividade
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [connectivityMessage, setConnectivityMessage] = useState<string | null>(null);

  // 2. Saúde do Firebase
  const [firebaseHealthOk, setFirebaseHealthOk] = useState<boolean>(true);
  const [firebaseHealthMessage, setFirebaseHealthMessage] = useState<string | null>(null);

  // 3. Alertas de Jornada (Apenas Leitura)
  const [journeyAlerts, setJourneyAlerts] = useState<JourneyAnomalyAlert[]>([]);

  // 4. Trava de Interface contra Duplicidade
  const [punchCooldownSeconds, setPunchCooldownSeconds] = useState<number>(0);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Listener de Conectividade (Apenas visual para UI) ---
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectivityMessage("Conexão restabelecida. O SDK do Firebase sincronizará as marcações automaticamente.");
      const timer = setTimeout(() => setConnectivityMessage(null), 5000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectivityMessage("Você está offline. Suas marcações de ponto e alterações serão salvas localmente e sincronizadas pelo Firebase ao reconectar.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // --- Listener de Saúde do Firebase SDK ---
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || String(event.reason || "");
      if (
        reason.includes("c050") ||
        reason.includes("e5da") ||
        reason.includes("b815") ||
        reason.includes("assertion") ||
        reason.includes("IndexedDB")
      ) {
        console.warn("[Autocura UX] Inconsistência do SDK Firebase detectada:", reason);
        setFirebaseHealthOk(false);
        setFirebaseHealthMessage("Instabilidade na conexão do banco local. Restabelecendo sessão...");

        recreateDbConnection()
          .then(() => {
            setFirebaseHealthOk(true);
            setFirebaseHealthMessage(null);
          })
          .catch((err) => {
            console.error("[Autocura UX] Falha ao recriar conexão:", err);
            setFirebaseHealthMessage("Não foi possível restabelecer a conexão. Se necessário, recarregue a página.");
          });
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  // --- Atualização de Alertas de Jornada (Apenas Leitura com checagem de igualdade para evitar loops) ---
  const todayPunchesStr = JSON.stringify(todayPunches || []);
  useEffect(() => {
    if (!currentUser || !todayPunches || todayPunches.length === 0) {
      setJourneyAlerts((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const alerts = checkJourneyAnomalies(todayPunches);
    setJourneyAlerts((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(alerts)) return prev;
      return alerts;
    });
  }, [currentUser?.id, todayPunchesStr]);

  // --- Trava de Interface contra Duplicidade (Cooldown de 45s por padrão) ---
  const triggerPunchCooldown = useCallback((seconds: number = 45) => {
    setPunchCooldownSeconds(seconds);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);

    cooldownTimerRef.current = setInterval(() => {
      setPunchCooldownSeconds((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  const resetFirebaseConnection = useCallback(async (): Promise<boolean> => {
    try {
      setFirebaseHealthMessage("Recriando conexão com o Firebase...");
      await recreateDbConnection();
      setFirebaseHealthOk(true);
      setFirebaseHealthMessage(null);
      return true;
    } catch (err) {
      console.error("[Autocura UX] Erro ao reiniciar conexão:", err);
      setFirebaseHealthMessage("Falha ao reconectar. Por favor, recarregue a página.");
      return false;
    }
  }, []);

  return {
    isOnline,
    connectivityMessage,
    firebaseHealthOk,
    firebaseHealthMessage,
    journeyAlerts,
    punchCooldownSeconds,
    isPunchDisabled: punchCooldownSeconds > 0,
    triggerPunchCooldown,
    resetFirebaseConnection,
  };
}
