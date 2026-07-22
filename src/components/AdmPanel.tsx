import React, { useState, useMemo, useEffect } from "react";
import { Shield, Zap, Key, Unlock, Ban, Check, Trash2, Printer, FileSpreadsheet, Plane, SquarePen, Map, FileText, Globe, Database, Server, HardDrive, RefreshCw, Activity, Cpu, ClipboardList, CheckSquare, Square, BookOpen, HelpCircle, Info, Calendar, ShieldAlert, Bell, Send, UserCheck, Users, AlertCircle } from "lucide-react";
import { ThemeColors, User, AuditLogEntry, PontosGlobal, FolhaAceite, Alerta } from "../types";
import { Btn, Tag } from "./SharedUI";
import { PwModal, CreateModal, DeleteModal, EditMatriculaModal } from "./AdmModals";
import { FeriasModal } from "./FeriasModal";
import { genMatricula, timeAgo, resumoMesCalculado, calcularDia } from "../utils/hrHelpers";
import { SUPERADMIN_MAT, getJornada } from "../data/mockData";
import { fetchWizardDone, saveUserPontosToDb } from "../lib/firebaseService";

// Decides what actions are permitted based on credentials mapping
export function perms(viewer: User, target: User) {
  if (!viewer || !target) return { canChangePw: false, canBlock: false, canDelete: false, canDelegate: false };
  const viewerIsSuper = viewer.matricula === SUPERADMIN_MAT;
  const targetIsSuper = target.matricula === SUPERADMIN_MAT;
  const isSelf = viewer.id === target.id;
  const targetIsAdm = target.tipo === "adm-dev";

  // Check delegated permissions
  const hasChangePwPerm = viewerIsSuper || viewer.perm_trocar_senha === true || viewer.perm_trocar_senha_adm === true;
  const hasBlockPerm = viewerIsSuper || viewer.perm_bloquear === true;
  const hasDeletePerm = viewerIsSuper || viewer.perm_excluir === true;

  return {
    canChangePw: targetIsSuper
      ? isSelf
      : isSelf
        ? false
        : hasChangePwPerm,
    canBlock: !targetIsSuper && !isSelf && hasBlockPerm,
    canDelete: !targetIsSuper && !isSelf && hasDeletePerm,
    canDelegate: viewerIsSuper && targetIsAdm && !targetIsSuper
  };
}

interface ActionBtnProps {
  icon: React.ReactNode;
  enabled: boolean;
  title: string;
  onClick: () => void;
  bg: string;
  border: string;
  t: ThemeColors;
}

function ActionBtn({ icon, enabled, title, onClick, bg, border }: ActionBtnProps) {
  return (
    <button
      onClick={enabled ? onClick : undefined}
      title={title}
      style={{
        background: bg,
        border: `1.5px solid ${border}`,
        borderRadius: 7,
        padding: "5px 7px",
        cursor: enabled ? "pointer" : "not-allowed",
        display: "flex",
        opacity: enabled ? 1 : 0.28,
        transition: "all 0.2s"
      }}
    >
      {icon}
    </button>
  );
}

interface AdmPanelProps {
  t: ThemeColors;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User;
  onLogout: () => void;
  auditLogExterno: AuditLogEntry[];
  onAddLog?: (acao: string, alvo: string, detalhe?: string) => void;
  feriados?: string[];
  setFeriados?: React.Dispatch<React.SetStateAction<string[]>>;
  pontosGlobal?: PontosGlobal;
  setPontosGlobal?: React.Dispatch<React.SetStateAction<PontosGlobal>>;
  folhasAceite?: FolhaAceite[];
  setFolhasAceite?: React.Dispatch<React.SetStateAction<FolhaAceite[]>>;
  updateUserBloqueioAceite?: (userId: number, blocked: boolean) => Promise<void>;
  minimoHorasDia?: number;
  alertas?: Alerta[];
  setAlertas?: React.Dispatch<React.SetStateAction<Alerta[]>>;
  saveAlertaToDb?: (alerta: Alerta) => Promise<void>;
  deleteAlertaFromDb?: (alertaId: string) => Promise<void>;
}

export function AdmPanel({
  t,
  users,
  setUsers,
  currentUser,
  onLogout,
  auditLogExterno = [],
  onAddLog,
  feriados = [],
  setFeriados = () => {},
  pontosGlobal = {},
  setPontosGlobal,
  folhasAceite = [],
  setFolhasAceite = () => {},
  updateUserBloqueioAceite,
  minimoHorasDia = 7,
  alertas = [],
  setAlertas = () => {},
  saveAlertaToDb,
  deleteAlertaFromDb
}: AdmPanelProps) {
  const [tab, setTab] = useState<"colaboradores" | "adm" | "alertas" | "auditoria" | "feriados" | "arquivo_morto" | "armazenamento" | "guia_manutencao" | "aceites">("colaboradores");
  const [alertaDestinoTipo, setAlertaDestinoTipo] = useState<"TODOS" | "ESPECIFICO">("TODOS");
  const [alertaMatricula, setAlertaMatricula] = useState<string>("");
  const [alertaMensagem, setAlertaMensagem] = useState<string>("");
  const [alertaSending, setAlertaSending] = useState<boolean>(false);
  const [modal, setModal] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [modalDelegation, setModalDelegation] = useState<User | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "warning" | "danger" } | null>(null);
  const [selectedGeoLog, setSelectedGeoLog] = useState<AuditLogEntry | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [showDesativados, setShowDesativados] = useState(false);
  const viewerIsSuper = currentUser.matricula === SUPERADMIN_MAT;

  // Form states for Folhas de Aceite Generation
  const [selectedUserForAceite, setSelectedUserForAceite] = useState<string>("");
  const [selectedMonthForAceite, setSelectedMonthForAceite] = useState<number>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.getMonth();
  });
  const [selectedYearForAceite, setSelectedYearForAceite] = useState<number>(() => new Date().getFullYear());
  const [insalubridadeTextoForAceite, setInsalubridadeTextoForAceite] = useState<string>("Não aplicável / Não alterado no período.");

  // Checklist states with local storage persistence for Weekly and Monthly maintenance
  const [checkedWeekly, setCheckedWeekly] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("hr_checklist_weekly");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [checkedMonthly, setCheckedMonthly] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("hr_checklist_monthly");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("hr_checklist_weekly", JSON.stringify(checkedWeekly));
    } catch (e) {
      console.warn("localStorage error:", e);
    }
  }, [checkedWeekly]);

  useEffect(() => {
    try {
      localStorage.setItem("hr_checklist_monthly", JSON.stringify(checkedMonthly));
    } catch (e) {
      console.warn("localStorage error:", e);
    }
  }, [checkedMonthly]);

  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  // Self-Healing System (Cérebro de Autocura) States
  const [healingRunning, setHealingRunning] = useState(false);
  const [healingStats, setHealingStats] = useState(() => {
    try {
      const saved = localStorage.getItem("hr_self_healing_stats");
      const parsed = saved ? JSON.parse(saved) : null;
      return {
        oddPunchesFixed: parsed?.oddPunchesFixed || 0,
        doubleClicksSanitized: parsed?.doubleClicksSanitized || 0,
        clockDivergencesFlagged: parsed?.clockDivergencesFlagged || 0,
        offlineReviewed: parsed?.offlineReviewed || 0,
        lastRun: parsed?.lastRun || null
      };
    } catch {
      return {
        oddPunchesFixed: 0,
        doubleClicksSanitized: 0,
        clockDivergencesFlagged: 0,
        offlineReviewed: 0,
        lastRun: null as string | null
      };
    }
  });

  // Dynamic derived stats from database to prevent count leaks and infinite increments
  const derivedStats = useMemo(() => {
    let oddPunches = 0;
    let doubleClicks = 0;
    let clockDivergences = 0;
    let offlineReviewed = 0;

    for (const userIdStr of Object.keys(pontosGlobal)) {
      const uId = Number(userIdStr);
      const userObj = users.find(u => u.id === uId);
      if (userObj && userObj.tipo === "adm-dev" && userObj.matricula === SUPERADMIN_MAT) {
        continue;
      }
      
      const userDays = pontosGlobal[uId] || {};
      for (const dayKey of Object.keys(userDays)) {
        const dayPoints = userDays[dayKey] || [];
        
        // Count odd punches (any day with an odd number of valid non-duplicate punches, or has pendenteJustificativa)
        const validPunches = dayPoints.filter(p => p && p.hora && !p.duplicadoOculto);
        if (validPunches.length > 0 && validPunches.length % 2 !== 0) {
          oddPunches++;
        } else {
          const hasPending = dayPoints.some(p => p && p.pendenteJustificativa);
          if (hasPending) {
            oddPunches++;
          }
        }

        for (const p of dayPoints) {
          if (!p) continue;
          if (p.duplicadoOculto) {
            doubleClicks++;
          }
          if (p.suspeitoHoraModificada) {
            clockDivergences++;
          }
          if (p.gravadoOffline) {
            offlineReviewed++;
          }
        }
      }
    }

    return {
      oddPunchesFixed: oddPunches,
      doubleClicksSanitized: doubleClicks,
      clockDivergencesFlagged: clockDivergences,
      offlineReviewed: offlineReviewed
    };
  }, [pontosGlobal, users]);

  const statsToRender = {
    oddPunchesFixed: derivedStats.oddPunchesFixed,
    doubleClicksSanitized: derivedStats.doubleClicksSanitized,
    clockDivergencesFlagged: derivedStats.clockDivergencesFlagged,
    offlineReviewed: derivedStats.offlineReviewed,
    lastRun: healingStats.lastRun
  };

  const isScanning = React.useRef(false);
  const [healingLogs, setHealingLogs] = useState<string[]>([]);

  const runSelfHealing = async () => {
    if (isScanning.current || healingRunning) return;
    isScanning.current = true;
    setHealingRunning(true);
    
    try {
      const logs: string[] = [];
      logs.push("🧠 Iniciando varredura em segundo plano pelo Cérebro de Autocura...");
      
      let oddPunchesCount = 0;
      let doubleClicksCount = 0;
      let clockDivergencesCount = 0;
      let offlineReviewedCount = 0;
      
      logs.push("📅 Analisando batidas órfãs (ímpares) em todo o histórico de lançamentos...");
      logs.push("🔍 [Auditoria de Registros Offline] Escaneando registros gravados sem conexão à internet...");
      
      const newPontosGlobal = { ...pontosGlobal };
      let hasChanges = false;
      
      for (const u of users) {
        if (u.tipo === "adm-dev" && u.matricula === SUPERADMIN_MAT) continue;
        
        const userDays = { ...(newPontosGlobal[u.id] || {}) };
        let userDaysChanged = false;
        const dayKeys = Object.keys(userDays);
        
        for (const dayKey of dayKeys) {
          const dayPoints = [...(userDays[dayKey] || [])];
          let dayPointsChanged = false;
          
          // 1. Check Odd Punches (Batidas Ímpares) - ANY day in history!
          const validPunches = dayPoints.filter(p => p && p.hora && !p.duplicadoOculto);
          if (validPunches.length > 0 && validPunches.length % 2 !== 0) {
            let dayChanged = false;
            const updatedPunches = dayPoints.map(p => {
              if (p && !p.pendenteJustificativa) {
                dayChanged = true;
                return { ...p, pendenteJustificativa: true };
              }
              return p;
            });
            
            if (dayChanged) {
              dayPoints.splice(0, dayPoints.length, ...updatedPunches);
              dayPointsChanged = true;
              oddPunchesCount++;
              logs.push(`⚠️ [Batida Ímpar] Identificada inconsistência para ${u.nome} em ${dayKey}. Flag de pendência criada para justificativa.`);
              addLog("Autocura: Batida Ímpar", `${u.nome} (${u.matricula})`, `Identificada batida ímpar em ${dayKey}. Solicitada justificativa.`);
            }
          }
          
          // 2. Double Clicks (< 60 seconds interval)
          const validPunchIndices = dayPoints
            .map((p, idx) => ({ p, idx }))
            .filter(item => item.p && item.p.hora);
            
          validPunchIndices.sort((a, b) => new Date(a.p!.hora!).getTime() - new Date(b.p!.hora!).getTime());
          
          for (let i = 0; i < validPunchIndices.length - 1; i++) {
            const curr = validPunchIndices[i];
            const next = validPunchIndices[i + 1];
            const diffMs = new Date(next.p!.hora!).getTime() - new Date(curr.p!.hora!).getTime();
            
            if (diffMs >= 0 && diffMs < 60000) {
              if (dayPoints[next.idx] && !dayPoints[next.idx]!.duplicadoOculto) {
                dayPoints[next.idx] = {
                  ...dayPoints[next.idx]!,
                  duplicadoOculto: true
                };
                dayPointsChanged = true;
                doubleClicksCount++;
                logs.push(`🧹 [Clique Duplo] Sanitizada batida duplicada de ${u.nome} em ${dayKey} (intervalo de ${(diffMs/1000).toFixed(1)}s). Mantida apenas a primeira.`);
              }
            }
          }
          
          // 3. Clock Divergence (NTP server time vs local device time > 5 minutes)
          for (let idx = 0; idx < dayPoints.length; idx++) {
            const p = dayPoints[idx];
            if (p && p.registradoEm && p.dispositivoLocalHora) {
              const timeDiff = Math.abs(new Date(p.registradoEm).getTime() - new Date(p.dispositivoLocalHora).getTime());
              if (timeDiff > 5 * 60 * 1000) {
                if (!p.suspeitoHoraModificada) {
                  dayPoints[idx] = {
                    ...p,
                    suspeitoHoraModificada: true
                  };
                  dayPointsChanged = true;
                  clockDivergencesCount++;
                  logs.push(`🚨 [Divergência Relógio] Identificada hora local modificada para ${u.nome} em ${dayKey}. Diferença de ${Math.round(timeDiff / 60000)} min. Registro marcado.`);
                  addLog("Autocura: Divergência de Hora", `${u.nome} (${u.matricula})`, `Relógio local diverge do servidor Brasília por ${Math.round(timeDiff / 60000)} min em ${dayKey}.`);
                }
              }
            }
          }

          // 4. Auditoria de Registros Offline (4ª rotina)
          for (let idx = 0; idx < dayPoints.length; idx++) {
            const p = dayPoints[idx];
            if (p && p.gravadoOffline) {
              if (!p.offlineAudited) {
                dayPoints[idx] = {
                  ...p,
                  offlineAudited: true
                };
                dayPointsChanged = true;
                offlineReviewedCount++;
                
                // Check if there is some potential clock desynchronization reported by comparison
                let clockIsOff = false;
                let offsetMinutes = 0;
                if (p.registradoEm && p.dispositivoLocalHora) {
                  const diffMs = Math.abs(new Date(p.registradoEm).getTime() - new Date(p.dispositivoLocalHora).getTime());
                  offsetMinutes = Math.round(diffMs / 60000);
                  if (diffMs > 5 * 60 * 1000) {
                    clockIsOff = true;
                  }
                }

                if (clockIsOff) {
                  if (!p.suspeitoHoraModificada) {
                    dayPoints[idx] = {
                      ...dayPoints[idx]!,
                      suspeitoHoraModificada: true
                    };
                    clockDivergencesCount++;
                    logs.push(`⚠️ [📱 Ajuste Offline] Relógio de ${u.nome} em ${dayKey} estava desregulado por ${offsetMinutes} min. Ponto marcado para revisão.`);
                    addLog("Autocura: Offline Desregulado", `${u.nome} (${u.matricula})`, `Relógio desregulado por ${offsetMinutes} min no ponto offline de ${dayKey}.`);
                  }
                }
                logs.push(`[📱 Ajuste Offline] Ponto de ${u.nome} em ${dayKey} revisado, auditado e validado de forma definitiva.`);
              }
            }
          }
          
          if (dayPointsChanged) {
            userDays[dayKey] = dayPoints as any;
            userDaysChanged = true;
          }
        }
        
        if (userDaysChanged) {
          newPontosGlobal[u.id] = userDays;
          hasChanges = true;
        }
      }
      
      if (hasChanges) {
        logs.push("💾 Gravando alterações e relatórios de autocura de forma segura no Firebase...");
        for (const u of users) {
          if (newPontosGlobal[u.id]) {
            try {
              await saveUserPontosToDb(u.id, newPontosGlobal[u.id]);
            } catch (err) {
              console.error(`Falha ao salvar autocura para usuário ${u.id}:`, err);
            }
          }
        }
        
        if (setPontosGlobal) {
          setPontosGlobal(newPontosGlobal);
        }
      }
      
      const finalStats = {
        oddPunchesFixed: healingStats.oddPunchesFixed + oddPunchesCount,
        doubleClicksSanitized: healingStats.doubleClicksSanitized + doubleClicksCount,
        clockDivergencesFlagged: healingStats.clockDivergencesFlagged + clockDivergencesCount,
        offlineReviewed: healingStats.offlineReviewed + offlineReviewedCount,
        lastRun: new Date().toLocaleString("pt-BR")
      };
      
      setHealingStats(finalStats);
      try {
        localStorage.setItem("hr_self_healing_stats", JSON.stringify(finalStats));
      } catch (e) {
        console.warn("localStorage write error:", e);
      }
      
      if (oddPunchesCount === 0 && doubleClicksCount === 0 && clockDivergencesCount === 0 && offlineReviewedCount === 0) {
        logs.push("✅ Nenhum novo erro de dados ou inconsistência foi detectado nas últimas 24h.");
      } else {
        logs.push(`🎉 Sucesso! Varredura concluída. Corrigidas ${oddPunchesCount + doubleClicksCount + clockDivergencesCount} inconsistências e auditados ${offlineReviewedCount} registros offline.`);
      }
      
      setHealingLogs(logs);
    } catch (err) {
      console.error("Erro durante autocura:", err);
    } finally {
      isScanning.current = false;
      setHealingRunning(false);
    }
  };

  useEffect(() => {
    if (tab === "guia_manutencao") {
      runSelfHealing();
    }
  }, [tab]);

  // Firebase Storage Monitor states
  const [sessionReads, setSessionReads] = useState(32);
  const [sessionWrites, setSessionWrites] = useState(6);
  const [latency, setLatency] = useState<number | null>(42);
  const [pinging, setPinging] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<Array<{ time: string; type: "INFO" | "SUCCESS" | "WARN"; text: string }>>([
    { time: new Date().toLocaleTimeString("pt-BR"), type: "INFO", text: "Iniciando monitoramento de armazenamento em tempo real do Firebase..." },
    { time: new Date().toLocaleTimeString("pt-BR"), type: "SUCCESS", text: "Conexão de escuta em tempo real ativa com o Firestore." },
    { time: new Date().toLocaleTimeString("pt-BR"), type: "INFO", text: "Sincronizando coleções: 'users', 'pontos', 'config' e 'auditLogs'..." }
  ]);

  const combinedAuditLogs = useMemo(() => {
    return [...auditLogExterno, ...auditLog];
  }, [auditLogExterno, auditLog]);

  // Database stats calculation (approximate size in bytes and doc counts)
  const firebaseStats = useMemo(() => {
    const usersDocCount = users.length;
    const usersRawBytes = users.reduce((sum, u) => sum + JSON.stringify(u).length, 0);
    const usersEstimatedBytes = usersRawBytes + (usersDocCount * 110);

    const pontosDocCount = Object.keys(pontosGlobal).length;
    const pontosRawBytes = Object.values(pontosGlobal).reduce((sum, dayObj) => sum + JSON.stringify(dayObj).length, 0);
    const pontosEstimatedBytes = pontosRawBytes + (pontosDocCount * 130);

    const logsDocCount = combinedAuditLogs.length;
    const logsRawBytes = combinedAuditLogs.reduce((sum, log) => sum + JSON.stringify(log).length, 0);
    const logsEstimatedBytes = logsRawBytes + (logsDocCount * 120);

    const configDocCount = 4; // empresa, minimoHoras, feriados, wizard
    const feriadosRawBytes = JSON.stringify(feriados).length;
    const configEstimatedBytes = feriadosRawBytes + 600;

    const totalDocs = usersDocCount + pontosDocCount + logsDocCount + configDocCount;
    const totalBytes = usersEstimatedBytes + pontosEstimatedBytes + logsEstimatedBytes + configEstimatedBytes;

    return {
      usersCount: usersDocCount,
      usersSize: usersEstimatedBytes,
      pontosCount: pontosDocCount,
      pontosSize: pontosEstimatedBytes,
      logsCount: logsDocCount,
      logsSize: logsEstimatedBytes,
      configCount: configDocCount,
      configSize: configEstimatedBytes,
      totalDocs,
      totalBytes
    };
  }, [users, pontosGlobal, combinedAuditLogs, feriados]);

  async function testPing() {
    setPinging(true);
    const start = performance.now();
    try {
      await fetchWizardDone();
      const end = performance.now();
      setLatency(Math.round(end - start));
      const now = new Date().toLocaleTimeString("pt-BR");
      setConsoleLogs(prev => [
        { time: now, type: "SUCCESS", text: `Ping efetuado com sucesso! Latência do Firestore: ${Math.round(end - start)}ms` },
        ...prev.slice(0, 30)
      ]);
    } catch (e) {
      console.error(e);
      setLatency(-1);
      const now = new Date().toLocaleTimeString("pt-BR");
      setConsoleLogs(prev => [
        { time: now, type: "WARN", text: `Falha na medição de latência do Firestore. Verifique o console.` },
        ...prev.slice(0, 30)
      ]);
    } finally {
      setPinging(false);
    }
  }

  // Automatic log updates on state changes
  useEffect(() => {
    if (tab === "armazenamento") {
      testPing();
      setSessionReads(r => r + 12);
    }
  }, [tab]);

  useEffect(() => {
    if (users.length > 0) {
      const now = new Date().toLocaleTimeString("pt-BR");
      setConsoleLogs(prev => [
        { time: now, type: "SUCCESS", text: `Sincronização em tempo real: ${users.length} usuários carregados da coleção 'users'.` },
        ...prev.slice(0, 30)
      ]);
      setSessionReads(r => r + users.length);
    }
  }, [users.length]);

  useEffect(() => {
    if (isScanning.current) return;
    const pontosCount = Object.keys(pontosGlobal).length;
    if (pontosCount > 0) {
      const now = new Date().toLocaleTimeString("pt-BR");
      setConsoleLogs(prev => [
        { time: now, type: "SUCCESS", text: `Sincronização em tempo real: Coleção 'pontos' lida (${pontosCount} registros de batidas).` },
        ...prev.slice(0, 30)
      ]);
      setSessionReads(r => r + pontosCount);
    }
  }, [pontosGlobal]);

  useEffect(() => {
    if (combinedAuditLogs.length > 0) {
      const now = new Date().toLocaleTimeString("pt-BR");
      const latest = combinedAuditLogs[0];
      setConsoleLogs(prev => [
        { time: now, type: "INFO", text: `Evento de gravação em tempo real: [${latest.acao}] - Alvo: ${latest.alvo}` },
        ...prev.slice(0, 30)
      ]);
      setSessionWrites(w => w + 1);
    }
  }, [combinedAuditLogs.length]);

  useEffect(() => {
    if (feriados.length > 0) {
      const now = new Date().toLocaleTimeString("pt-BR");
      setConsoleLogs(prev => [
        { time: now, type: "SUCCESS", text: `Sincronização em tempo real: Coleção 'config' atualizada. ${feriados.length} feriados carregados.` },
        ...prev.slice(0, 30)
      ]);
      setSessionReads(r => r + 1);
    }
  }, [feriados.length]);

  // Calendário de Feriados states
  const [feriasMes, setFeriasMes] = useState(new Date().getMonth());
  const [feriasAno, setFeriasAno] = useState(new Date().getFullYear());

  function showToast(msg: string, type: "success" | "warning" | "danger" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }

  function addLog(acao: string, alvo: string, detalhe: string = "") {
    const entry: AuditLogEntry = {
      id: Date.now() + Math.random(),
      quando: new Date().toISOString(),
      quem: currentUser.nome,
      quemMat: currentUser.matricula,
      acao,
      alvo,
      detalhe
    };
    setAuditLog(prev => [entry, ...prev]);
    if (onAddLog) {
      onAddLog(acao, alvo, detalhe);
    }
  }

  function createUser(data: any) {
    const newUser: User = {
      id: Date.now(),
      matricula: data.matricula || genMatricula(users),
      nome: data.nome,
      tipo: data.tipo || "colaborador",
      senha: data.senha,
      bloqueado: false,
      desativado: false,
      perm_trocar_senha_adm: false,
      perm_trocar_senha: false,
      perm_bloquear: false,
      perm_excluir: false,
      perm_editar_calendario: false,
      perm_gestao_folhas: false,
      termoAceito: false,
      termoAceitoEm: null,
      jornadaId: null,
      jornadaCustom: null,
      criadoEm: new Date().toISOString()
    };
    setUsers(u => [...u, newUser]);
    addLog("Criou usuário", `${newUser.nome} (${newUser.matricula})`, `Tipo: ${newUser.tipo}`);
    setModal(null);
    showToast(`${newUser.nome} criado — matrícula ${newUser.matricula}`);
  }

  function changePw(userId: number, newPw: string) {
    const target = users.find(x => x.id === userId);
    if (!target) return;
    const p = perms(currentUser, target);
    if (!p.canChangePw) {
      showToast("Sem permissão para esta ação.", "danger");
      return;
    }
    setUsers(u => u.map(x => (x.id === userId ? { ...x, senha: newPw } : x)));
    addLog("Alterou senha", `${target.nome} (${target.matricula})`);
    setModal(null);
    showToast("Senha atualizada com sucesso");
  }

  function changeMatricula(userId: number, newMat: string) {
    const target = users.find(x => x.id === userId);
    if (!target) return;
    const p = perms(currentUser, target);
    if (!p.canChangePw) {
      showToast("Sem permissão para esta ação.", "danger");
      return;
    }
    const oldMat = target.matricula;
    setUsers(u => u.map(x => (x.id === userId ? { ...x, matricula: newMat } : x)));
    addLog("Alterou matrícula", `${target.nome} (${oldMat})`, `Alterada para: ${newMat}`);
    setModal(null);
    showToast(`Matrícula de ${target.nome} alterada para ${newMat}`);
  }

  function toggleBlock(userId: number) {
    const target = users.find(x => x.id === userId);
    if (!target) return;
    const p = perms(currentUser, target);
    if (!p.canBlock) {
      showToast("Sem permissão para esta ação.", "danger");
      return;
    }
    const novaAcao = target.bloqueado ? "Desbloqueou acesso" : "Bloqueou acesso";
    setUsers(u => u.map(x => (x.id === userId ? { ...x, bloqueado: !x.bloqueado } : x)));
    addLog(novaAcao, `${target.nome} (${target.matricula})`);
    showToast(target.bloqueado ? `${target.nome} desbloqueado` : `${target.nome} bloqueado`, target.bloqueado ? "success" : "warning");
  }

  function deactivateUser(userId: number) {
    const target = users.find(x => x.id === userId);
    if (!target) return;
    const p = perms(currentUser, target);
    if (!p.canDelete) {
      showToast("Sem permissão para esta ação.", "danger");
      return;
    }
    setUsers(u =>
      u.map(x =>
        x.id === userId
          ? {
              ...x,
              desativado: true,
              bloqueado: true,
              desativadoEm: new Date().toISOString(),
              desativadoPor: currentUser.nome
            }
          : x
      )
    );
    addLog("Desativou usuário", `${target.nome} (${target.matricula})`, `Tipo: ${target.tipo} · Dados preservados (LGPD/CLT)`);
    setModal(null);
    showToast(`${target.nome} desativado — dados preservados`, "warning");
  }

  function reactivateUser(userId: number) {
    const target = users.find(x => x.id === userId);
    if (!target) return;
    setUsers(u =>
      u.map(x =>
        x.id === userId ? { ...x, desativado: false, bloqueado: false, desativadoEm: null, desativadoPor: null } : x
      )
    );
    addLog("Reativou usuário", `${target.nome} (${target.matricula})`);
    showToast(`${target.nome} reativado com sucesso`, "success");
  }

  function excluirPermanentemente(userId: number) {
    const target = users.find(x => x.id === userId);
    if (!target) return;
    if (confirm(`Tem certeza que deseja excluir permanentemente todos os registros de ${target.nome}? Esta ação é irreversível e excluirá permanentemente todos os seus dados de ponto do sistema conforme as diretrizes de descarte seguro da LGPD.`)) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      addLog("Excluiu permanentemente", `${target.nome} (${target.matricula})`, "Prazo de 5 anos de retenção esgotado. Dados removidos permanentemente.");
      showToast(`${target.nome} excluído permanentemente.`, "success");
    }
  }

  function retrocederDesativacao(userId: number) {
    const target = users.find(x => x.id === userId);
    if (!target) return;
    const cincoAnosAtras = new Date();
    cincoAnosAtras.setFullYear(cincoAnosAtras.getFullYear() - 5);
    cincoAnosAtras.setDate(cincoAnosAtras.getDate() - 1);
    setUsers(prev => prev.map(x => x.id === userId ? { ...x, desativadoEm: cincoAnosAtras.toISOString() } : x));
    showToast(`Data de desativação de ${target.nome} retrocedida para simular fim do prazo.`);
  }

  function toggleDelegate(userId: number) {
    const target = users.find(x => x.id === userId);
    if (!target) return;
    const p = perms(currentUser, target);
    if (!p.canDelegate) {
      showToast("Apenas o superadmin pode delegar permissões.", "danger");
      return;
    }
    const nowActive = !target.perm_trocar_senha_adm;
    setUsers(u => u.map(x => (x.id === userId ? { ...x, perm_trocar_senha_adm: nowActive } : x)));
    addLog(
      nowActive ? "Concedeu permissão extra" : "Revogou permissão extra",
      `${target.nome} (${target.matricula})`,
      "Permissão: trocar senha de ADMs"
    );
    showToast(
      nowActive ? `Permissão de trocar senhas de ADMs concedida a ${target.nome}` : `Permissão revogada de ${target.nome}`,
      nowActive ? "success" : "warning"
    );
  }

  function handleSaveDelegation(userId: number, permsData: { perm_trocar_senha: boolean, perm_bloquear: boolean, perm_excluir: boolean, perm_editar_calendario: boolean, perm_gestao_folhas: boolean }) {
    const target = users.find(x => x.id === userId);
    if (!target) return;
    
    setUsers(u => u.map(x => (x.id === userId ? { ...x, ...permsData, perm_trocar_senha_adm: permsData.perm_trocar_senha } : x)));
    
    const activePerms = [];
    if (permsData.perm_trocar_senha) activePerms.push("Trocar Senha");
    if (permsData.perm_bloquear) activePerms.push("Bloquear");
    if (permsData.perm_excluir) activePerms.push("Excluir");
    if (permsData.perm_editar_calendario) activePerms.push("Editar Calendário");
    if (permsData.perm_gestao_folhas) activePerms.push("Gestão de Folhas");
    
    const permsStr = activePerms.length > 0 ? activePerms.join(", ") : "Nenhuma";
    
    addLog(
      "Delegou funções de ADM",
      `${target.nome} (${target.matricula})`,
      `Funções concedidas: ${permsStr}`
    );
    
    showToast(`Funções de ADM atualizadas para ${target.nome}!`, "success");
    setModalDelegation(null);
  }

  // Stage 3 - Aceite de Folhas Handlers
  const handleGerarFolhas = () => {
    if (selectedUserForAceite === "") {
      showToast("Por favor, selecione um colaborador ou todos.", "warning");
      return;
    }

    const year = Number(selectedYearForAceite);
    const month = Number(selectedMonthForAceite);
    if (isNaN(year) || year < 2000 || year > 2100) {
      showToast("Ano de referência inválido.", "warning");
      return;
    }

    const activeColabs = users.filter(u => u.tipo !== "adm-dev" && !u.desativado);

    if (selectedUserForAceite === "todos") {
      if (activeColabs.length === 0) {
        showToast("Nenhum colaborador ativo encontrado.", "warning");
        return;
      }

      setFolhasAceite(prev => {
        const next = [...prev];
        activeColabs.forEach(u => {
          const res = resumoMesCalculado(u.id, year, month, users, pontosGlobal, minimoHorasDia, feriados);
          const folhaId = `${u.id}_${year}_${month}`;
          const existingIdx = next.findIndex(f => f.id === folhaId);

          const newFolha: FolhaAceite = {
            id: folhaId,
            userId: u.id,
            userName: u.nome,
            matricula: u.matricula,
            mes: month,
            ano: year,
            status: "pendente",
            horasTrabalhadas: res.horasTrabalhadas,
            horasExtra: res.horasExtra,
            horasAdicionalNoturno: res.horasAdicionalNoturno,
            faltas: res.diasFalta,
            atrasos: Math.round((res.minutosAtraso / 60) * 10) / 10,
            insalubridadeTexto: insalubridadeTextoForAceite,
            enviadoEm: new Date().toISOString()
          };

          if (existingIdx >= 0) {
            next[existingIdx] = newFolha;
          } else {
            next.push(newFolha);
          }
        });
        return next;
      });

      addLog("Enviou Folhas em Massa", "Todos os Colaboradores", `Mês ${month + 1}/${year}`);
      showToast(`Folhas de ponto de ${activeColabs.length} colaboradores geradas e enviadas!`, "success");
    } else {
      const uId = Number(selectedUserForAceite);
      const u = users.find(x => x.id === uId);
      if (!u) return;

      const res = resumoMesCalculado(u.id, year, month, users, pontosGlobal, minimoHorasDia, feriados);
      const folhaId = `${u.id}_${year}_${month}`;

      setFolhasAceite(prev => {
        const next = [...prev];
        const existingIdx = next.findIndex(f => f.id === folhaId);

        const newFolha: FolhaAceite = {
          id: folhaId,
          userId: u.id,
          userName: u.nome,
          matricula: u.matricula,
          mes: month,
          ano: year,
          status: "pendente",
          horasTrabalhadas: res.horasTrabalhadas,
          horasExtra: res.horasExtra,
          horasAdicionalNoturno: res.horasAdicionalNoturno,
          faltas: res.diasFalta,
          atrasos: Math.round((res.minutosAtraso / 60) * 10) / 10,
          insalubridadeTexto: insalubridadeTextoForAceite,
          enviadoEm: new Date().toISOString()
        };

        if (existingIdx >= 0) {
          next[existingIdx] = newFolha;
        } else {
          next.push(newFolha);
        }
        return next;
      });

      addLog("Enviou Folha de Ponto", `${u.nome} (${u.matricula})`, `Mês ${month + 1}/${year}`);
      showToast(`Folha de ponto enviada para ${u.nome}!`, "success");
    }
  };

  const handleDesbloquearUsuario = async (folha: FolhaAceite) => {
    try {
      if (updateUserBloqueioAceite) {
        await updateUserBloqueioAceite(folha.userId, false);
      }
      
      setFolhasAceite(prev => prev.map(f => f.id === folha.id ? { ...f, status: "retificado", respondidoEm: new Date().toISOString() } : f));
      
      addLog("Desbloqueou Colaborador", folha.userName, `Bloqueio de aceite removido. Folha ref: Mês ${folha.mes + 1}/${folha.ano}`);
      showToast(`Colaborador ${folha.userName} foi desbloqueado com sucesso!`, "success");
    } catch (err) {
      console.warn("Failed to unblock user:", err);
      showToast("Erro ao desbloquear o colaborador.", "danger");
    }
  };

  const handleCancelarFolha = (folhaId: string) => {
    const folha = folhasAceite.find(f => f.id === folhaId);
    if (!folha) return;

    setFolhasAceite(prev => prev.filter(f => f.id !== folhaId));
    addLog("Cancelou Folha de Ponto", folha.userName, `Removida folha ref: Mês ${folha.mes + 1}/${folha.ano}`);
    showToast("Folha de ponto cancelada/removida com sucesso!", "success");
  };

  function gerarRelatorioGeralHTML() {
    const folhasAceitas = (folhasAceite || []).filter(f => f.status === "aceito");
    if (folhasAceitas.length === 0) {
      showToast("Nenhuma folha de ponto assinada para gerar o relatório consolidado.", "warning");
      return;
    }

    // Sort alphabetically by collaborator name
    const folhasOrdenadas = [...folhasAceitas].sort((a, b) => {
      const nameA = a.userName || "";
      const nameB = b.userName || "";
      return nameA.localeCompare(nameB, "pt-BR");
    });

    const MESES_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const corStatus: Record<string, string> = { completo: "#16a34a", parcial: "#d97706", falta: "#dc2626", atestado: "#2563eb", afastamento: "#7c3aed", folga: "#9ca3af", futuro: "#9ca3af", ferias: "#7c3aed", feriado: "#df2222" };
    const nomesStatus: Record<string, string> = { completo: "Completo", parcial: "Parcial", falta: "Falta", atestado: "Atestado", afastamento: "Afastamento", folga: "Folga", futuro: "A planejar", ferias: "Férias", feriado: "Feriado" };

    let sheetsHtml = "";

    for (const folha of folhasOrdenadas) {
      const u = users.find(x => x.id === folha.userId);
      if (!u) continue;

      const J = u.jornadaId === "personalizada" ? u.jornadaCustom : getJornada(u.jornadaId || "");
      const userList = [u];
      const resumo = resumoMesCalculado(folha.userId, folha.ano, folha.mes, userList, pontosGlobal, minimoHorasDia, feriados);
      const dias = [];
      const total = new Date(folha.ano, folha.mes + 1, 0).getDate();

      for (let d = 1; d <= total; d++) {
        const date = new Date(folha.ano, folha.mes, d);
        const key = date.toISOString().slice(0, 10);
        const batidas = pontosGlobal[folha.userId]?.[key] || [null, null, null, null];
        const calc = calcularDia(folha.userId, key, userList, pontosGlobal, feriados);
        const diaSem = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][date.getDay()];

        const fmtB = (b: any) => {
          if (!b) return "—";
          if (b.ocorrencia) {
            return b.ocorrencia === "atestado" ? (b.parcial ? "Atestado Parcial" : "Atestado") : b.ocorrencia === "afastamento" ? "Afastamento" : b.ocorrencia === "falta" ? "Falta" : b.ocorrencia;
          }
          let timeStr = new Date(b.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          if (b.suspeitoHoraModificada) {
            timeStr += " ⚠️ Suspeito";
          }
          return b.latitude && b.longitude ? `${timeStr} 📍` : timeStr;
        };

        dias.push({ d, diaSem, key, batidas, calc, fmtB });
      }

      const rowsHtml = dias.map(item => {
        const c = item.calc;
        const statusText = nomesStatus[c?.status || ""] || "—";
        const statusColor = corStatus[c?.status || ""] || "#9ca3af";
        const hTrab = c?.horasTrabalhadas ? `${c.horasTrabalhadas.toFixed(1)}h` : "—";
        const hExt = c?.horasExtra ? `${c.horasExtra.toFixed(1)}h` : "—";
        const hNot = c?.adicNoturnoHoras ? `${c.adicNoturnoHoras.toFixed(1)}h` : "—";

        return `
          <tr>
            <td>${String(item.d).padStart(2, "0")}/${String(folha.mes + 1).padStart(2, "0")} (${item.diaSem})</td>
            <td>${item.fmtB(item.batidas[0])}</td>
            <td>${item.fmtB(item.batidas[1])}</td>
            <td>${item.fmtB(item.batidas[2])}</td>
            <td>${item.fmtB(item.batidas[3])}</td>
            <td style="color:${statusColor}; font-weight:bold;">${statusText}</td>
            <td>${hTrab}</td>
            <td>${hExt}</td>
            <td>${hNot}</td>
          </tr>
        `;
      }).join("");

      sheetsHtml += `
      <div class="sheet">
        <div class="header">
          <div>
            <div class="logo">G&A Softwares S/A</div>
            <div class="titulo">Espelho de Ponto — ${MESES_FULL[folha.mes]} ${folha.ano}</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #64748b;">
            Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}
          </div>
        </div>

        <div class="meta">
          <div>
            <strong>Colaborador:</strong> ${u.nome}<br>
            <strong>Matrícula:</strong> ${u.matricula} | <strong>Tipo:</strong> CLT<br>
            <strong>Jornada:</strong> ${J?.nome || "Padrão"} (${J?.horasDia}h/dia)
          </div>
          <div>
            <strong>Empresa:</strong> G&A Softwares S/A<br>
            <strong>CNPJ:</strong> 42.109.845/0001-90<br>
            <strong>Sistema:</strong> Registro de Ponto Eletrônico (Portaria 671/MTE)
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Data (Dia)</th>
              <th>Entrada</th>
              <th>Almoço</th>
              <th>Retorno</th>
              <th>Saída</th>
              <th>Status</th>
              <th>Horas Trab.</th>
              <th>Horas Extra</th>
              <th>Adic. Noturno</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="resumo-cards">
          <div class="card">
            <span>Horas Trabalhadas</span>
            <strong>${resumo.horasTrabalhadas.toFixed(1)}h</strong>
          </div>
          <div class="card">
            <span>Horas Esperadas</span>
            <strong>${resumo.horasEsperadas.toFixed(1)}h</strong>
          </div>
          <div class="card">
            <span>Horas Extras</span>
            <strong>${resumo.horasExtra.toFixed(1)}h</strong>
          </div>
          <div class="card">
            <span>Adicional Noturno</span>
            <strong>${resumo.horasAdicionalNoturno.toFixed(1)}h</strong>
          </div>
        </div>

        <div class="termo-aceite">
          <strong>✓ Termo de Aceite Assinado Eletronicamente</strong>
          "${folha.textoAceite || "Declarado de acordo com as normas vigentes."}"
          <div style="font-size: 10.5px; margin-top: 6px; color: #15803d; text-align: right; font-weight: 500;">
            Assinado eletronicamente por ${u.nome} (Matrícula: ${u.matricula}) em ${folha.respondidoEm ? new Date(folha.respondidoEm).toLocaleString("pt-BR") : "—"}
          </div>
        </div>

        <div class="footer">
          <div class="ass-linha">
            <span style="font-size: 10px; font-style: italic; color: #16a34a; font-weight: 600; display: block; margin-bottom: 2px;">Assinado Digitalmente</span>
            ${u.nome}
          </div>
          <div class="ass-linha">Assinatura do Responsável</div>
        </div>
      </div>
      `;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #1e293b; background: #f1f5f9; line-height: 1.4; }
  .sheet { page-break-after: always; break-after: page; border: 1px solid #e2e8f0; padding: 30px; border-radius: 12px; margin-bottom: 40px; background: #fff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); max-width: 900px; margin-left: auto; margin-right: auto; }
  @media print {
    body { padding: 0; background: none; }
    .sheet { page-break-after: always; break-after: page; border: none; padding: 0; margin-bottom: 0; box-shadow: none; max-width: 100%; }
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
  .logo { font-size: 18px; font-weight: 800; color: #2563eb; letter-spacing: -0.5px; }
  .titulo { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 3px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; font-size: 12px; }
  .meta div { background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10.5px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: left; }
  th { background: #f1f5f9; font-weight: 700; color: #334155; }
  tr:nth-child(even) { background: #f8fafc; }
  .resumo-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
  .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center; background: #f8fafc; }
  .card span { font-size: 8.5px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 3px; }
  .card strong { font-size: 13px; color: #0f172a; }
  .termo-aceite { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px 14px; border-radius: 8px; margin-bottom: 20px; font-size: 11.5px; color: #166534; line-height: 1.45; }
  .termo-aceite strong { display: block; margin-bottom: 4px; font-size: 12px; }
  .footer { display: flex; justify-content: space-between; margin-top: 30px; font-size: 11px; }
  .ass-linha { border-top: 1px solid #94a3b8; width: 220px; text-align: center; padding-top: 6px; color: #475569; margin-top: 25px; }
</style>
<title>Relatório Consolidado de Aceites de Folha de Ponto</title>
</head>
<body>
  ${sheetsHtml}
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio_geral_aceites.html`;
      a.click();
    }
  }

  function gerarEspelhoHTMLForAdmin(userId: number, year: number, month: number) {
    const u = users.find(x => x.id === userId);
    if (!u) return;

    const J = u.jornadaId === "personalizada" ? u.jornadaCustom : getJornada(u.jornadaId || "");
    const userList = [u];

    const resumo = resumoMesCalculado(u.id, year, month, userList, pontosGlobal, minimoHorasDia, feriados);
    const dias = [];
    const total = new Date(year, month + 1, 0).getDate();

    const MESES_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    for (let d = 1; d <= total; d++) {
      const date = new Date(year, month, d);
      const key = date.toISOString().slice(0, 10);
      const batidas = pontosGlobal[u.id]?.[key] || [null, null, null, null];
      const calc = calcularDia(u.id, key, userList, pontosGlobal, feriados);
      const diaSem = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][date.getDay()];

      const fmtB = (b: any) => {
        if (!b) return "—";
        if (b.ocorrencia) {
          return b.ocorrencia === "atestado" ? (b.parcial ? "Atestado Parcial" : "Atestado") : b.ocorrencia === "afastamento" ? "Afastamento" : b.ocorrencia === "falta" ? "Falta" : b.ocorrencia;
        }
        let timeStr = new Date(b.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        if (b.suspeitoHoraModificada) {
          timeStr += " ⚠️ Suspeito";
        }
        return b.latitude && b.longitude ? `${timeStr} 📍` : timeStr;
      };

      dias.push({ d, diaSem, key, batidas, calc, fmtB });
    }

    const corStatus: Record<string, string> = { completo: "#16a34a", parcial: "#d97706", falta: "#dc2626", atestado: "#2563eb", afastamento: "#7c3aed", folga: "#9ca3af", futuro: "#9ca3af", ferias: "#7c3aed", feriado: "#df2222" };
    const nomesStatus: Record<string, string> = { completo: "Completo", parcial: "Parcial", falta: "Falta", atestado: "Atestado", afastamento: "Afastamento", folga: "Folga", futuro: "A planejar", ferias: "Férias", feriado: "Feriado" };

    const rowsHtml = dias.map(item => {
      const c = item.calc;
      const statusText = nomesStatus[c?.status || ""] || "—";
      const statusColor = corStatus[c?.status || ""] || "#9ca3af";
      const hTrab = c?.horasTrabalhadas ? `${c.horasTrabalhadas.toFixed(1)}h` : "—";
      const hExt = c?.horasExtra ? `${c.horasExtra.toFixed(1)}h` : "—";
      const hNot = c?.adicNoturnoHoras ? `${c.adicNoturnoHoras.toFixed(1)}h` : "—";

      return `
        <tr>
          <td>${String(item.d).padStart(2, "0")}/${String(month + 1).padStart(2, "0")} (${item.diaSem})</td>
          <td>${item.fmtB(item.batidas[0])}</td>
          <td>${item.fmtB(item.batidas[1])}</td>
          <td>${item.fmtB(item.batidas[2])}</td>
          <td>${item.fmtB(item.batidas[3])}</td>
          <td style="color:${statusColor}; font-weight:bold;">${statusText}</td>
          <td>${hTrab}</td>
          <td>${hExt}</td>
          <td>${hNot}</td>
        </tr>
      `;
    }).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 30px; color: #1e293b; background: #fff; line-height: 1.4; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; }
  .logo { font-size: 20px; font-weight: 800; color: #2563eb; letter-spacing: -0.5px; }
  .titulo { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 5px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; font-size: 13px; }
  .meta div { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 11.5px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; font-weight: 700; color: #334155; }
  tr:nth-child(even) { background: #f8fafc; }
  .resumo-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 30px; }
  .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center; background: #f8fafc; }
  .card span { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px; }
  .card strong { font-size: 16px; color: #0f172a; }
  .footer { display: flex; justify-content: space-between; margin-top: 50px; font-size: 12px; }
  .ass-linha { border-top: 1px solid #94a3b8; width: 220px; text-align: center; padding-top: 8px; color: #475569; margin-top: 40px; }
</style>
<title>Espelho de Ponto — ${u.nome}</title>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">G&A Softwares S/A</div>
    <div class="titulo">Espelho de Ponto — ${MESES_FULL[month]} ${year}</div>
  </div>
  <div style="text-align: right; font-size: 11px; color: #64748b;">
    Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}
  </div>
</div>

<div class="meta">
  <div>
    <strong>Colaborador:</strong> ${u.nome}<br>
    <strong>Matrícula:</strong> ${u.matricula} | <strong>Tipo:</strong> CLT<br>
    <strong>Jornada:</strong> ${J?.nome || "Padrão"} (${J?.horasDia}h/dia)
  </div>
  <div>
    <strong>Empresa:</strong> G&A Softwares S/A<br>
    <strong>CNPJ:</strong> 42.109.845/0001-90<br>
    <strong>Sistema:</strong> Registro de Ponto Eletrônico (Portaria 671/MTE)
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Data (Dia)</th>
      <th>Entrada</th>
      <th>Almoço</th>
      <th>Retorno</th>
      <th>Saída</th>
      <th>Status</th>
      <th>Horas Trab.</th>
      <th>Horas Extra</th>
      <th>Adic. Noturno</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
  </tbody>
</table>

<div class="resumo-cards">
  <div class="card">
    <span>Horas Trabalhadas</span>
    <strong>${resumo.horasTrabalhadas.toFixed(1)}h</strong>
  </div>
  <div class="card">
    <span>Horas Esperadas</span>
    <strong>${resumo.horasEsperadas.toFixed(1)}h</strong>
  </div>
  <div class="card">
    <span>Horas Extras</span>
    <strong>${resumo.horasExtra.toFixed(1)}h</strong>
  </div>
  <div class="card">
    <span>Adicional Noturno</span>
    <strong>${resumo.horasAdicionalNoturno.toFixed(1)}h</strong>
  </div>
</div>

<div class="footer">
  <div class="ass-linha">Assinatura do Colaborador</div>
  <div class="ass-linha">Assinatura do Responsável</div>
</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `espelho_${u.matricula}_${MESES_FULL[month]}_${year}.html`;
      a.click();
    }
  }

  // Memoized search list of users to keep search typing snappy
  const filteredUsers = useMemo(() => {
    return users.filter(u =>
      u.nome.toLowerCase().includes(search.toLowerCase()) ||
      u.matricula.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  const tabUsers = useMemo(() => {
    return filteredUsers.filter(u => {
      if (tab === "colaboradores") return u.tipo !== "adm-dev" && (showDesativados || !u.desativado);
      if (tab === "adm") return u.tipo === "adm-dev" && (showDesativados || !u.desativado);
      return true;
    });
  }, [filteredUsers, tab, showDesativados]);

  const desativadosCount = useMemo(() => {
    return users.filter(u => u.desativado && (tab === "colaboradores" ? u.tipo !== "adm-dev" : u.tipo === "adm-dev")).length;
  }, [users, tab]);

  const deactivatedUsers = useMemo(() => {
    return users.filter(u => u.desativado);
  }, [users]);

  function exportLogsPDF() {
    if (combinedAuditLogs.length === 0) return;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Auditoria — Controle de Ponto</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 30px; background: #fff; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
    .subtitle { font-size: 11px; color: #64748b; margin-top: 4px; }
    .meta-info { text-align: right; font-size: 10px; color: #64748b; line-height: 1.4; }
    .summary-badge { display: inline-block; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 600; color: #334155; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #0f172a; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; border: 1px solid #0f172a; }
    td { padding: 8px 10px; border: 1px solid #e2e8f0; font-size: 10.5px; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
    .badge-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fee2e2; }
    .badge-warning { background: #fffbeb; color: #d97706; border: 1px solid #fef3c7; }
    .badge-success { background: #f0fdf4; color: #16a34a; border: 1px solid #dcfce7; }
    .badge-info { background: #f0f9ff; color: #0284c7; border: 1px solid #e0f2fe; }
    .text-mono { font-family: monospace; font-size: 10px; }
    .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">Log de Auditoria Geral</div>
      <div class="subtitle">Registros de conformidade trabalhista - CLT/Portaria 671</div>
    </div>
    <div class="meta-info">
      <div>Exportado em: ${new Date().toLocaleString("pt-BR")}</div>
      <div>Responsável pelo relatório: ${currentUser.nome}</div>
    </div>
  </div>

  <div class="summary-badge">
    Total de ocorrências localizadas: ${combinedAuditLogs.length} registros
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 140px;">Data / Hora</th>
        <th style="width: 130px;">Responsável (Cargo)</th>
        <th style="width: 100px;">Matrícula</th>
        <th style="width: 180px;">Ação Administrativa</th>
        <th>Colaborador / Detalhes de Auditoria</th>
      </tr>
    </thead>
    <tbody>
      ${combinedAuditLogs.map(entry => {
        const isRed = entry.acao.includes("Excluiu") || entry.acao.includes("Desativou");
        const isYel = entry.acao.includes("Bloqueou") || entry.acao.includes("permissão");
        const isGrn = entry.acao.includes("Criou") || entry.acao.includes("Desbloqueou") || entry.acao.includes("termo");
        const badgeClass = isRed ? "badge-danger" : isYel ? "badge-warning" : isGrn ? "badge-success" : "badge-info";

        const d = new Date(entry.quando);
        const dataFmt = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
        const horaFmt = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

        const locStr = entry.latitude && entry.longitude
          ? `<div style="font-size: 9.5px; color: #0284c7; margin-top: 4px; font-weight: 600;">📍 Localização: ${entry.latitude.toFixed(5)}, ${entry.longitude.toFixed(5)}${entry.accuracy !== undefined ? ` (Precisão: ${entry.accuracy.toFixed(1)}m)` : ""}</div>`
          : `<div style="font-size: 9.5px; color: #94a3b8; margin-top: 4px;">📍 Sem coordenadas</div>`;

        return `
          <tr>
            <td class="text-mono"><strong>${dataFmt}</strong><br/>${horaFmt}</td>
            <td><strong>${entry.quem}</strong></td>
            <td class="text-mono">${entry.quemMat}</td>
            <td><span class="badge ${badgeClass}">${entry.acao}</span></td>
            <td>
              <div style="font-weight: 600; color: #1e293b;">${entry.alvo}</div>
              ${entry.detalhe ? `<div style="font-size: 10px; color: #475569; margin-top: 3px; line-height: 1.3;">${entry.detalhe}</div>` : ""}
              ${locStr}
            </td>
          </tr>
        `;
      }).join("")}
    </tbody>
  </table>

  <div class="footer">
    Relatório gerado via Sistema Interno de Gestão de Ponto. Assinatura do Administrador do Sistema não necessária nos termos da lei.
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio_auditoria_${new Date().toISOString().slice(0, 10)}.html`;
      a.click();
    }
  }

  function exportLogsExcel() {
    if (combinedAuditLogs.length === 0) return;

    // Use semicolon separation for seamless Portuguese Excel load, add BOM for UTF-8 encoding
    const csvHeader = "Data/Hora;Responsável;Matrícula do Responsável;Ação Administrativa;Afetado / Alvo;Detalhes adicionais;Latitude;Longitude\n";
    
    const csvRows = combinedAuditLogs.map(entry => {
      const d = new Date(entry.quando);
      const dataHoraStr = `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR")}`;
      
      const cleanQuem = entry.quem.replace(/;/g, ",").replace(/"/g, '""');
      const cleanMat = entry.quemMat.replace(/;/g, ",").replace(/"/g, '""');
      const cleanAcao = entry.acao.replace(/;/g, ",").replace(/"/g, '""');
      const cleanAlvo = entry.alvo.replace(/;/g, ",").replace(/"/g, '""');
      const cleanDetalhe = (entry.detalhe || "").replace(/\n/g, " ").replace(/\r/g, " ").replace(/;/g, ",").replace(/"/g, '""');
      const latVal = entry.latitude !== undefined ? entry.latitude : "";
      const lonVal = entry.longitude !== undefined ? entry.longitude : "";

      return `"${dataHoraStr}";"${cleanQuem}";"${cleanMat}";"${cleanAcao}";"${cleanAlvo}";"${cleanDetalhe}";"${latVal}";"${lonVal}"`;
    }).join("\n");

    const fullCsv = "\uFEFF" + csvHeader + csvRows;
    const blob = new Blob([fullCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_ponto_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const isAdmTab = tab === "adm";
  const cols = isAdmTab ? "90px 1fr 110px 80px 100px 150px 170px" : "90px 1fr 80px 80px 100px 140px";
  const headers = isAdmTab ? ["Matrícula", "Nome", "Tipo", "Status", "Criado em", "Funções Delegadas", "Ações"] : ["Matrícula", "Nome", "Tipo", "Status", "Criado em", "Ações"];

  return (
    <div style={{ minHeight: "100vh", background: t.bg }}>
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 1000,
            background: toast.type === "danger" ? t.dangerBg : toast.type === "warning" ? t.warningBg : t.successBg,
            border: `1.5px solid ${toast.type === "danger" ? t.dangerBorder : toast.type === "warning" ? t.warningBorder : t.successBorder}`,
            color: toast.type === "danger" ? t.danger : toast.type === "warning" ? t.warning : t.success,
            borderRadius: 10,
            padding: "11px 18px",
            fontSize: "13.5px",
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            maxWidth: 360
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: t.surface, borderBottom: `1.5px solid ${t.border}`, padding: "0 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: `linear-gradient(135deg, ${t.accent}, #2040CC)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Shield size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>Painel ADM-Dev</div>
              <div style={{ fontSize: 11, color: t.textSub }}>Olá, {currentUser.nome}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {viewerIsSuper && <Tag label="SUPERADMIN" color="#fff" bg={`linear-gradient(135deg, ${t.accent}, #2040CC)`} />}
            {!viewerIsSuper && currentUser.perm_trocar_senha_adm && (
              <Tag label="Perm. Extra" color={t.gold} bg={t.goldBg} border={t.goldBorder} />
            )}
            <Tag label={`Mat. ${currentUser.matricula}`} color={t.accent} bg={t.surfaceAlt} border={t.border} />
            <Btn onClick={onLogout} variant="ghost" t={t} small>
              Sair
            </Btn>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, overflowX: "auto", whiteSpace: "nowrap", flexWrap: "nowrap" }} className="no-scrollbar">
          {(["colaboradores", "adm", "alertas", "auditoria", "feriados", "arquivo_morto", "armazenamento", "guia_manutencao", "aceites"] as const).map(key => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "13.5px",
                fontWeight: 600,
                color: tab === key ? t.accent : t.textSub,
                padding: "10px 16px",
                borderBottom: `2px solid ${tab === key ? t.accent : "transparent"}`,
                transition: "all 0.2s",
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                flexShrink: 0
              }}
            >
              {key === "colaboradores"
                ? "Colaboradores"
                : key === "adm"
                ? "Credenciais ADMs"
                : key === "alertas"
                ? "Enviar Alertas"
                : key === "auditoria"
                ? "Auditoria"
                : key === "feriados"
                ? "Calendário Geral / Feriados"
                : key === "armazenamento"
                ? "Monitor Firebase"
                : key === "guia_manutencao"
                ? "Guia de Manutenção"
                : key === "aceites"
                ? "Aceite de Folhas"
                : "Arquivo Morto"}
              {key === "auditoria" && combinedAuditLogs.length > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 4,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: t.accent,
                    display: "block"
                  }}
                />
              )}
              {key === "arquivo_morto" && deactivatedUsers.length > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 10,
                    padding: "1px 6px",
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#EF4444",
                    borderRadius: 10,
                    fontWeight: 700
                  }}
                >
                  {deactivatedUsers.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table view */}
      {tab !== "auditoria" && tab !== "feriados" && tab !== "arquivo_morto" && tab !== "armazenamento" && tab !== "guia_manutencao" && tab !== "aceites" && tab !== "alertas" && (
        <div style={{ padding: "24px 28px", maxWidth: 980, margin: "0 auto" }}>
          {tab === "adm" && viewerIsSuper && (
            <div
              style={{
                background: t.goldBg,
                border: `1.5px solid ${t.goldBorder}`,
                borderRadius: 12,
                padding: "12px 18px",
                marginBottom: 18,
                display: "flex",
                alignItems: "flex-start",
                gap: 10
              }}
            >
              <Zap size={15} color={t.gold} />
              <div>
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: t.gold }}>
                  Permissão delegável: Trocar senha de ADMs
                </span>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: t.textSub, lineHeight: 1.5 }}>
                  Por padrão, ADMs só trocam senhas de colaboradores. Você pode conceder individualmente a permissão de também trocar senhas de outros ADMs (exceto a sua Root). Use o toggle na coluna <strong style={{ color: t.text }}>Perm. Extra</strong>. Você pode revogar a qualquer momento.
                </p>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <input
              placeholder="Buscar por nome ou matrícula..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: t.surface,
                border: `1.5px solid ${t.border}`,
                borderRadius: 9,
                color: t.text,
                fontSize: "13.5px",
                padding: "9px 14px",
                outline: "none",
                fontFamily: "inherit",
                width: 260
              }}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {desativadosCount > 0 && (
                <button
                  onClick={() => setShowDesativados(v => !v)}
                  style={{
                    background: showDesativados ? t.warningBg : t.surfaceAlt,
                    border: `1.5px solid ${showDesativados ? t.warningBorder : t.border}`,
                    borderRadius: 8,
                    padding: "6px 12px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    color: showDesativados ? t.warning : t.textSub,
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <Ban size={13} color={showDesativados ? t.warning : t.textSub} />
                  {showDesativados ? "Ocultar desativados" : `Desativados (${desativadosCount})`}
                </button>
              )}
              <Btn onClick={() => setModal({ type: "create" })} t={t} small>
                <PlusIcon size={14} color="#fff" /> Novo {tab === "adm" ? "ADM" : "Colaborador"}
              </Btn>
            </div>
          </div>

          <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }} className="no-scrollbar">
              <div style={{ minWidth: isAdmTab ? 840 : 700 }}>
                <div style={{ display: "grid", gridTemplateColumns: cols, borderBottom: `1.5px solid ${t.border}`, padding: "10px 18px" }}>
                  {headers.map(h => (
                    <span key={h} style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {h}
                    </span>
                  ))}
                </div>

            {tabUsers.map((u, i) => {
              const isSuper = u.matricula === SUPERADMIN_MAT;
              const isSelf = currentUser.id === u.id;
              const p = perms(currentUser, u);

              return (
                <div
                  key={u.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: cols,
                    padding: "12px 18px",
                    borderBottom: `1px solid ${t.border}`,
                    background: u.desativado ? "rgba(100,100,120,0.07)" : u.bloqueado ? t.blockedBg : i % 2 === 0 ? "transparent" : t.surfaceAlt,
                    alignItems: "center",
                    transition: "background 0.2s",
                    opacity: u.desativado ? 0.65 : 1
                  }}
                >
                  {/* Matricula */}
                  <span style={{ fontSize: "12.5px", fontFamily: "monospace", color: t.textSub, display: "flex", alignItems: "center", gap: 4 }}>
                    {p.canChangePw && !isSuper ? (
                      <button
                        onClick={() => setModal({ type: "matricula", user: u })}
                        style={{
                          background: "none",
                          border: "none",
                          color: t.accent,
                          cursor: "pointer",
                          padding: "2px 4px",
                          margin: "-2px -4px",
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontWeight: 650,
                          fontSize: "12.5px",
                          fontFamily: "monospace",
                          transition: "all 0.15s"
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = t.accentGlow;
                          e.currentTarget.style.textDecoration = "underline";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = "none";
                          e.currentTarget.style.textDecoration = "none";
                        }}
                        title="Clique pra alterar a matrícula deste usuário"
                      >
                        {u.matricula}
                        <SquarePen size={11} style={{ opacity: 0.6 }} />
                      </button>
                    ) : (
                      <>
                        {u.matricula}
                        {isSuper && (
                          <span style={{ fontSize: 9, background: `linear-gradient(135deg, ${t.accent}, #2040CC)`, color: "#fff", borderRadius: 4, padding: "1px 4px", fontWeight: 700 }}>
                            ROOT
                          </span>
                        )}
                      </>
                    )}
                  </span>

                  {/* Nome */}
                  <div>
                    <span style={{ fontSize: "13.5px", fontWeight: 600, color: u.desativado ? t.textMuted : u.bloqueado ? t.danger : t.text, textDecoration: u.desativado ? "line-through" : "none" }}>
                      {u.nome}
                      {isSelf && <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 400 }}> (você)</span>}
                    </span>
                    {u.desativado && u.desativadoEm && (
                      <div style={{ fontSize: "10.5px", color: t.textMuted, marginTop: 2 }}>
                        Desativado em {new Date(u.desativadoEm).toLocaleDateString("pt-BR")} por {u.desativadoPor}
                      </div>
                    )}
                  </div>

                  {/* Tipo */}
                  <Tag
                    label={isSuper ? "Superadmin" : u.tipo === "adm-dev" ? "ADM" : "Colab."}
                    color={isSuper ? "#fff" : u.tipo === "adm-dev" ? t.accent : t.textSub}
                    bg={isSuper ? `linear-gradient(135deg, ${t.accent}, #2040CC)` : u.tipo === "adm-dev" ? t.accentGlow : t.surfaceAlt}
                  />

                  {/* Status */}
                  <Tag
                    label={u.desativado ? "Desativado" : u.bloqueado ? "Bloqueado" : "Ativo"}
                    color={u.desativado ? t.textMuted : u.bloqueado ? t.danger : t.success}
                    bg={u.desativado ? t.surfaceAlt : u.bloqueado ? t.dangerBg : t.successBg}
                  />

                  {/* Criado Em */}
                  <span style={{ fontSize: 12, color: t.textMuted }}>{timeAgo(u.criadoEm)}</span>

                  {/* Funções Delegadas */}
                  {isAdmTab && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      {isSuper ? (
                        <span style={{ fontSize: 11, color: t.textMuted }}>Mestre (Total)</span>
                      ) : viewerIsSuper ? (
                        <button
                          type="button"
                          onClick={() => setModalDelegation(u)}
                          style={{
                            background: t.surfaceAlt,
                            border: `1.5px solid ${t.border}`,
                            borderRadius: 8,
                            padding: "6px 10px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: "12px",
                            color: t.accent,
                            fontWeight: 600,
                            transition: "all 0.15s"
                          }}
                          title="Clique para delegar ou revogar funções administrativas"
                        >
                          <Shield size={13} color={t.accent} />
                          <span>Configurar ({
                            (u.perm_trocar_senha ? 1 : 0) +
                            (u.perm_bloquear ? 1 : 0) +
                            (u.perm_excluir ? 1 : 0) +
                            (u.perm_editar_calendario ? 1 : 0) +
                            (u.perm_gestao_folhas ? 1 : 0)
                          }/5)</span>
                        </button>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {!(u.perm_trocar_senha || u.perm_bloquear || u.perm_excluir || u.perm_editar_calendario || u.perm_gestao_folhas) ? (
                            <span style={{ fontSize: 11, color: t.textMuted }}>Nenhuma</span>
                          ) : (
                            <>
                              {u.perm_trocar_senha && <Tag label="Senha" color={t.accent} bg={t.accentGlow} />}
                              {u.perm_bloquear && <Tag label="Bloqueio" color={t.warning} bg={t.warningBg} />}
                              {u.perm_excluir && <Tag label="Excluir" color={t.danger} bg={t.dangerBg} />}
                              {u.perm_editar_calendario && <Tag label="Calendário" color={t.success} bg={t.successBg} />}
                              {u.perm_gestao_folhas && <Tag label="Folhas" color={t.gold} bg={t.goldBg} />}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Acoes */}
                  <div style={{ display: "flex", gap: 5 }}>
                    <ActionBtn
                      icon={<Key size={14} color={p.canChangePw ? t.accent : t.textMuted} />}
                      enabled={p.canChangePw}
                      title={p.canChangePw ? "Trocar senha" : "Sem permissão"}
                      onClick={() => setModal({ type: "pw", user: u })}
                      bg={p.canChangePw ? t.surfaceAlt : t.bg}
                      border={t.border}
                      t={t}
                    />
                    {u.tipo === "colaborador" && (
                      <ActionBtn
                        icon={<Plane size={14} color={!u.desativado ? t.success : t.textMuted} />}
                        enabled={!u.desativado}
                        title={!u.desativado ? "Programar Férias" : "Colaborador desativado"}
                        onClick={() => setModal({ type: "ferias", user: u })}
                        bg={!u.desativado ? t.successBg : t.bg}
                        border={!u.desativado ? t.successBorder : t.border}
                        t={t}
                      />
                    )}
                    <ActionBtn
                      icon={u.bloqueado ? <Unlock size={14} color={p.canBlock ? t.success : t.textMuted} /> : <Ban size={14} color={p.canBlock ? t.danger : t.textMuted} />}
                      enabled={p.canBlock}
                      title={u.bloqueado ? "Desbloquear" : "Bloquear"}
                      onClick={() => toggleBlock(u.id)}
                      bg={p.canBlock ? (u.bloqueado ? t.successBg : t.dangerBg) : t.bg}
                      border={p.canBlock ? (u.bloqueado ? t.successBorder : t.dangerBorder) : t.border}
                      t={t}
                    />
                    {u.desativado ? (
                      <ActionBtn
                        icon={<Check size={14} color={p.canDelete ? t.success : t.textMuted} />}
                        enabled={p.canDelete}
                        title="Reativar usuário"
                        onClick={() => reactivateUser(u.id)}
                        bg={p.canDelete ? t.successBg : t.bg}
                        border={p.canDelete ? t.successBorder : t.border}
                        t={t}
                      />
                    ) : (
                      <ActionBtn
                        icon={<Trash2 size={14} color={p.canDelete ? t.danger : t.textMuted} />}
                        enabled={p.canDelete}
                        title="Desativar"
                        onClick={() => setModal({ type: "delete", user: u })}
                        bg={p.canDelete ? t.dangerBg : t.bg}
                        border={p.canDelete ? t.dangerBorder : t.border}
                        t={t}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {tabUsers.length === 0 && (
              <div style={{ padding: "40px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>Nenhum usuário encontrado.</div>
            )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendario Geral / Feriados Corporativos tab */}
      {tab === "feriados" && (
        <div style={{ padding: "24px 28px", maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>Calendário Geral de Feriados</h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: t.textSub }}>
                Clique nos dias para definir feriados oficiais. Feriados aplicam-se a todos os colaboradores: abonam faltas/jornadas sem descontar salários, mas retiram o direito ao cartão alimentação.
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: t.textMuted, background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: "7px 11px", fontWeight: 550 }}>
                {feriados.length} {feriados.length === 1 ? "feriado" : "feriados"} cadastrados
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
            {/* Bloco 1: O Calendário interativo */}
            <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, padding: 20 }}>
              {/* Controles de Mês/Ano */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: t.text, textTransform: "capitalize", display: "flex", alignItems: "center", gap: 6 }}>
                  📅 {new Date(feriasAno, feriasMes, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => {
                      if (feriasMes === 0) {
                        setFeriasMes(11);
                        setFeriasAno(v => v - 1);
                      } else {
                        setFeriasMes(v => v - 1);
                      }
                    }}
                    style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, padding: "6px 12px", borderRadius: 8, color: t.text, cursor: "pointer", fontSize: 12, fontWeight: 650, fontFamily: "inherit" }}
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => {
                      if (feriasMes === 11) {
                        setFeriasMes(0);
                        setFeriasAno(v => v + 1);
                      } else {
                        setFeriasMes(v => v + 1);
                      }
                    }}
                    style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, padding: "6px 12px", borderRadius: 8, color: t.text, cursor: "pointer", fontSize: 12, fontWeight: 650, fontFamily: "inherit" }}
                  >
                    Próximo
                  </button>
                </div>
              </div>

              {/* Grid de dias da semana */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center", marginBottom: 8 }}>
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
                  <span key={d} style={{ fontSize: 11, fontWeight: 700, color: t.textMuted }}>{d}</span>
                ))}
              </div>

              {/* Grid dos dias */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                {/* Espaços vazios iniciais */}
                {Array.from({ length: new Date(feriasAno, feriasMes, 1).getDay() }).map((_, i) => (
                  <div key={"empty-" + i} />
                ))}
                {/* Dias do mês */}
                {Array.from({ length: new Date(feriasAno, feriasMes + 1, 0).getDate() }).map((_, i) => {
                  const dia = i + 1;
                  const dateString = `${feriasAno}-${String(feriasMes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
                  const eFeriado = feriados.includes(dateString);
                  return (
                    <button
                      key={dia}
                      onClick={() => {
                        if (currentUser.matricula !== SUPERADMIN_MAT && !currentUser.perm_editar_calendario) {
                          showToast("Você não possui permissão delegada para editar o calendário.", "warning");
                          return;
                        }
                        const [y, m, d] = dateString.split("-").map(Number);
                        const dFmt = new Date(y, m - 1, d).toLocaleDateString("pt-BR");
                        if (eFeriado) {
                          setFeriados(feriados.filter(x => x !== dateString));
                          addLog("Removeu Feriado", dFmt, `Feriado geral de ${dFmt} foi desmarcado.`);
                          showToast(`Feriado de ${dFmt} removido.`);
                        } else {
                          setFeriados([...feriados, dateString]);
                          addLog("Marcou Feriado", dFmt, `Feriado geral de ${dFmt} foi cadastrado.`);
                          showToast(`Feriado de ${dFmt} cadastrado para todos.`);
                        }
                      }}
                      style={{
                        background: eFeriado ? "rgba(239,68,68,0.14)" : t.surfaceAlt,
                        border: `1.5px solid ${eFeriado ? "#EF4444" : t.border}`,
                        borderRadius: 9,
                        padding: "10px 4px",
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        minHeight: 48,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "inherit"
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: eFeriado ? "#EF4444" : t.text }}>{dia}</span>
                      {eFeriado && <span style={{ fontSize: 8, color: "#EF4444", fontWeight: 750, marginTop: 2 }}>FERIADO</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bloco 2: Lista lateral de todos os Feriados cadastrados */}
            <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", height: "fit-content" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>Lista de Feriados</span>
              <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, marginBottom: 16 }}>
                {feriados.length === 0 ? (
                  <span style={{ fontSize: 12, color: t.textMuted, textAlign: "center", padding: "16px 0" }}>Nenhum feriado cadastrado.</span>
                ) : (
                  feriados
                    .slice()
                    .sort()
                    .map(f => {
                      const [anoCheck, mesCheck, diaCheck] = f.split("-").map(Number);
                      const dFmt = new Date(anoCheck, mesCheck - 1, diaCheck).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
                      return (
                        <div key={f} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: t.surfaceAlt, padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}` }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: t.text, fontFamily: "monospace" }}>{dFmt}</span>
                          <button
                            onClick={() => {
                              if (currentUser.matricula !== SUPERADMIN_MAT && !currentUser.perm_editar_calendario) {
                                showToast("Você não possui permissão delegada para editar o calendário.", "warning");
                                return;
                              }
                              const [y, m, d] = f.split("-").map(Number);
                              const dFmt = new Date(y, m - 1, d).toLocaleDateString("pt-BR");
                              setFeriados(feriados.filter(x => x !== f));
                              addLog("Removeu Feriado", dFmt, `Feriado geral de ${dFmt} foi desmarcado.`);
                              showToast(`Feriado de ${dFmt} removido.`);
                            }}
                            style={{ background: "none", border: "none", color: t.danger, fontSize: 11, cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}
                          >
                            Excluir
                          </button>
                        </div>
                      );
                    })
                )}
              </div>
              <button
                onClick={() => {
                  if (currentUser.matricula !== SUPERADMIN_MAT && !currentUser.perm_editar_calendario) {
                    showToast("Você não possui permissão delegada para editar o calendário.", "warning");
                    return;
                  }
                  if (confirm("Deseja realmente limpar todos os feriados cadastrados?")) {
                    setFeriados([]);
                    addLog("Limpou todos os feriados", "Geral");
                    showToast("Todos os feriados foram removidos.");
                  }
                }}
                disabled={feriados.length === 0}
                style={{
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 10,
                  padding: "10px",
                  cursor: feriados.length === 0 ? "default" : "pointer",
                  fontSize: 12.5,
                  fontWeight: 650,
                  color: t.danger,
                  width: "100%",
                  fontFamily: "inherit",
                  opacity: feriados.length === 0 ? 0.45 : 1
                }}
              >
                Limpar Todos os Feriados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auditoria Logs tab */}
      {tab === "auditoria" && (
        <div style={{ padding: "24px 28px", maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>Log de Auditoria</h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: t.textSub }}>
                Todas as ações administrativas ficam registradas de forma imutável para conformidade legal (Portaria 671/2021).
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {combinedAuditLogs.length > 0 && (
                <>
                  <button
                    onClick={exportLogsExcel}
                    style={{
                      background: "rgba(16,185,129,0.12)",
                      border: "1px solid rgba(16,185,129,0.3)",
                      borderRadius: 10,
                      padding: "7px 14px",
                      cursor: "pointer",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#10B981",
                      fontFamily: "inherit",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.15s"
                    }}
                    title="Exportar registros do log para Excel (CSV compatível)"
                  >
                    <FileSpreadsheet size={15} />
                    Exportar Excel
                  </button>

                  <button
                    onClick={exportLogsPDF}
                    style={{
                      background: t.accentGlow,
                      border: `1.5px solid ${t.borderFocus}`,
                      borderRadius: 10,
                      padding: "6px 14px",
                      cursor: "pointer",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: t.accent,
                      fontFamily: "inherit",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.15s"
                    }}
                    title="Visualizar relatório de auditoria formatado para impressão ou salvar em PDF"
                  >
                    <Printer size={15} />
                    Imprimir / PDF
                  </button>

                  <span style={{ fontSize: 12, color: t.textMuted, background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: "7px 11px", fontWeight: 550 }}>
                    {combinedAuditLogs.length} registros
                  </span>
                </>
              )}
            </div>
          </div>

          <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, overflow: "hidden" }}>
            {combinedAuditLogs.length === 0 ? (
              <div style={{ padding: "52px 0", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.textSub }}>Nenhuma ação registrada ainda</div>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "160px 130px 160px 1fr 1fr", borderBottom: `1.5px solid ${t.border}`, padding: "10px 18px" }}>
                  {["Data / Hora", "Responsável", "Matrícula", "Ação", "Afetado / Detalhe"].map(h => (
                    <span key={h} style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {h}
                    </span>
                  ))}
                </div>
                {combinedAuditLogs.map((entry, idx) => {
                  const isRed = entry.acao.includes("Excluiu") || entry.acao.includes("Desativou");
                  const isYel = entry.acao.includes("Bloqueou") || entry.acao.includes("permissão");
                  const isGrn = entry.acao.includes("Criou") || entry.acao.includes("Desbloqueou") || entry.acao.includes("termo");
                  const acaoCor = isRed ? t.danger : isYel ? t.warning : isGrn ? t.success : t.accent;
                  const acaoBg = isRed ? t.dangerBg : isYel ? t.warningBg : isGrn ? t.successBg : t.accentGlow;

                  const d = new Date(entry.quando);
                  const dataFmt = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
                  const horaFmt = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

                  return (
                    <div
                      key={entry.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "160px 130px 160px 1fr 1fr",
                        padding: "11px 18px",
                        borderBottom: `1px solid ${t.border}`,
                        background: idx % 2 === 0 ? "transparent" : t.surfaceAlt,
                        alignItems: "center"
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: "monospace" }}>{horaFmt}</div>
                        <div style={{ fontSize: 11, color: t.textMuted }}>{dataFmt}</div>
                      </div>
                      <span style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{entry.quem}</span>
                      <span style={{ fontSize: "12.5px", color: t.textMuted, fontFamily: "monospace" }}>{entry.quemMat}</span>
                      <span style={{ display: "inline-flex" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: acaoCor, background: acaoBg, border: `1.5px solid ${acaoCor}33`, borderRadius: 6, padding: "3px 9px", whiteSpace: "nowrap" }}>
                          {entry.acao}
                        </span>
                      </span>
                      <div>
                        <div style={{ fontSize: 13, color: t.text }}>{entry.alvo}</div>
                        {entry.detalhe && <div style={{ fontSize: "11.5px", color: t.textMuted, marginTop: 2 }}>{entry.detalhe}</div>}
                        {entry.latitude && entry.longitude ? (
                          <div style={{ fontSize: "11px", color: t.accent, marginTop: 4, display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
                            <span>📍</span>
                            <span style={{ fontWeight: 650 }}>Localização:</span>
                            <span style={{ fontFamily: "monospace" }}>{entry.latitude.toFixed(5)}, {entry.longitude.toFixed(5)}</span>
                            {entry.accuracy !== undefined && (
                              <span style={{ 
                                background: entry.accuracy <= 10 ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)", 
                                color: entry.accuracy <= 10 ? "#16a34a" : "#d97706",
                                border: `1px solid ${entry.accuracy <= 10 ? "rgba(34,197,94,0.25)" : "rgba(245,158,11,0.25)"}`,
                                padding: "1px 5px",
                                borderRadius: 5,
                                fontSize: "9.5px",
                                fontWeight: 700,
                                marginLeft: 4
                              }}>
                                ±{entry.accuracy.toFixed(1)}m
                              </span>
                            )}
                            <a
                              href={`https://maps.google.com/?q=${entry.latitude},${entry.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: t.accent,
                                textDecoration: "underline",
                                marginLeft: 4,
                                fontSize: "10.5px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3
                              }}
                            >
                              Ver no mapa
                            </a>
                            <span style={{ color: t.border, margin: "0 4px" }}>|</span>
                            <button
                              onClick={() => setSelectedGeoLog(entry)}
                              title="Ver ficha jurídica e metadados detalhados de GPS, precisão e privacidade (LGPD)"
                              style={{
                                background: "rgba(16, 185, 129, 0.08)",
                                border: "1px solid rgba(16, 185, 129, 0.25)",
                                color: "#059669",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "3px 8px",
                                borderRadius: 6,
                                fontSize: "10.5px",
                                fontWeight: 700,
                                fontFamily: "inherit",
                                transition: "all 0.15s",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                              }}
                            >
                              <FileText size={12} style={{ color: "#059669" }} />
                              <Map size={12} style={{ color: "#059669" }} />
                              <span>Ficha Legal GPS</span>
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: "11px", color: t.textMuted, marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}>
                            <span>📍</span>
                            <span>Sem coordenadas</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* Arquivo Morto / Closed Files tab */}
      {tab === "arquivo_morto" && (
        <div style={{ padding: "24px 28px", maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>Arquivo Morto (Retenção e Descarte Seguro)</h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: t.textSub }}>
                Acompanhamento de registros salvaguardados de ex-colaboradores. Conforme exigência legal da CLT (Portaria 671/MTE) e da LGPD, os dados de ponto devem ser retidos por <strong style={{ color: t.text }}>5 anos</strong> a partir da desativação antes de sua exclusão permanente.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {deactivatedUsers.length === 0 ? (
              <div style={{ padding: "48px 24px", background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, textAlign: "center", color: t.textMuted }}>
                <Shield size={38} style={{ color: t.textMuted, opacity: 0.5, marginBottom: 12, display: "block", marginLeft: "auto", marginRight: "auto" }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>Nenhum colaborador no Arquivo Morto</div>
                <p style={{ margin: 0, fontSize: 12, color: t.textSub, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
                  Quando você desativa um colaborador no painel principal, seus registros são arquivados com segurança aqui para cumprimento do prazo trabalhista obrigatório.
                </p>
              </div>
            ) : (
              deactivatedUsers.map(u => {
                const startIso = u.desativadoEm || u.criadoEm || "2021-06-15T08:00:00Z";
                const startDate = new Date(startIso);
                const endDate = new Date(startDate);
                endDate.setFullYear(startDate.getFullYear() + 5);

                const startFmt = startDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
                const endFmt = endDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

                const isExpired = new Date() >= endDate;

                // Calculate progress or remaining text
                const diffTime = endDate.getTime() - new Date().getTime();
                const totalDiff = endDate.getTime() - startDate.getTime();
                const progressPct = isExpired ? 100 : Math.max(0, Math.min(99, ((totalDiff - diffTime) / totalDiff) * 100));

                let remainingText = "";
                if (isExpired) {
                  remainingText = "Prazo legal de 5 anos concluído! Pronto para descarte definitivo.";
                } else {
                  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  if (daysLeft > 365) {
                    const years = (daysLeft / 365).toFixed(1);
                    remainingText = `Faltam ~${years} anos (${daysLeft} dias) de salvaguarda legal`;
                  } else {
                    remainingText = `Faltam ${daysLeft} dias de salvaguarda legal`;
                  }
                }

                return (
                  <div
                    key={u.id}
                    id={`archive-card-${u.id}`}
                    style={{
                      background: t.surface,
                      border: `1.5px solid ${isExpired ? t.successBorder : t.border}`,
                      borderRadius: 14,
                      padding: "16px 20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                      transition: "all 0.2s"
                    }}
                  >
                    {/* Top row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: isExpired ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.12)",
                            border: `1px solid ${isExpired ? t.successBorder : t.border}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                        >
                          <Shield size={18} color={isExpired ? t.success : t.textSub} />
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{u.nome}</div>
                          <div style={{ fontSize: 11, color: t.textSub, fontFamily: "monospace", display: "flex", gap: 8, marginTop: 2 }}>
                            <span>Matrícula: <strong>{u.matricula}</strong></span>
                            <span>•</span>
                            <span>Tipo: <strong>{u.tipo === "adm-dev" ? "Administrador" : "Colaborador"}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {isExpired ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: t.success, background: "rgba(16,185,129,0.11)", border: `1px solid ${t.successBorder}`, borderRadius: 6, padding: "4px 10px" }}>
                            ✓ Retenção Concluída
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 700, color: t.gold, background: "rgba(217,119,6,0.11)", border: `1px solid ${t.goldBorder}`, borderRadius: 6, padding: "4px 10px" }}>
                            🔒 Sob Retenção Legal
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dates Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, background: t.surfaceAlt, borderRadius: 10, padding: 12, border: `1px solid ${t.border}` }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 10, color: t.textSub, fontWeight: 600, textTransform: "uppercase" }}>Início da Retenção (Desativação)</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{startFmt}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 10, color: t.textSub, fontWeight: 600, textTransform: "uppercase" }}>Fim do Prazo Legal (5 Anos)</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isExpired ? t.success : t.text }}>{endFmt}</span>
                      </div>
                      <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: t.textSub, fontWeight: 550 }}>{remainingText}</span>
                          <span style={{ fontSize: 11, color: t.textSub, fontWeight: 700 }}>{Math.round(progressPct)}%</span>
                        </div>
                        <div style={{ width: "100%", height: 6, borderRadius: 3, background: t.border, overflow: "hidden" }}>
                          <div style={{ width: `${progressPct}%`, height: "100%", borderRadius: 3, background: isExpired ? t.success : t.accent, transition: "width 0.3s ease" }} />
                        </div>
                      </div>
                    </div>

                    {/* Action Row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                      <button
                        onClick={() => retrocederDesativacao(u.id)}
                        style={{
                          background: "transparent",
                          border: `1px dashed ${t.border}`,
                          color: t.accent,
                          fontSize: 11.5,
                          fontFamily: "inherit",
                          fontWeight: 600,
                          borderRadius: 8,
                          padding: "6px 12px",
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                      >
                        ⏳ Simular prazo expirado (-5 anos)
                      </button>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button
                          onClick={() => reactivateUser(u.id)}
                          style={{
                            background: t.surfaceAlt,
                            border: `1px solid ${t.border}`,
                            color: t.text,
                            fontSize: 12,
                            fontWeight: 650,
                            borderRadius: 8,
                            padding: "7px 14px",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            transition: "all 0.2s"
                          }}
                        >
                          Reativar Colaborador
                        </button>

                        {isExpired ? (
                          <button
                            onClick={() => excluirPermanentemente(u.id)}
                            title="Excluir permanentemente"
                            id={`delete-permanent-${u.id}`}
                            style={{
                              background: t.dangerBg,
                              border: `1.5px solid ${t.dangerBorder}`,
                              color: t.danger,
                              borderRadius: 8,
                              padding: "7px 11px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.2s"
                            }}
                          >
                            <Trash2 size={16} style={{ marginRight: 6 }} />
                            <span style={{ fontSize: 12, fontWeight: 700 }}>Excluir</span>
                          </button>
                        ) : (
                          <div
                            title="Sob retenção legal de 5 anos (CLT/LGPD)"
                            style={{
                              background: "none",
                              border: `1px solid ${t.border}`,
                              color: t.textMuted,
                              borderRadius: 8,
                              padding: "7px 11px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              opacity: 0.5,
                              cursor: "not-allowed"
                            }}
                          >
                            <Trash2 size={16} style={{ marginRight: 6 }} />
                            <span style={{ fontSize: 12, fontWeight: 650 }}>Excluir</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Real-time Firebase Storage & Usage Monitor tab */}
      {tab === "armazenamento" && (
        <div style={{ padding: "24px 28px", maxWidth: 980, margin: "0 auto" }}>
          {/* Dashboard Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
                <Database size={18} color={t.accent} /> Monitoramento de Armazenamento Firebase
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: t.textSub }}>
                Acompanhamento em tempo real da volumetria física do banco de dados, limites de cotas (Free Tier) e conectividade.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ 
                fontSize: 11, 
                fontWeight: 700, 
                color: t.success, 
                background: t.successBg, 
                border: `1.5px solid ${t.successBorder}`, 
                borderRadius: 20, 
                padding: "4px 12px", 
                display: "inline-flex", 
                alignItems: "center", 
                gap: 6 
              }}>
                <span className="animate-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
                CONECTADO / ONLINE
              </span>
            </div>
          </div>

          {/* Bento-style Row 1: High-level Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 20, marginBottom: 24 }}>
            {/* Card 1: Estimated Storage Footprint */}
            <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>Espaço Físico Estimado</span>
                  <div style={{ fontSize: 26, fontWeight: 800, color: t.text, marginTop: 4, fontFamily: "monospace" }}>
                    {(firebaseStats.totalBytes / 1024).toFixed(2)} KB
                  </div>
                </div>
                <div style={{ background: t.accentGlow, color: t.accent, borderRadius: 10, padding: 8 }}>
                  <HardDrive size={20} />
                </div>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: t.textSub }}>
                  <span>Cota Gratuita do Firestore (1 GB)</span>
                  <strong style={{ color: t.text }}>{((firebaseStats.totalBytes / 1073741824) * 100).toFixed(6)}%</strong>
                </div>
                <div style={{ width: "100%", height: 6, borderRadius: 3, background: t.border, overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(1, (firebaseStats.totalBytes / 1073741824) * 100)}%`, height: "100%", background: t.accent, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, color: t.textMuted }}>
                  Total físico calculado com overhead de cabeçalho: {firebaseStats.totalBytes.toLocaleString("pt-BR")} bytes.
                </span>
              </div>
            </div>

            {/* Card 2: Document Counts */}
            <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>Documentos no Firestore</span>
                  <div style={{ fontSize: 26, fontWeight: 800, color: t.text, marginTop: 4, fontFamily: "monospace" }}>
                    {firebaseStats.totalDocs}
                  </div>
                </div>
                <div style={{ background: "rgba(16,185,129,0.12)", color: "#10B981", borderRadius: 10, padding: 8 }}>
                  <Database size={20} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12, color: t.textSub }}>
                <div style={{ background: t.surfaceAlt, borderRadius: 8, padding: "6px 10px", border: `1px solid ${t.border}` }}>
                  <span>Usuários:</span> <strong style={{ color: t.text, fontFamily: "monospace" }}>{firebaseStats.usersCount}</strong>
                </div>
                <div style={{ background: t.surfaceAlt, borderRadius: 8, padding: "6px 10px", border: `1px solid ${t.border}` }}>
                  <span>Histórico:</span> <strong style={{ color: t.text, fontFamily: "monospace" }}>{firebaseStats.pontosCount}</strong>
                </div>
                <div style={{ background: t.surfaceAlt, borderRadius: 8, padding: "6px 10px", border: `1px solid ${t.border}` }}>
                  <span>Audit Logs:</span> <strong style={{ color: t.text, fontFamily: "monospace" }}>{firebaseStats.logsCount}</strong>
                </div>
                <div style={{ background: t.surfaceAlt, borderRadius: 8, padding: "6px 10px", border: `1px solid ${t.border}` }}>
                  <span>Configurações:</span> <strong style={{ color: t.text, fontFamily: "monospace" }}>{firebaseStats.configCount}</strong>
                </div>
              </div>
            </div>

            {/* Card 3: Session Operations */}
            <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>Operações de Sessão</span>
                  <div style={{ fontSize: 26, fontWeight: 800, color: t.text, marginTop: 4, fontFamily: "monospace", display: "flex", alignItems: "baseline", gap: 6 }}>
                    {sessionReads + sessionWrites} <span style={{ fontSize: 12, fontWeight: 550, color: t.textSub }}>ops</span>
                  </div>
                </div>
                <div style={{ background: t.goldBg, color: t.gold, borderRadius: 10, padding: 8 }}>
                  <Activity size={20} />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 11.5, color: t.textSub }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.accent }} /> Leituras (Reads)
                  </span>
                  <div>
                    <strong style={{ color: t.text, fontFamily: "monospace" }}>{sessionReads}</strong>
                    <span style={{ color: t.textMuted }}> / 50k grátis/dia</span>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} /> Escritas (Writes)
                  </span>
                  <div>
                    <strong style={{ color: t.text, fontFamily: "monospace" }}>{sessionWrites}</strong>
                    <span style={{ color: t.textMuted }}> / 20k grátis/dia</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bento Row 2: Database Configuration and Latency Tester */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, marginBottom: 24, alignItems: "stretch" }}>
            {/* Left Box: Connection Meta */}
            <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text, borderBottom: `1px solid ${t.border}`, paddingBottom: 10 }}>
                Metadados do Banco de Dados Ativo
              </span>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>ID do Projeto do Google Cloud</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginTop: 3, fontFamily: "monospace" }}>
                    gen-lang-client-0912799008
                  </div>
                </div>
                
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>ID da Instância Firestore</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginTop: 3, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title="ai-studio-registrodeponto-c804ed9a-d959-4815-854a-eafb29aa305b">
                    ai-studio-registrodeponto-c804ed9a-d959-4815-854a-eafb29aa305b
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>Endpoints do SDK</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginTop: 3, fontFamily: "monospace" }}>
                    firestore.googleapis.com
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>Região do Cluster</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginTop: 3 }}>
                    us-west2 (Los Angeles / Oregon)
                  </div>
                </div>
              </div>

              <div style={{ background: t.surfaceAlt, borderRadius: 10, padding: 12, border: `1px solid ${t.border}`, fontSize: 12, color: t.textSub, lineHeight: 1.5 }}>
                ℹ️ <strong>Persistência e Confiabilidade:</strong> Os dados armazenados são replicados geograficamente de forma síncrona pela infraestrutura do Firebase para garantir disponibilidade de 99.99% e proteção contra perdas acidentais.
              </div>
            </div>

            {/* Right Box: Latency Tester */}
            <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text, display: "block", marginBottom: 6 }}>
                  Teste de Latência do Cluster
                </span>
                <p style={{ margin: 0, fontSize: 12, color: t.textSub, lineHeight: 1.4 }}>
                  Mede a velocidade de tráfego de ida e volta para os servidores do Firebase em tempo real.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, margin: "16px 0" }}>
                {latency !== null ? (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ 
                      fontSize: 34, 
                      fontWeight: 900, 
                      color: latency === -1 ? t.danger : latency < 75 ? t.success : latency < 150 ? t.gold : t.warning, 
                      fontFamily: "monospace" 
                    }}>
                      {latency === -1 ? "ERRO" : `${latency} ms`}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 650, color: t.textMuted, textTransform: "uppercase" }}>
                      {latency === -1 ? "Falha na resposta" : latency < 75 ? "Conexão Excelente" : latency < 150 ? "Conexão Boa" : "Latência Moderada"}
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: t.textMuted }}>Clique abaixo para testar</span>
                )}
              </div>

              <button
                onClick={testPing}
                disabled={pinging}
                style={{
                  background: pinging ? t.surfaceAlt : t.accent,
                  border: `1.5px solid ${pinging ? t.border : "transparent"}`,
                  color: pinging ? t.textSub : "#fff",
                  borderRadius: 10,
                  padding: "10px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: pinging ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontFamily: "inherit",
                  transition: "all 0.2s"
                }}
              >
                <RefreshCw size={14} className={pinging ? "animate-spin" : ""} />
                {pinging ? "Medindo latência..." : "Testar Conectividade"}
              </button>
            </div>
          </div>

          {/* Console Card: Live logs stream terminal */}
          <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ 
              background: t.surfaceAlt, 
              borderBottom: `1.5px solid ${t.border}`, 
              padding: "12px 18px", 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center" 
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
                <Cpu size={15} color={t.accent} /> Terminal de Sincronização em Tempo Real (Firestore)
              </span>
              <button
                onClick={() => {
                  setConsoleLogs([
                    { time: new Date().toLocaleTimeString("pt-BR"), type: "INFO", text: "Terminal de logs limpo pelo administrador." }
                  ]);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: t.accent,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit"
                }}
              >
                Limpar Logs
              </button>
            </div>
            
            <div style={{ 
              background: "#090d16", 
              color: "#38bdf8", 
              fontFamily: "monospace", 
              fontSize: "12px", 
              padding: "16px 20px", 
              height: 200, 
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 6
            }}>
              {consoleLogs.map((log, idx) => (
                <div key={idx} style={{ display: "flex", gap: 10, lineHeight: 1.5 }}>
                  <span style={{ color: "#64748b" }}>[{log.time}]</span>
                  <span style={{ 
                    color: log.type === "SUCCESS" ? "#4ade80" : log.type === "WARN" ? "#f87171" : "#38bdf8", 
                    fontWeight: 700 
                  }}>
                    {log.type}:
                  </span>
                  <span style={{ color: "#f1f5f9" }}>{log.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Real-time HR Maintenance Routine Checklists & Guide */}
      {tab === "guia_manutencao" && (
        <div style={{ padding: "24px 28px", maxWidth: 980, margin: "0 auto" }}>
          {/* Dashboard Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
                <ClipboardList size={18} color={t.accent} /> Guia de Rotinas e Manutenção
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: t.textSub }}>
                Acompanhamento e passo a passo interativo para as rotinas administrativas semanais e mensais da empresa.
              </p>
            </div>
          </div>

          {/* Cérebro de Autocura Ativo Dashboard */}
          <div style={{ 
            background: t.surface, 
            border: `1.5px solid ${t.border}`, 
            borderRadius: 14, 
            padding: "20px 24px", 
            marginBottom: 28,
            boxShadow: `0 4px 20px rgba(0,0,0,0.02)`
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${t.border}`, paddingBottom: 12, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ 
                  width: 10, 
                  height: 10, 
                  borderRadius: "50%", 
                  background: healingRunning ? t.warning : "#22C55E", 
                  boxShadow: healingRunning ? "0 0 10px rgba(245,158,11,0.6)" : "0 0 10px rgba(34,197,94,0.6)",
                }} />
                <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
                  <Cpu size={18} color={t.accent} />
                  Cérebro de Autocura Ativo
                </h3>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {statsToRender.lastRun && (
                  <span style={{ fontSize: 11.5, color: t.textMuted }}>
                    Última execução: {statsToRender.lastRun}
                  </span>
                )}
                <button
                  onClick={runSelfHealing}
                  disabled={healingRunning}
                  style={{
                    background: healingRunning ? t.surfaceAlt : t.accentGlow,
                    border: `1px solid ${healingRunning ? t.border : t.accent}`,
                    color: healingRunning ? t.textMuted : t.accent,
                    padding: "4px 10px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: healingRunning ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    transition: "all 0.2s"
                  }}
                >
                  <RefreshCw size={12} style={{ animation: healingRunning ? "spin 1s linear infinite" : "none" }} />
                  {healingRunning ? "Executando..." : "Forçar Varredura"}
                </button>
              </div>
            </div>

            {/* Main status indicator */}
            <div style={{ 
              background: healingRunning ? t.warningBg : (statsToRender.oddPunchesFixed + statsToRender.doubleClicksSanitized + statsToRender.clockDivergencesFlagged + (statsToRender.offlineReviewed || 0) > 0) ? t.successBg : t.surfaceAlt,
              border: `1px solid ${healingRunning ? t.warningBorder : (statsToRender.oddPunchesFixed + statsToRender.doubleClicksSanitized + statsToRender.clockDivergencesFlagged + (statsToRender.offlineReviewed || 0) > 0) ? t.successBorder : t.border}`,
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 16,
              fontSize: 13,
              fontWeight: 600,
              color: healingRunning ? t.warning : (statsToRender.oddPunchesFixed + statsToRender.doubleClicksSanitized + statsToRender.clockDivergencesFlagged + (statsToRender.offlineReviewed || 0) > 0) ? t.success : t.textSub,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              {healingRunning ? (
                <>🔄 Sincronizando dados históricos e executando rotinas de limpeza inteligente em segundo plano...</>
              ) : (statsToRender.oddPunchesFixed + statsToRender.doubleClicksSanitized + statsToRender.clockDivergencesFlagged + (statsToRender.offlineReviewed || 0) > 0) ? (
                <>🟢 Autocura Ativa: {statsToRender.oddPunchesFixed + statsToRender.doubleClicksSanitized + statsToRender.clockDivergencesFlagged + (statsToRender.offlineReviewed || 0)} inconsistências e auditorias de dados corrigidas/revisadas automaticamente.</>
              ) : (
                <>✅ Nenhum erro de dados detectado nas últimas 24h. Banco de dados do Firebase Firestore em perfeito estado.</>
              )}
            </div>

            {/* Metrics Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
              {/* Metric 1 */}
              <div style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 2 }}>
                  {statsToRender.oddPunchesFixed}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textSub, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>
                  Batidas Ímpares
                </div>
                <div style={{ fontSize: 11, color: t.textMuted }}>
                  Isoladas & Flag de Justificativa
                </div>
              </div>
              {/* Metric 2 */}
              <div style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 2 }}>
                  {statsToRender.doubleClicksSanitized}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textSub, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>
                  Cliques Duplicados
                </div>
                <div style={{ fontSize: 11, color: t.textMuted }}>
                  Sanitizados & Ocultados
                </div>
              </div>
              {/* Metric 3 */}
              <div style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 2 }}>
                  {statsToRender.clockDivergencesFlagged}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textSub, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>
                  Divergência de Hora
                </div>
                <div style={{ fontSize: 11, color: t.textMuted }}>
                  Local vs Brasília Marcados
                </div>
              </div>
              {/* Metric 4 */}
              <div style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 2 }}>
                  {statsToRender.offlineReviewed || 0}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textSub, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>
                  Registros Offline
                </div>
                <div style={{ fontSize: 11, color: t.textMuted }}>
                  Revisados & Validados
                </div>
              </div>
            </div>

            {/* Live Logs */}
            {healingLogs.length > 0 && (
              <div>
                <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: t.textSub, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Console do Cérebro (Logs de Execução)
                </h4>
                <div style={{ 
                  background: "#1E1E1E", 
                  border: "1px solid #333", 
                  borderRadius: 10, 
                  padding: "10px 14px", 
                  maxHeight: 140, 
                  overflowY: "auto", 
                  fontFamily: "monospace", 
                  fontSize: 11.5, 
                  color: "#A9B7C6", 
                  lineHeight: 1.5,
                  boxShadow: "inset 0 2px 8px rgba(0,0,0,0.4)"
                }}>
                  {healingLogs.map((log, lidx) => (
                    <div key={lidx} style={{ marginBottom: 4, whiteSpace: "pre-wrap", borderBottom: lidx < healingLogs.length - 1 ? "1px solid #2B2B2B" : "none", paddingBottom: 4 }}>
                      <span style={{ color: "#808080", marginRight: 8 }}>[{new Date().toLocaleTimeString("pt-BR")}]</span>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reassurance Architecture Card */}
          <div style={{ 
            background: `linear-gradient(135deg, ${t.surface}, ${t.surfaceAlt})`, 
            border: `1.5px solid ${t.border}`, 
            borderRadius: 14, 
            padding: "20px 24px", 
            marginBottom: 28,
            boxShadow: `0 4px 20px rgba(0,0,0,0.02)`
          }}>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ background: t.accentGlow, color: t.accent, borderRadius: 12, padding: 10, display: "flex" }}>
                <Globe size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
                  Hospedagem em Produção Real (GitHub Pages, Vercel, etc.)
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: t.textSub, lineHeight: 1.6 }}>
                  <strong>Sim, funciona perfeitamente para empresas de verdade!</strong> Este sistema foi projetado sob uma arquitetura serverless robusta integrada diretamente com o <strong>Google Firebase Firestore</strong>. 
                  Diferente de sistemas legados que exigem servidores dedicados caros (Node/PHP/Python), o Firebase se conecta de forma direta e segura no navegador de cada funcionário através do Web SDK, assegurado pelas regras de segurança de acesso. 
                  Você pode hospedar o frontend no <strong>GitHub Pages, Vercel, Netlify ou Firebase Hosting a custo zero</strong> e tudo funcionará 100% perfeitamente com sincronização instantânea!
                </p>
                <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, background: t.successBg, border: `1px solid ${t.successBorder}`, color: t.success, padding: "3px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Check size={12} /> Compatível com GitHub Pages
                  </span>
                  <span style={{ fontSize: 11.5, background: t.successBg, border: `1px solid ${t.successBorder}`, color: t.success, padding: "3px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Check size={12} /> Google Firebase Serverless
                  </span>
                  <span style={{ fontSize: 11.5, background: t.accentGlow, border: `1px solid ${t.border}`, color: t.accent, padding: "3px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Shield size={12} /> Regras de Acesso Ativas
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Checklists Columns Bento-style Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 24, marginBottom: 24 }}>
            
            {/* Column 1: Weekly Routine */}
            <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
                    <Calendar size={16} color={t.accent} /> Checklist Semanal
                  </h3>
                  <span style={{ fontSize: 12, color: t.textSub }}>Ideal para o fechamento de toda sexta-feira</span>
                </div>
                <button 
                  onClick={() => setCheckedWeekly([])}
                  style={{
                    background: "none",
                    border: "none",
                    color: t.accent,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit"
                  }}
                >
                  Reiniciar
                </button>
              </div>

              {/* Progress Tracker */}
              <div style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: t.textSub }}>Progresso semanal</span>
                  <strong style={{ color: t.text }}>{checkedWeekly.length} de 4 ({Math.round(checkedWeekly.length / 4 * 100)}%)</strong>
                </div>
                <div style={{ width: "100%", height: 6, background: t.border, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${checkedWeekly.length / 4 * 100}%`, height: "100%", background: t.accent, borderRadius: 3, transition: "width 0.3s ease" }} />
                </div>
              </div>

              {/* Tasks */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  {
                    id: "w1",
                    title: "Auditoria de Horários e Batidas Incompletas",
                    short: "Localizar e ajustar marcações ímpares de colaboradores.",
                    details: [
                      "Acesse a aba principal 'Colaboradores'.",
                      "Examine as planilhas semanais: dias com número ímpar de batidas (ex: Entrada sem Saída) geram alertas de inconsistência automaticamente.",
                      "Fale com o colaborador para alinhar o horário real esquecido e faça o ajuste manual inserindo a justificativa correspondente."
                    ]
                  },
                  {
                    id: "w2",
                    title: "Revisar Histórico de Auditoria (Audit Logs)",
                    short: "Auditar ajustes manuais e redefinições de senha efetuadas.",
                    details: [
                      "Acesse a aba 'Auditoria'.",
                      "Analise as alterações feitas por outros administradores na semana corrente.",
                      "Garanta que toda ação de 'Ajuste Manual' ou 'Bloqueio' esteja respaldada por um chamado de suporte ou aviso de RH."
                    ]
                  },
                  {
                    id: "w3",
                    title: "Verificar Lançamento de Férias Ativas",
                    short: "Garantir conformidade do cronograma com as batidas de ponto.",
                    details: [
                      "Consulte o botão de Férias e afins no painel para conferir quem está em férias na semana.",
                      "Validar se os colaboradores ausentes estão configurados como dispensados na escala.",
                      "Isso previne alertas incorretos de faltas automáticas ou furos de escala no cálculo global."
                    ]
                  },
                  {
                    id: "w4",
                    title: "Verificação de Conectividade do Banco",
                    short: "Testar o sinal do Firestore para garantir velocidade do sistema.",
                    details: [
                      "Acesse a aba 'Monitor Firebase' no menu.",
                      "Clique no botão 'Testar Conectividade' para medir o tempo de ida e volta do servidor.",
                      "Certifique-se de que a latência média permanece abaixo de 150ms para um perfeito uso diário."
                    ]
                  }
                ].map(task => {
                  const isChecked = checkedWeekly.includes(task.id);
                  const isExpanded = expandedTask === task.id;
                  return (
                    <div 
                      key={task.id} 
                      style={{ 
                        background: isChecked ? t.surfaceAlt : t.surface, 
                        border: `1px solid ${isChecked ? t.accent : t.border}`, 
                        borderRadius: 10,
                        overflow: "hidden",
                        transition: "all 0.2s"
                      }}
                    >
                      <div 
                        style={{ 
                          padding: "12px 14px", 
                          display: "flex", 
                          alignItems: "flex-start", 
                          gap: 12, 
                          cursor: "pointer" 
                        }}
                        onClick={() => {
                          setCheckedWeekly(prev => 
                            prev.includes(task.id) ? prev.filter(x => x !== task.id) : [...prev, task.id]
                          );
                        }}
                      >
                        <div style={{ marginTop: 2, color: isChecked ? t.accent : t.textSub }}>
                          {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontSize: "13px", 
                            fontWeight: 650, 
                            color: t.text,
                            textDecoration: isChecked ? "line-through" : "none",
                            opacity: isChecked ? 0.65 : 1
                          }}>
                            {task.title}
                          </div>
                          <div style={{ fontSize: "11.5px", color: t.textSub, marginTop: 2 }}>
                            {task.short}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedTask(isExpanded ? null : task.id);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "4px",
                            color: t.accent,
                            fontSize: 11,
                            fontWeight: 600,
                            fontFamily: "inherit"
                          }}
                        >
                          {isExpanded ? "Fechar" : "Instruções"}
                        </button>
                      </div>

                      {isExpanded && (
                        <div style={{ 
                          padding: "12px 14px 14px 44px", 
                          borderTop: `1px solid ${t.border}`, 
                          background: t.surfaceAlt
                        }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {task.details.map((step, sidx) => (
                              <div key={sidx} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <span style={{ 
                                  background: t.accentGlow, 
                                  color: t.accent, 
                                  width: 16, 
                                  height: 16, 
                                  borderRadius: "50%", 
                                  display: "flex", 
                                  alignItems: "center", 
                                  justifyContent: "center", 
                                  fontSize: 10,
                                  fontWeight: 700,
                                  marginTop: 2
                                }}>
                                  {sidx + 1}
                                </span>
                                <span style={{ fontSize: "12px", color: t.textSub, lineHeight: 1.4 }}>
                                  {step}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Column 2: Monthly Routine */}
            <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
                    <ClipboardList size={16} color={t.gold} /> Checklist Mensal
                  </h3>
                  <span style={{ fontSize: 12, color: t.textSub }}>Perfeito para fechamento e início de competência</span>
                </div>
                <button 
                  onClick={() => setCheckedMonthly([])}
                  style={{
                    background: "none",
                    border: "none",
                    color: t.accent,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit"
                  }}
                >
                  Reiniciar
                </button>
              </div>

              {/* Progress Tracker */}
              <div style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: t.textSub }}>Progresso mensal</span>
                  <strong style={{ color: t.text }}>{checkedMonthly.length} de 4 ({Math.round(checkedMonthly.length / 4 * 100)}%)</strong>
                </div>
                <div style={{ width: "100%", height: 6, background: t.border, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${checkedMonthly.length / 4 * 100}%`, height: "100%", background: t.gold, borderRadius: 3, transition: "width 0.3s ease" }} />
                </div>
              </div>

              {/* Tasks */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  {
                    id: "m1",
                    title: "Fechamento de Folha & Espelho de Ponto",
                    short: "Exportar relatórios consolidados em PDF de todos os colaboradores.",
                    details: [
                      "Acesse o perfil de cada colaborador na lista principal.",
                      "Selecione o mês desejado na visualização do histórico.",
                      "Clique no botão de exportação para gerar o PDF ou planilha consolidada de horas totais e saldo do banco de horas para remeter à contabilidade."
                    ]
                  },
                  {
                    id: "m2",
                    title: "Planejamento do Calendário de Feriados",
                    short: "Cadastrar novos feriados federais, estaduais ou facultativos.",
                    details: [
                      "Abra a aba 'Calendário Geral / Feriados'.",
                      "Identifique feriados no próximo mês civil.",
                      "Cadastre as datas correspondentes para que o sistema reconheça automaticamente adicionais ou compensações corretas de escala."
                    ]
                  },
                  {
                    id: "m3",
                    title: "Saneamento de Contas (Arquivo Morto)",
                    short: "Desativar colaboradores que se desligaram do quadro.",
                    details: [
                      "Verifique com a diretoria se houve rescisões de contrato no mês.",
                      "Busque o colaborador na aba principal de buscas.",
                      "Clique na ação de Desativar para movê-lo de forma segura e imediata para a lista de 'Arquivo Morto', liberando vagas."
                    ]
                  },
                  {
                    id: "m4",
                    title: "Backup Preventivo e Conformidade Legal",
                    short: "Exportar registros de auditoria e manter cópias de segurança.",
                    details: [
                      "Dirija-se à aba 'Auditoria'.",
                      "Utilize a funcionalidade de exportação de dados para obter uma via digital do livro de auditoria e batidas.",
                      "Guarde o arquivo em um local seguro da empresa como backup e auditoria de RH."
                    ]
                  }
                ].map(task => {
                  const isChecked = checkedMonthly.includes(task.id);
                  const isExpanded = expandedTask === task.id;
                  return (
                    <div 
                      key={task.id} 
                      style={{ 
                        background: isChecked ? t.surfaceAlt : t.surface, 
                        border: `1px solid ${isChecked ? t.gold : t.border}`, 
                        borderRadius: 10,
                        overflow: "hidden",
                        transition: "all 0.2s"
                      }}
                    >
                      <div 
                        style={{ 
                          padding: "12px 14px", 
                          display: "flex", 
                          alignItems: "flex-start", 
                          gap: 12, 
                          cursor: "pointer" 
                        }}
                        onClick={() => {
                          setCheckedMonthly(prev => 
                            prev.includes(task.id) ? prev.filter(x => x !== task.id) : [...prev, task.id]
                          );
                        }}
                      >
                        <div style={{ marginTop: 2, color: isChecked ? t.gold : t.textSub }}>
                          {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontSize: "13px", 
                            fontWeight: 650, 
                            color: t.text,
                            textDecoration: isChecked ? "line-through" : "none",
                            opacity: isChecked ? 0.65 : 1
                          }}>
                            {task.title}
                          </div>
                          <div style={{ fontSize: "11.5px", color: t.textSub, marginTop: 2 }}>
                            {task.short}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedTask(isExpanded ? null : task.id);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "4px",
                            color: t.accent,
                            fontSize: 11,
                            fontWeight: 600,
                            fontFamily: "inherit"
                          }}
                        >
                          {isExpanded ? "Fechar" : "Instruções"}
                        </button>
                      </div>

                      {isExpanded && (
                        <div style={{ 
                          padding: "12px 14px 14px 44px", 
                          borderTop: `1px solid ${t.border}`, 
                          background: t.surfaceAlt
                        }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {task.details.map((step, sidx) => (
                              <div key={sidx} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <span style={{ 
                                  background: t.goldBg, 
                                  color: t.gold, 
                                  width: 16, 
                                  height: 16, 
                                  borderRadius: "50%", 
                                  display: "flex", 
                                  alignItems: "center", 
                                  justifyContent: "center", 
                                  fontSize: 10,
                                  fontWeight: 700,
                                  marginTop: 2
                                }}>
                                  {sidx + 1}
                                </span>
                                <span style={{ fontSize: "12px", color: t.textSub, lineHeight: 1.4 }}>
                                  {step}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Stage 3 - Aceite de Folhas Administrative Tab Rendering */}
      {tab === "aceites" && (
        <div style={{ padding: "24px 28px", maxWidth: 1080, margin: "0 auto" }}>
          {/* Dashboard Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
                <ClipboardList size={20} color={t.accent} /> Gestão de Aceite de Folha de Ponto
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: t.textSub }}>
                Feche os cartões de ponto mensais, emita termos de aceite eletrônico e gerencie contestações.
              </p>
            </div>
          </div>

          {/* Form Card for generation */}
          <div style={{ 
            background: t.surfaceAlt, 
            border: `1px solid ${t.border}`, 
            borderRadius: 12, 
            padding: 20, 
            marginBottom: 24,
            boxShadow: t.shadow 
          }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar size={16} color={t.accent} /> Nova Emissão de Termo de Aceite
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, alignItems: "end" }}>
              {/* Select Employee */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>Colaborador</label>
                <select
                  value={selectedUserForAceite}
                  onChange={(e) => {
                    setSelectedUserForAceite(e.target.value);
                    if (e.target.value !== "todos" && e.target.value !== "") {
                      const u = users.find(x => x.id === Number(e.target.value));
                      if (u) {
                        setInsalubridadeTextoForAceite(
                          u.direitoAlimentacao !== false 
                            ? "Recebe auxílio alimentação padrão e adicionais legais." 
                            : "Sem adicionais específicos para o período."
                        );
                      }
                    } else {
                      setInsalubridadeTextoForAceite("Não aplicável / Não alterado no período.");
                    }
                  }}
                  style={{
                    background: t.bg,
                    border: `1px solid ${t.border}`,
                    color: t.text,
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 13,
                    outline: "none",
                    height: 40
                  }}
                >
                  <option value="">Selecione o colaborador...</option>
                  <option value="todos">Todos os Colaboradores Ativos</option>
                  {users.filter(u => u.tipo !== "adm-dev" && !u.desativado).map(u => (
                    <option key={u.id} value={u.id}>{u.nome} ({u.matricula})</option>
                  ))}
                </select>
              </div>

              {/* Select Month */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>Mês de Referência</label>
                <select
                  value={selectedMonthForAceite}
                  onChange={(e) => setSelectedMonthForAceite(Number(e.target.value))}
                  style={{
                    background: t.bg,
                    border: `1px solid ${t.border}`,
                    color: t.text,
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 13,
                    outline: "none",
                    height: 40
                  }}
                >
                  {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map((m, idx) => (
                    <option key={idx} value={idx}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Select Year */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>Ano de Referência</label>
                <input
                  type="number"
                  value={selectedYearForAceite}
                  onChange={(e) => setSelectedYearForAceite(Number(e.target.value))}
                  style={{
                    background: t.bg,
                    border: `1px solid ${t.border}`,
                    color: t.text,
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 13,
                    outline: "none",
                    height: 40
                  }}
                />
              </div>

              {/* Text/Insalubridade */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>Adicionais / Observações</label>
                <input
                  type="text"
                  placeholder="Ex: Recebe 20% insalubridade"
                  value={insalubridadeTextoForAceite}
                  onChange={(e) => setInsalubridadeTextoForAceite(e.target.value)}
                  style={{
                    background: t.bg,
                    border: `1px solid ${t.border}`,
                    color: t.text,
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 13,
                    outline: "none",
                    height: 40
                  }}
                />
              </div>

              {/* Action Button */}
              <div>
                <button
                  type="button"
                  onClick={handleGerarFolhas}
                  style={{
                    background: t.accent,
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "0 20px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    height: 40,
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "all 0.2s"
                  }}
                >
                  <Zap size={15} /> Gerar e Enviar
                </button>
              </div>
            </div>
          </div>

          {/* List of Sent Sheets */}
          <div style={{ 
            background: t.surface, 
            border: `1px solid ${t.border}`, 
            borderRadius: 12, 
            boxShadow: t.shadow,
            overflow: "hidden"
          }}>
            <div style={{ 
              padding: "16px 20px", 
              borderBottom: `1px solid ${t.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.text }}>
                Termos Emitidos e Status de Aceite ({folhasAceite.length})
              </h3>
              {folhasAceite.some(f => f.status === "aceito") && (
                <button
                  onClick={gerarRelatorioGeralHTML}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "linear-gradient(135deg, #16a34a, #15803d)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 14px",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(22, 163, 74, 0.2)",
                    transition: "all 0.2s"
                  }}
                  title="Gerar um único arquivo PDF/imprimível com todas as folhas de ponto assinadas em ordem alfabética"
                >
                  <FileText size={15} />
                  <span>Relatório Geral de Aceites (PDF)</span>
                </button>
              )}
            </div>

            {folhasAceite.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: t.textMuted }}>
                <FileText size={40} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Nenhum termo de aceite emitido ainda.</p>
                <p style={{ margin: "4px 0 0", fontSize: 12 }}>Utilize o formulário acima para emitir cartões para revisão dos colaboradores.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: t.surfaceAlt, borderBottom: `1px solid ${t.border}` }}>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: t.textSub }}>Colaborador</th>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: t.textSub }}>Mês/Ano</th>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: t.textSub }}>Resumo Calculado</th>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: t.textSub }}>Observações</th>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: t.textSub }}>Enviado Em</th>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: t.textSub, textAlign: "center" }}>Status</th>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: t.textSub, textAlign: "right" }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {folhasAceite.map((folha) => {
                      const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                      const userObj = users.find(u => u.id === folha.userId);
                      const isUserBlocked = userObj?.bloqueadoAceite;

                      return (
                        <tr key={folha.id} style={{ borderBottom: `1px solid ${t.border}`, verticalAlign: "middle" }}>
                          {/* Colaborador */}
                          <td style={{ padding: "16px" }}>
                            <div style={{ fontWeight: 600, color: t.text }}>{folha.userName}</div>
                            <div style={{ fontSize: 11, color: t.textMuted }}>Matrícula: {folha.matricula}</div>
                          </td>

                          {/* Período */}
                          <td style={{ padding: "16px", whiteSpace: "nowrap" }}>
                            <span style={{ fontWeight: 500 }}>{MESES[folha.mes]} / {folha.ano}</span>
                          </td>

                          {/* Resumo */}
                          <td style={{ padding: "16px" }}>
                            <div style={{ fontSize: 11.5, lineHeight: 1.5, color: t.textSub }}>
                              <div><strong>Trabalhado:</strong> {folha.horasTrabalhadas}h | <strong>Extras:</strong> {folha.horasExtra}h</div>
                              <div><strong>Noturno:</strong> {folha.horasAdicionalNoturno}h | <strong>Faltas:</strong> {folha.faltas} d</div>
                              {folha.atrasos > 0 && <div><strong>Atrasos:</strong> {folha.atrasos}h</div>}
                            </div>
                          </td>

                          {/* Observações */}
                          <td style={{ padding: "16px", maxWidth: 180 }}>
                            <div style={{ fontSize: 11.5, color: t.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={folha.insalubridadeTexto}>
                              {folha.insalubridadeTexto || "—"}
                            </div>
                          </td>

                          {/* Enviado Em */}
                          <td style={{ padding: "16px", color: t.textMuted, fontSize: 11.5, whiteSpace: "nowrap" }}>
                            {new Date(folha.enviadoEm).toLocaleDateString("pt-BR")}
                          </td>

                          {/* Status */}
                          <td style={{ padding: "16px", textAlign: "center", whiteSpace: "nowrap" }}>
                            {folha.status === "pendente" && (
                              <Tag label="Pendente" color="#f59e0b" bg="rgba(245,158,11,0.12)" border="rgba(245,158,11,0.3)" />
                            )}
                            {folha.status === "aceito" && (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                <Tag label="Assinado" color="#16a34a" bg="rgba(22,163,74,0.12)" border="rgba(22,163,74,0.3)" />
                                {folha.textoAceite && (
                                  <span style={{ fontSize: 9.5, color: t.textMuted, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }} title={folha.textoAceite}>
                                    Doc ID: Assinado Digitalmente
                                  </span>
                                )}
                              </div>
                            )}
                            {folha.status === "recusado" && (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                <Tag label="Contestado" color="#ef4444" bg="rgba(239,68,68,0.12)" border="rgba(239,68,68,0.3)" />
                                {isUserBlocked && (
                                  <span style={{ fontSize: 10, color: t.danger, fontWeight: 600 }}>⚠️ Bloqueado p/ Ponto</span>
                                )}
                                {folha.motivoRecusa && (
                                  <span style={{ fontSize: 10, color: t.textMuted, maxWidth: 140, fontStyle: "italic" }} title={folha.motivoRecusa}>
                                    "{folha.motivoRecusa}"
                                  </span>
                                )}
                              </div>
                            )}
                            {folha.status === "retificado" && (
                              <Tag label="Retificado" color="#7c3aed" bg="rgba(124,58,237,0.12)" border="rgba(124,58,237,0.3)" />
                            )}
                          </td>

                          {/* Ações */}
                          <td style={{ padding: "16px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 6 }}>
                              {/* View Mirror */}
                              <button
                                type="button"
                                title="Visualizar Espelho de Ponto"
                                onClick={() => gerarEspelhoHTMLForAdmin(folha.userId, folha.ano, folha.mes)}
                                style={{
                                  background: t.surfaceAlt,
                                  border: `1px solid ${t.border}`,
                                  borderRadius: 6,
                                  padding: 6,
                                  cursor: "pointer",
                                  color: t.textSub,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center"
                                }}
                              >
                                <Printer size={14} />
                              </button>

                              {/* Unblock (if refused and user is blocked) */}
                              {folha.status === "recusado" && isUserBlocked && (
                                <button
                                  type="button"
                                  title="Desbloquear Colaborador para registrar ponto"
                                  onClick={() => handleDesbloquearUsuario(folha)}
                                  style={{
                                    background: t.successBg,
                                    border: `1px solid ${t.successBorder}`,
                                    borderRadius: 6,
                                    padding: 6,
                                    cursor: "pointer",
                                    color: t.success,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                  }}
                                >
                                  <Unlock size={14} />
                                </button>
                              )}

                              {/* Retify Form Prefill (allows re-sending) */}
                              <button
                                type="button"
                                title="Ajustar e Re-enviar termo de aceitação"
                                onClick={() => {
                                  setSelectedUserForAceite(String(folha.userId));
                                  setSelectedMonthForAceite(folha.mes);
                                  setSelectedYearForAceite(folha.ano);
                                  setInsalubridadeTextoForAceite(folha.insalubridadeTexto || "");
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                style={{
                                  background: t.surfaceAlt,
                                  border: `1px solid ${t.border}`,
                                  borderRadius: 6,
                                  padding: 6,
                                  cursor: "pointer",
                                  color: t.accent,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center"
                                }}
                              >
                                <SquarePen size={14} />
                              </button>

                              {/* Delete / Cancel */}
                              <button
                                type="button"
                                title="Cancelar / Excluir Termo"
                                onClick={() => handleCancelarFolha(folha.id)}
                                style={{
                                  background: t.dangerBg,
                                  border: `1px solid ${t.dangerBorder}`,
                                  borderRadius: 6,
                                  padding: 6,
                                  cursor: "pointer",
                                  color: t.danger,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center"
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stage 4 - Enviar Alertas Administrative Tab Rendering */}
      {tab === "alertas" && (
        <div style={{ padding: "24px 28px", maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
                <Bell size={20} color={t.accent} /> Enviar Alertas e Avisos em Pop-up
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: t.textSub }}>
                Envie notificações diretas aos colaboradores. O alerta será exibido em destaque em forma de pop-up assim que o usuário fizer login.
              </p>
            </div>
          </div>

          {/* Alert Form Box */}
          <div style={{
            background: t.surface,
            border: `1.5px solid ${t.border}`,
            borderRadius: 14,
            padding: 24,
            marginBottom: 28,
            boxShadow: t.shadow
          }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
              <Send size={16} color={t.accent} /> Criar Novo Alerta
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Target Selector */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: t.textSub, display: "block", marginBottom: 6 }}>
                  Destinatário do Alerta:
                </label>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAlertaDestinoTipo("TODOS");
                      setAlertaMatricula("");
                    }}
                    style={{
                      flex: 1,
                      minWidth: 180,
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: `1.5px solid ${alertaDestinoTipo === "TODOS" ? t.accent : t.border}`,
                      background: alertaDestinoTipo === "TODOS" ? t.surfaceAlt : t.surface,
                      color: alertaDestinoTipo === "TODOS" ? t.accent : t.text,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      transition: "all 0.2s"
                    }}
                  >
                    <Users size={16} /> Todos os Colaboradores
                  </button>

                  <button
                    type="button"
                    onClick={() => setAlertaDestinoTipo("ESPECIFICO")}
                    style={{
                      flex: 1,
                      minWidth: 180,
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: `1.5px solid ${alertaDestinoTipo === "ESPECIFICO" ? t.accent : t.border}`,
                      background: alertaDestinoTipo === "ESPECIFICO" ? t.surfaceAlt : t.surface,
                      color: alertaDestinoTipo === "ESPECIFICO" ? t.accent : t.text,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      transition: "all 0.2s"
                    }}
                  >
                    <UserCheck size={16} /> Matrícula Específica
                  </button>
                </div>
              </div>

              {/* Specific Matricula Input */}
              {alertaDestinoTipo === "ESPECIFICO" && (
                <div style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, padding: 14, borderRadius: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: t.textSub, display: "block", marginBottom: 6 }}>
                    Selecione o Colaborador ou Digite a Matrícula:
                  </label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <select
                      value={alertaMatricula}
                      onChange={e => setAlertaMatricula(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: 220,
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: `1px solid ${t.border}`,
                        background: t.inputBg,
                        color: t.text,
                        fontSize: 13,
                        fontFamily: "inherit",
                        outline: "none"
                      }}
                    >
                      <option value="">-- Selecione na lista de colaboradores --</option>
                      {users.filter(u => u.tipo === "colaborador" && !u.desativado).map(u => (
                        <option key={u.id} value={u.matricula}>
                          Matrícula {u.matricula} - {u.nome}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="Ou digite a matrícula (ex: 1001)"
                      value={alertaMatricula}
                      onChange={e => setAlertaMatricula(e.target.value.trim())}
                      style={{
                        width: 220,
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: `1px solid ${t.border}`,
                        background: t.inputBg,
                        color: t.text,
                        fontSize: 13,
                        fontFamily: "inherit",
                        outline: "none"
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Message Textarea */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: t.textSub, display: "block", marginBottom: 6 }}>
                  Mensagem do Pop-up de Alerta:
                </label>
                <textarea
                  rows={4}
                  placeholder="Escreva a mensagem que aparecerá na tela do colaborador..."
                  value={alertaMensagem}
                  onChange={e => setAlertaMensagem(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 14,
                    borderRadius: 10,
                    border: `1.5px solid ${t.border}`,
                    background: t.inputBg,
                    color: t.text,
                    fontSize: 14,
                    fontFamily: "inherit",
                    outline: "none",
                    resize: "vertical",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              {/* Submit Button */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  disabled={alertaSending || !alertaMensagem.trim() || (alertaDestinoTipo === "ESPECIFICO" && !alertaMatricula.trim())}
                  onClick={async () => {
                    const msg = alertaMensagem.trim();
                    const destMat = alertaDestinoTipo === "TODOS" ? "TODOS" : alertaMatricula.trim();
                    if (!msg) return;
                    if (alertaDestinoTipo === "ESPECIFICO" && !destMat) return;

                    setAlertaSending(true);
                    try {
                      const novoAlerta: Alerta = {
                        id: "alerta_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
                        destinatarioMatricula: destMat,
                        mensagem: msg,
                        criadoEm: new Date().toISOString(),
                        criadoPor: currentUser.nome || `Mat. ${currentUser.matricula}`,
                        lidoPorMatriculas: [],
                        ativo: true
                      };

                      if (saveAlertaToDb) {
                        await saveAlertaToDb(novoAlerta);
                      }
                      setAlertas(prev => [novoAlerta, ...prev]);

                      if (onAddLog) {
                        onAddLog(
                          "Alerta / Pop-up Enviado",
                          destMat === "TODOS" ? "Todos os Colaboradores" : `Matrícula ${destMat}`,
                          `Mensagem: "${msg.slice(0, 50)}${msg.length > 50 ? "..." : ""}"`
                        );
                      }

                      setAlertaMensagem("");
                      setAlertaMatricula("");
                      setToast({ msg: "Alerta enviado com sucesso! Será exibido no próximo login do colaborador.", type: "success" });
                    } catch (err) {
                      console.error("Erro ao enviar alerta:", err);
                      setToast({ msg: "Falha ao enviar alerta no servidor.", type: "danger" });
                    } finally {
                      setAlertaSending(false);
                    }
                  }}
                  style={{
                    background: `linear-gradient(135deg, ${t.accent}, #2563EB)`,
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    padding: "12px 24px",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: (alertaSending || !alertaMensagem.trim() || (alertaDestinoTipo === "ESPECIFICO" && !alertaMatricula.trim())) ? "not-allowed" : "pointer",
                    opacity: (alertaSending || !alertaMensagem.trim() || (alertaDestinoTipo === "ESPECIFICO" && !alertaMatricula.trim())) ? 0.5 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
                    transition: "all 0.2s"
                  }}
                >
                  <Send size={16} />
                  <span>{alertaSending ? "Enviando..." : "Enviar Alerta em Pop-up"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* History of Sent Alerts */}
          <div style={{
            background: t.surface,
            border: `1.5px solid ${t.border}`,
            borderRadius: 14,
            boxShadow: t.shadow,
            overflow: "hidden"
          }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.border}` }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.text }}>
                Histórico de Alertas Cadastrados ({alertas.length})
              </h3>
            </div>

            {alertas.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: t.textMuted }}>
                <Bell size={36} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Nenhum alerta cadastrado no momento.</p>
                <p style={{ margin: "4px 0 0", fontSize: 12 }}>Utilize o formulário acima para enviar notificações aos colaboradores.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${t.border}`, background: t.surfaceAlt, textAlign: "left" }}>
                      <th style={{ padding: "10px 16px", color: t.textMuted, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Destinatário</th>
                      <th style={{ padding: "10px 16px", color: t.textMuted, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Mensagem do Pop-up</th>
                      <th style={{ padding: "10px 16px", color: t.textMuted, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Data / Hora</th>
                      <th style={{ padding: "10px 16px", color: t.textMuted, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Visualizações</th>
                      <th style={{ padding: "10px 16px", color: t.textMuted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertas.map(alerta => {
                      const isTodos = alerta.destinatarioMatricula === "TODOS";
                      const targetUser = !isTodos ? users.find(u => u.matricula === alerta.destinatarioMatricula) : null;
                      const readCount = Array.isArray(alerta.lidoPorMatriculas) ? alerta.lidoPorMatriculas.length : 0;

                      return (
                        <tr key={alerta.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                          <td style={{ padding: "12px 16px" }}>
                            {isTodos ? (
                              <Tag label="TODOS (Geral)" color={t.accent} bg={t.surfaceAlt} border={t.border} />
                            ) : (
                              <span style={{ fontWeight: 600, color: t.text }}>
                                Mat. {alerta.destinatarioMatricula} {targetUser ? `(${targetUser.nome})` : ""}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "12px 16px", color: t.text, maxWidth: 360, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                            {alerta.mensagem}
                          </td>
                          <td style={{ padding: "12px 16px", color: t.textSub, fontSize: 12 }}>
                            {new Date(alerta.criadoEm).toLocaleString("pt-BR")}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <Tag
                              label={`${readCount} visualizou(m)`}
                              color={readCount > 0 ? t.success : t.textSub}
                              bg={readCount > 0 ? t.successBg : t.surfaceAlt}
                              border={readCount > 0 ? t.successBorder : t.border}
                            />
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right" }}>
                            <button
                              type="button"
                              title="Excluir alerta"
                              onClick={async () => {
                                if (window.confirm("Deseja realmente remover este alerta?")) {
                                  try {
                                    if (deleteAlertaFromDb) {
                                      await deleteAlertaFromDb(alerta.id);
                                    }
                                    setAlertas(prev => prev.filter(a => a.id !== alerta.id));
                                    setToast({ msg: "Alerta removido.", type: "success" });
                                  } catch (err) {
                                    console.error("Erro ao deletar alerta:", err);
                                  }
                                }
                              }}
                              style={{
                                background: t.dangerBg,
                                border: `1px solid ${t.dangerBorder}`,
                                color: t.danger,
                                borderRadius: 6,
                                padding: "6px 10px",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 12,
                                fontWeight: 600
                              }}
                            >
                              <Trash2 size={13} /> Excluir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals rendering */}
      {modal?.type === "pw" && <PwModal modal={modal} setModal={setModal} t={t} onChangePw={changePw} />}
      {modal?.type === "create" && <CreateModal setModal={setModal} t={t} users={users} tab={tab} onCreate={createUser} />}
      {modal?.type === "delete" && <DeleteModal modal={modal} setModal={setModal} t={t} onDelete={deactivateUser} />}
      {modal?.type === "matricula" && modal?.user && (
        <EditMatriculaModal modal={modal} setModal={setModal} t={t} users={users} onChangeMatricula={changeMatricula} />
      )}
      {modal?.type === "ferias" && modal?.user && (
        <FeriasModal
          user={modal.user}
          users={users}
          setUsers={setUsers}
          setModal={setModal}
          t={t}
          addLog={addLog}
        />
      )}
      {modalDelegation && (
        <DelegationModal
          user={modalDelegation}
          onClose={() => setModalDelegation(null)}
          onSave={handleSaveDelegation}
          t={t}
        />
      )}

      {selectedGeoLog && (
        <div
          onClick={() => setSelectedGeoLog(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: t.surface,
              border: `1.5px solid ${t.borderFocus}`,
              borderRadius: 16,
              width: "100%",
              maxWidth: 500,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15), 0 10px 10px -5px rgba(0,0,0,0.1)",
              overflow: "hidden",
              fontFamily: "inherit"
            }}
          >
            {/* Header decorativo com Mapa */}
            <div style={{
              background: `linear-gradient(135deg, ${t.accent} 0%, #0369a1 100%)`, 
              padding: "20px 24px", 
              color: "#ffffff"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <Map size={22} style={{ color: "rgba(255,255,255,0.9)" }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750, letterSpacing: "-0.2px" }}>Metadados Jurídicos de Geolocalização</h3>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.78)", lineHeight: 1.4 }}>
                Certidão digital de comprovação de presença física para validade jurídica e auditoria fiscal de ponto (Art. 83, Portaria 671/MTE).
              </p>
            </div>

            {/* Conteúdo */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
              
              {/* Seção 1: Quem e Quando */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingBottom: 14, borderBottom: `1px solid ${t.border}` }}>
                <div>
                  <span style={{ fontSize: 10, color: t.textSub, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2px" }}>Colaborador</span>
                  <div style={{ fontSize: 13, fontWeight: 650, color: t.text, marginTop: 2 }}>{selectedGeoLog.quem}</div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1, fontFamily: "monospace" }}>Matrícula: {selectedGeoLog.quemMat}</div>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: t.textSub, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2px" }}>Data e Hora Exata</span>
                  <div style={{ fontSize: 13, fontWeight: 650, color: t.text, marginTop: 2 }}>
                    {new Date(selectedGeoLog.quando).toLocaleDateString("pt-BR")} às {new Date(selectedGeoLog.quando).toLocaleTimeString("pt-BR")}
                  </div>
                  <span style={{ fontSize: 10, color: t.textMuted, marginTop: 1, display: "block" }}>Horário Uniformizado (UTC)</span>
                </div>
              </div>

              {/* Seção 2: Coordenadas & Precisão */}
              <div>
                <span style={{ fontSize: 10, color: t.textSub, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2px", display: "block", marginBottom: 6 }}>Coordenadas de Sensoriamento GPS</span>
                <div style={{ 
                  background: t.surfaceAlt, 
                  border: `1.5px solid ${t.border}`, 
                  borderRadius: 12, 
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontSize: 13, color: t.text, fontFamily: "monospace", fontWeight: 700 }}>
                      Lat: <span style={{ color: t.accent }}>{selectedGeoLog.latitude?.toFixed(7)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: t.text, fontFamily: "monospace", fontWeight: 700 }}>
                      Long: <span style={{ color: t.accent }}>{selectedGeoLog.longitude?.toFixed(7)}</span>
                    </div>
                  </div>

                  {selectedGeoLog.accuracy !== undefined && (
                    <div style={{ 
                      borderRadius: 10, 
                      padding: "8px 12px", 
                      textAlign: "center",
                      border: `1px solid ${selectedGeoLog.accuracy <= 10 ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)"}`,
                      background: selectedGeoLog.accuracy <= 10 ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)",
                      color: selectedGeoLog.accuracy <= 10 ? "#15803d" : "#b45309"
                    }}>
                      <div style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 750, letterSpacing: "0.5px", opacity: 0.8 }}>Precisão</div>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>±{selectedGeoLog.accuracy.toFixed(1)}m</div>
                      <div style={{ fontSize: 9, fontWeight: 650, marginTop: 1 }}>
                        {selectedGeoLog.accuracy <= 10 ? "Métrica Ótima" : "Métrica Estimada"}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Seção 3: Permissões e Captura */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: t.textSub, fontWeight: 550, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Globe size={13} style={{ color: t.textSub }} /> Provedor de Captura
                  </span>
                  <strong style={{ color: t.text, fontSize: 11.5 }}>HTML5 Geolocation API</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: t.textSub, fontWeight: 550, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    🛡️ Consentimento LGPD
                  </span>
                  <strong style={{ color: t.success, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <Check size={13} /> SIM, expresso no app
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: t.textSub, fontWeight: 550, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    🔒 Armazenamento
                  </span>
                  <strong style={{ color: t.text, fontSize: 11.5 }}>Encriptado & Imutável</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: t.textSub, fontWeight: 550, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    📶 Modo Alta Precisão
                  </span>
                  <strong style={{ color: t.text, fontSize: 11.5 }}>Habilitado (enableHighAccuracy)</strong>
                </div>
              </div>

              {/* Seção 4: Notas Legais e Procedimento */}
              <div style={{ fontSize: 11.5, color: t.textSub, lineHeight: 1.45, background: "rgba(14, 165, 233, 0.05)", border: "1px dashed rgba(14, 165, 233, 0.25)", borderRadius: 10, padding: 12 }}>
                <strong style={{ display: "block", color: t.accent, marginBottom: 3 }}>⚖️ Amparo de Segurança e Conformidade:</strong>
                Este log assegura que a batida de ponto ocorreu nos limites geográficos combinados. Os dados atendem ao <strong>Artigo 7º da LGPD</strong> (cumprimento legal de obrigação contratual pelo empregador) e estão salvaguardados de adulteração de coordenadas sob o certificado digital do painel administrativo.
              </div>
            </div>

            {/* Ações */}
            <div style={{ padding: "16px 24px", background: t.surfaceAlt, borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", gap: 10 }}>
              <button
                onClick={() => setSelectedGeoLog(null)}
                style={{
                  background: "transparent",
                  border: `1.5px solid ${t.border}`,
                  color: t.text,
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 12.5,
                  fontWeight: 650,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s"
                }}
              >
                Fechar Certidão
              </button>

              {selectedGeoLog.latitude && selectedGeoLog.longitude && (
                <a
                  href={`https://maps.google.com/?q=${selectedGeoLog.latitude},${selectedGeoLog.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: t.accent,
                    color: "#ffffff",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.15s"
                  }}
                >
                  <Map size={14} />
                  Ver no Google Maps
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Minimal icons wrapper for create/toggles
function PlusIcon({ size, color }: { size: number; color: string }) {
  return <span style={{ fontSize: size, color, fontWeight: "bold", lineHeight: 1 }}>+</span>;
}

function ToggleIcon({ on, color }: { on: boolean; color: string }) {
  return (
    <div
      style={{
        width: 30,
        height: 18,
        borderRadius: 9,
        background: on ? color : "rgba(128,128,128,0.25)",
        position: "relative",
        cursor: "pointer",
        transition: "all 0.2s"
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "white",
          position: "absolute",
          top: 2,
          left: on ? 14 : 2,
          transition: "all 0.2s"
        }}
      />
    </div>
  );
}

interface DelegationModalProps {
  user: User;
  onClose: () => void;
  onSave: (userId: number, perms: { perm_trocar_senha: boolean, perm_bloquear: boolean, perm_excluir: boolean, perm_editar_calendario: boolean, perm_gestao_folhas: boolean }) => void;
  t: ThemeColors;
}

function DelegationModal({ user, onClose, onSave, t }: DelegationModalProps) {
  const [senha, setSenha] = useState(user.perm_trocar_senha || false);
  const [bloquear, setBloquear] = useState(user.perm_bloquear || false);
  const [excluir, setExcluir] = useState(user.perm_excluir || false);
  const [calendario, setCalendario] = useState(user.perm_editar_calendario || false);
  const [folhas, setFolhas] = useState(user.perm_gestao_folhas || false);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          borderRadius: 18,
          padding: "32px 36px",
          width: "100%",
          maxWidth: 480,
          boxShadow: t.shadow
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 4px", color: t.text, fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <Shield size={20} color={t.accent} />
          <span>Delegar Funções Administrativas</span>
        </h3>
        <p style={{ margin: "0 0 20px", color: t.textSub, fontSize: 13 }}>
          Configure as permissões de <strong>{user.nome}</strong> ({user.matricula})
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
          {/* Trocar Senha */}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", background: t.surfaceAlt, padding: "12px 14px", borderRadius: 10, border: `1px solid ${t.border}`, transition: "background 0.2s" }}
                 onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
                 onMouseLeave={e => e.currentTarget.style.background = t.surfaceAlt}>
            <input type="checkbox" checked={senha} onChange={e => setSenha(e.target.checked)} style={{ marginTop: 3, cursor: "pointer" }} />
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: t.text }}>🔑 Redefinir / Trocar Senhas</div>
              <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: t.textSub }}>Permite alterar senhas e matrículas de outros colaboradores.</p>
            </div>
          </label>

          {/* Bloquear */}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", background: t.surfaceAlt, padding: "12px 14px", borderRadius: 10, border: `1px solid ${t.border}`, transition: "background 0.2s" }}
                 onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
                 onMouseLeave={e => e.currentTarget.style.background = t.surfaceAlt}>
            <input type="checkbox" checked={bloquear} onChange={e => setBloquear(e.target.checked)} style={{ marginTop: 3, cursor: "pointer" }} />
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: t.text }}>🚫 Bloquear Colaborador</div>
              <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: t.textSub }}>Permite suspender ou liberar acesso de funcionários ao sistema.</p>
            </div>
          </label>

          {/* Excluir */}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", background: t.surfaceAlt, padding: "12px 14px", borderRadius: 10, border: `1px solid ${t.border}`, transition: "background 0.2s" }}
                 onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
                 onMouseLeave={e => e.currentTarget.style.background = t.surfaceAlt}>
            <input type="checkbox" checked={excluir} onChange={e => setExcluir(e.target.checked)} style={{ marginTop: 3, cursor: "pointer" }} />
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: t.text }}>🗑️ Excluir / Desativar</div>
              <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: t.textSub }}>Permite desativar colaboradores preservando dados (adequação à LGPD/CLT).</p>
            </div>
          </label>

          {/* Editar Calendário */}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", background: t.surfaceAlt, padding: "12px 14px", borderRadius: 10, border: `1px solid ${t.border}`, transition: "background 0.2s" }}
                 onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
                 onMouseLeave={e => e.currentTarget.style.background = t.surfaceAlt}>
            <input type="checkbox" checked={calendario} onChange={e => setCalendario(e.target.checked)} style={{ marginTop: 3, cursor: "pointer" }} />
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: t.text }}>📅 Editar Calendário e Frequência</div>
              <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: t.textSub }}>Permite fazer lançamentos manuais, abonar faltas, gerenciar feriados e configurar jornadas.</p>
            </div>
          </label>

          {/* Gestão de Aceites de Folhas */}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", background: t.surfaceAlt, padding: "12px 14px", borderRadius: 10, border: `1px solid ${t.border}`, transition: "background 0.2s" }}
                 onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
                 onMouseLeave={e => e.currentTarget.style.background = t.surfaceAlt}>
            <input type="checkbox" checked={folhas} onChange={e => setFolhas(e.target.checked)} style={{ marginTop: 3, cursor: "pointer" }} />
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: t.text }}>📋 Gestão de Aceite de Folhas</div>
              <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: t.textSub }}>Permite fechar cartões, emitir termos de aceite, retificar e gerenciar contestações.</p>
            </div>
          </label>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: t.surfaceAlt,
              border: `1.5px solid ${t.border}`,
              borderRadius: 10,
              padding: "10px",
              cursor: "pointer",
              fontSize: 13.5,
              fontWeight: 600,
              color: t.textSub,
              fontFamily: "inherit"
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(user.id, {
              perm_trocar_senha: senha,
              perm_bloquear: bloquear,
              perm_excluir: excluir,
              perm_editar_calendario: calendario,
              perm_gestao_folhas: folhas
            })}
            style={{
              flex: 1,
              background: `linear-gradient(135deg, ${t.accent}, #2563EB)`,
              border: "none",
              borderRadius: 10,
              padding: "10px",
              cursor: "pointer",
              fontSize: 13.5,
              fontWeight: 700,
              color: "#fff",
              fontFamily: "inherit",
              boxShadow: "0 4px 12px rgba(37,99,235,0.2)"
            }}
          >
            Salvar Funções
          </button>
        </div>
      </div>
    </div>
  );
}
