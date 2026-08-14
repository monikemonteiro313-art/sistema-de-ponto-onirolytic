import React, { useState, useMemo, useEffect } from "react";
import { Search, Calendar, Clock, ShieldCheck, MapPin, Edit3, Info, Eye, History, AlertTriangle, ChevronLeft, ChevronRight, CheckCircle2, Camera, CalendarRange } from "lucide-react";
import { ThemeColors, User, PontosGlobal, Batida, DiaPontos, AuditLogEntry, FolgaRemunerada } from "../types";
import { calcularDia, resumoMesCalculado } from "../utils/hrHelpers";
import { getJornada } from "../data/mockData";
import { getFotoForPunchSlot } from "../utils/photoHelper";

interface GerenciarMarcacoesViewProps {
  t: ThemeColors;
  users: User[];
  currentUser: User;
  pontosGlobal: PontosGlobal;
  setPontosGlobal?: React.Dispatch<React.SetStateAction<PontosGlobal>>;
  auditLogs: AuditLogEntry[];
  onSalvarPonto: (userId: number, dayKey: string, batidaIdx: number, novaHora: string, justificativa: string) => Promise<void>;
  onDecisaoAtestado?: (userId: number, groupId: string, dias: {dayKey: string, slotIdx: number}[], decisao: "aceito" | "recusado" | "excluir", justificativa: string) => Promise<void>;
  feriados?: string[];
  folgasRemuneradas?: FolgaRemunerada[];
  minimoHorasDia?: number;
  onAddLog?: (acao: string, alvo: string, detalhe?: string) => void;
}

const SLOT_NAMES = ["Entrada 1", "Saída 1 (Almoço)", "Entrada 2 (Retorno)", "Saída 2"];

export function GerenciarMarcacoesView({
  t,
  users = [],
  currentUser,
  pontosGlobal = {},
  setPontosGlobal,
  auditLogs = [],
  onSalvarPonto,
  onDecisaoAtestado,
  feriados = [],
  folgasRemuneradas = [],
  minimoHorasDia = 7,
  onAddLog,
}: GerenciarMarcacoesViewProps) {
  const validUsers = useMemo(() => {
    const map = new Map<number, User>();
    for (const u of users) {
      if (u && typeof u === "object" && typeof u.id === "number" && u.nome && u.matricula) {
        map.set(u.id, u);
      }
    }
    return Array.from(map.values());
  }, [users]);

  // Filters state
  const [searchMatricula, setSearchMatricula] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(() => {
    const active = validUsers.find((u) => !u.desativado && u.tipo !== "adm-dev");
    return active ? active.id : validUsers[0]?.id || null;
  });

  const now = new Date();
  const [mesAno, setMesAno] = useState({
    mes: now.getMonth(),
    ano: now.getFullYear(),
  });

  // Modal state for managing/editing a specific punch
  const [modalData, setModalData] = useState<{
    userId: number;
    dayKey: string;
    slotIdx: number;
    punch: Batida | null;
  } | null>(null);

  const [inputHora, setInputHora] = useState("");
  const [inputJustificativa, setInputJustificativa] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [modalError, setModalError] = useState("");

  const [justificativaAtestado, setJustificativaAtestado] = useState("");
  const [atestadoProcessando, setAtestadoProcessando] = useState<string | null>(null);

  // Audit history drawer/modal
  const [photoModalData, setPhotoModalData] = useState<{ fotoUrl: string; userName: string; userMatricula: string; dayKey: string; slotName: string; timeStr: string } | null>(null);
  const [auditDetailPunch, setAuditDetailPunch] = useState<{
    dayKey: string;
    slotIdx: number;
    punch: Batida;
  } | null>(null);

  // Modal State for "Marcar Período Vazio / Sem Vínculo"
  const [showModalPeriodoVazio, setShowModalPeriodoVazio] = useState(false);
  const [vazioDataInicio, setVazioDataInicio] = useState("");
  const [vazioDataFim, setVazioDataFim] = useState("");
  const [vazioMotivo, setVazioMotivo] = useState("Admissão no meio do mês / Período sem vínculo");
  const [savingPeriodoVazio, setSavingPeriodoVazio] = useState(false);
  const [vazioError, setVazioError] = useState("");
  const [vazioSuccessMsg, setVazioSuccessMsg] = useState("");

  const handleAplicarPeriodoVazio = async (opcao: "marcar" | "desfazer") => {
    if (!selectedUserId || !selectedUser) {
      setVazioError("Selecione um colaborador primeiro.");
      return;
    }
    if (!vazioDataInicio || !vazioDataFim) {
      setVazioError("Por favor, selecione a Data Inicial e a Data Final.");
      return;
    }
    if (vazioDataInicio > vazioDataFim) {
      setVazioError("A Data Inicial não pode ser posterior à Data Final.");
      return;
    }

    setSavingPeriodoVazio(true);
    setVazioError("");

    try {
      const start = new Date(`${vazioDataInicio}T12:00:00`);
      const end = new Date(`${vazioDataFim}T12:00:00`);

      const userDays = { ...(pontosGlobal[selectedUserId] || {}) };
      let curr = new Date(start);
      let count = 0;

      while (curr <= end) {
        const dayKey = curr.toISOString().slice(0, 10);
        if (opcao === "marcar") {
          userDays[dayKey] = [
            {
              ocorrencia: "dia_vazio",
              obs: vazioMotivo.trim() || "Período Vazio / Sem Vínculo",
              modificadoPorGestor: true,
              modificadoPor: currentUser.nome,
              registradoEm: new Date().toISOString(),
              origemMarcacao: "MO",
            },
            null,
            null,
            null,
          ];
        } else {
          // Desfazer: se era dia_vazio, limpa para voltar ao estado normal de calculo/falta
          if (userDays[dayKey] && userDays[dayKey][0]?.ocorrencia === "dia_vazio") {
            userDays[dayKey] = [null, null, null, null];
          }
        }
        count++;
        curr.setDate(curr.getDate() + 1);
      }

      if (setPontosGlobal) {
        setPontosGlobal((prev) => ({
          ...prev,
          [selectedUserId]: userDays,
        }));
      }

      const fmtIni = vazioDataInicio.split("-").reverse().join("/");
      const fmtFim = vazioDataFim.split("-").reverse().join("/");

      if (onAddLog) {
        onAddLog(
          opcao === "marcar" ? "Definiu período vazio" : "Limpou período vazio",
          `${selectedUser.nome} (${selectedUser.matricula})`,
          `Período: ${fmtIni} a ${fmtFim} (${count} dias) · Motivo: ${vazioMotivo}`
        );
      }

      setVazioSuccessMsg(
        opcao === "marcar"
          ? `Período de ${fmtIni} a ${fmtFim} (${count} dias) marcado como Vazio com sucesso! Os dias foram isentos do cálculo de faltas.`
          : `Período Vazio removido com sucesso (${count} dias)! Os dias voltaram ao cálculo normal.`
      );

      setTimeout(() => {
        setShowModalPeriodoVazio(false);
        setSavingPeriodoVazio(false);
        setVazioSuccessMsg("");
      }, 1200);
    } catch (err) {
      console.error("Erro ao processar período vazio:", err);
      setVazioError("Falha ao salvar as informações. Tente novamente.");
      setSavingPeriodoVazio(false);
    }
  };

  // Filter users based on search string
  const filteredUsers = useMemo(() => {
    const query = searchMatricula.trim().toLowerCase();
    if (!query) return validUsers.filter((u) => !u.desativado);
    return validUsers.filter(
      (u) =>
        u.matricula.toLowerCase().includes(query) ||
        u.nome.toLowerCase().includes(query)
    );
  }, [validUsers, searchMatricula]);

  // Automatically update selectedUserId when searching so the espelho de ponto switches to the searched employee
  useEffect(() => {
    if (searchMatricula.trim() !== "") {
      if (filteredUsers.length > 0) {
        const isCurrentSelectedInFiltered = filteredUsers.some((u) => u.id === selectedUserId);
        if (!isCurrentSelectedInFiltered || filteredUsers.length === 1) {
          setSelectedUserId(filteredUsers[0].id);
        }
      }
    }
  }, [searchMatricula, filteredUsers]);

  const selectedUser = useMemo(() => {
    return validUsers.find((u) => u.id === selectedUserId) || null;
  }, [validUsers, selectedUserId]);

  const atestadosPendentes = useMemo(() => {
    if (!selectedUserId || !onDecisaoAtestado) return [];
    const grupos = new Map<string, {
      groupId: string;
      fotoAtestado?: string;
      cidAtestado?: string;
      dias: { dayKey: string; slotIdx: number; punch: Batida }[];
    }>();

    const userDays = pontosGlobal[selectedUserId] || {};
    for (const dayKey of Object.keys(userDays)) {
      const dayArr = userDays[dayKey];
      if (!Array.isArray(dayArr)) continue;
      for (let slotIdx = 0; slotIdx < dayArr.length; slotIdx++) {
        const punch = dayArr[slotIdx];
        if (punch?.ocorrencia === "atestado" && punch?.statusAtestado !== "aceito" && punch?.statusAtestado !== "recusado") {
          const groupId = punch.atestadoGroupId || `legacy_${selectedUserId}_${dayKey}_${slotIdx}`;
          if (!grupos.has(groupId)) {
            grupos.set(groupId, {
              groupId,
              fotoAtestado: punch.fotoAtestado,
              cidAtestado: punch.cidAtestado || punch.cid,
              dias: []
            });
          }
          grupos.get(groupId)!.dias.push({ dayKey, slotIdx, punch });
        }
      }
    }
    return Array.from(grupos.values()).sort((a, b) =>
      new Date(a.dias[0].dayKey).getTime() - new Date(b.dias[0].dayKey).getTime()
    );
  }, [selectedUserId, pontosGlobal, onDecisaoAtestado]);

  async function handleDecisaoAtestado(grupo: typeof atestadosPendentes[0], decisao: "aceito" | "recusado" | "excluir") {
    if (!selectedUserId || !onDecisaoAtestado) return;
    if (decisao === "excluir") {
      const diasStr = grupo.dias.map(d => d.dayKey.split("-").reverse().join("/")).join(", ");
      if (!confirm(`Tem certeza que deseja EXCLUIR/REMOVER a marcação de atestado para o(s) dia(s) ${diasStr}?`)) {
        return;
      }
    } else if (!justificativaAtestado.trim() || justificativaAtestado.trim().length < 3) {
      alert("A justificativa é obrigatória para aprovar ou recusar um atestado (mínimo de 3 caracteres).");
      return;
    }

    setAtestadoProcessando(grupo.groupId);
    try {
      await onDecisaoAtestado(
        selectedUserId,
        grupo.groupId,
        grupo.dias.map(d => ({ dayKey: d.dayKey, slotIdx: d.slotIdx })),
        decisao,
        justificativaAtestado.trim() || "Removido/Excluído pelo gestor"
      );
      setJustificativaAtestado("");
    } catch (err) {
      console.error("Erro na decisão do atestado:", err);
      alert("Falha ao aplicar decisão. Verifique o console.");
    } finally {
      setAtestadoProcessando(null);
    }
  }

  // Days of selected month
  const monthDays = useMemo(() => {
    if (!selectedUserId) return [];
    const totalDays = new Date(mesAno.ano, mesAno.mes + 1, 0).getDate();
    const daysArr = [];

    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(mesAno.ano, mesAno.mes, d);
      const dayKey = `${mesAno.ano}-${String(mesAno.mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const diaSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dateObj.getDay()];
      const isFds = [0, 6].includes(dateObj.getDay());

      const userDays = pontosGlobal[selectedUserId] || {};
      const dayPunches: DiaPontos = userDays[dayKey] || [null, null, null, null];
      const calc = calcularDia(selectedUserId, dayKey, users, pontosGlobal, feriados, 10, folgasRemuneradas);

      daysArr.push({
        d,
        diaSemana,
        dateObj,
        dayKey,
        isFds,
        punches: dayPunches,
        calc,
      });
    }

    return daysArr;
  }, [selectedUserId, mesAno, pontosGlobal, users, feriados]);

  // Monthly statistics summary
  const monthStats = useMemo(() => {
    let totalPunches = 0;
    let countMA = 0;
    let countMO = 0;
    let countNormal = 0;
    let countZeros = 0;

    monthDays.forEach((day) => {
      day.punches.forEach((b) => {
        if (!b || (!b.hora && !b.ocorrencia)) {
          countZeros++;
        } else if (b.ocorrencia) {
          // occurrence
        } else {
          totalPunches++;
          if (b.statusAprovacao === "aprovado" || b.origemMarcacao === "MA" || b.tipo === "manual_solicitado") {
            countMA++;
          } else if (b.lancadoPorAdm || b.modificadoPorGestor || b.origemMarcacao === "MO") {
            countMO++;
          } else {
            countNormal++;
          }
        }
      });
    });

    return { totalPunches, countMA, countMO, countNormal, countZeros };
  }, [monthDays]);

  // Relevant audit logs for the selected user and month
  const userAuditLogs = useMemo(() => {
    if (!selectedUserId || !selectedUser) return [];
    const prefix = `${mesAno.ano}-${String(mesAno.mes + 1).padStart(2, "0")}`;
    return auditLogs.filter((log) => {
      const isUserMatch =
        log.userId === selectedUserId ||
        (log.alvo && log.alvo.includes(selectedUser.matricula)) ||
        (log.detalhe && log.detalhe.includes(selectedUser.matricula));
      const isMonthMatch = log.quando && log.quando.startsWith(prefix);
      return isUserMatch && isMonthMatch;
    });
  }, [auditLogs, selectedUserId, selectedUser, mesAno]);

  // Helper to open edit modal
  function handleOpenSlot(dayKey: string, slotIdx: number, existingPunch: Batida | null) {
    if (!selectedUserId) return;
    setModalData({
      userId: selectedUserId,
      dayKey,
      slotIdx,
      punch: existingPunch,
    });

    if (existingPunch && existingPunch.hora) {
      let timeStr = "";
      if (existingPunch.hora.includes("T")) {
        try {
          const d = new Date(existingPunch.hora);
          if (!isNaN(d.getTime())) {
            timeStr = d.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            });
          }
        } catch {
          timeStr = existingPunch.hora;
        }
      } else {
        timeStr = existingPunch.hora;
      }
      setInputHora(timeStr || "");
    } else {
      setInputHora("");
    }
    setInputJustificativa("");
    setModalError("");
    setSaveSuccessMsg("");
  }

  // Handle saving modified punch
  async function handleSavePunch() {
    if (!modalData) return;
    if (!inputHora || !inputHora.includes(":")) {
      setModalError("Por favor, digite um horário válido no formato HH:MM.");
      return;
    }
    if (!inputJustificativa.trim() || inputJustificativa.trim().length < 3) {
      setModalError("A justificativa é obrigatória para qualquer alteração ou inserção de marcação.");
      return;
    }

    setSaving(true);
    setModalError("");

    try {
      await onSalvarPonto(
        modalData.userId,
        modalData.dayKey,
        modalData.slotIdx,
        inputHora.trim(),
        inputJustificativa.trim()
      );

      setSaveSuccessMsg("Marcação salva com sucesso! [Tag MO atribuída]");
      setTimeout(() => {
        setModalData(null);
        setSaveSuccessMsg("");
      }, 350);
    } catch (err: any) {
      console.error("Erro ao salvar marcação:", err);
      setModalError("Ocorreu um erro ao salvar no banco de dados. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const mesNome = new Date(mesAno.ano, mesAno.mes, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header section */}
      <div
        style={{
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          borderRadius: 14,
          padding: "18px 22px",
          marginBottom: 20,
          boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: t.text, display: "flex", alignItems: "center", gap: 9 }}>
              <Edit3 size={20} color={t.accent} /> Gerenciar Marcações e Histórico de Ponto
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: t.textSub }}>
              Consulte, ajuste e acompanhe o histórico individual de localização e auditoria por colaborador.
            </p>
          </div>

          {/* Month selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: t.surfaceAlt, padding: "6px 12px", borderRadius: 10, border: `1px solid ${t.border}` }}>
            <button
              onClick={() =>
                setMesAno((prev) => {
                  const m = prev.mes === 0 ? 11 : prev.mes - 1;
                  const a = prev.mes === 0 ? prev.ano - 1 : prev.ano;
                  return { mes: m, ano: a };
                })
              }
              style={{ background: "none", border: "none", color: t.text, cursor: "pointer", display: "flex", alignItems: "center" }}
              title="Mês Anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text, textTransform: "capitalize", minWidth: 140, textAlign: "center" }}>
              {mesNome}
            </span>
            <button
              onClick={() =>
                setMesAno((prev) => {
                  const m = prev.mes === 11 ? 0 : prev.mes + 1;
                  const a = prev.mes === 11 ? prev.ano + 1 : prev.ano;
                  return { mes: m, ano: a };
                })
              }
              style={{ background: "none", border: "none", color: t.text, cursor: "pointer", display: "flex", alignItems: "center" }}
              title="Próximo Mês"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Employee Search & Selector */}
        <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 280px" }}>
            <Search size={16} color={t.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Buscar por Matrícula ou Nome do colaborador..."
              value={searchMatricula}
              onChange={(e) => setSearchMatricula(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px 9px 36px",
                background: t.bg,
                border: `1.5px solid ${t.border}`,
                borderRadius: 8,
                fontSize: 13,
                color: t.text,
                outline: "none",
              }}
            />
          </div>

          <div style={{ flex: "1 1 240px" }}>
            <select
              value={selectedUserId || ""}
              onChange={(e) => setSelectedUserId(Number(e.target.value))}
              style={{
                width: "100%",
                padding: "9px 12px",
                background: t.bg,
                border: `1.5px solid ${t.border}`,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: t.text,
                outline: "none",
              }}
            >
              {filteredUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  Matrícula: {u.matricula} — {u.nome} ({u.tipo === "adm-dev" ? "Gestor/ADM" : "Colaborador"})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!selectedUserId) {
                alert("Selecione um colaborador primeiro.");
                return;
              }
              const startDay = `${mesAno.ano}-${String(mesAno.mes + 1).padStart(2, "0")}-01`;
              const lastDayNum = new Date(mesAno.ano, mesAno.mes + 1, 0).getDate();
              const endDay = `${mesAno.ano}-${String(mesAno.mes + 1).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;

              setVazioDataInicio(startDay);
              setVazioDataFim(endDay);
              setVazioMotivo("Admissão no meio do mês / Período sem vínculo");
              setVazioError("");
              setVazioSuccessMsg("");
              setShowModalPeriodoVazio(true);
            }}
            style={{
              background: t.surfaceAlt,
              border: `1.5px solid ${t.border}`,
              color: t.text,
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s",
              whiteSpace: "nowrap"
            }}
            title="Marcar intervalo de dias vazios (isento de faltas)"
          >
            <CalendarRange size={16} color={t.accent} />
            Marcar Período Vazio
          </button>
        </div>
      </div>

      {selectedUser ? (
        <>
          {/* Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textSub, textTransform: "uppercase" }}>Marcações Normais</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#16a34a", marginTop: 4 }}>
                {monthStats.countNormal} <span style={{ fontSize: 12, fontWeight: 500, color: t.textMuted }}>registros</span>
              </div>
            </div>

            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textSub, textTransform: "uppercase" }}>Manual Aprovado (MA)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#2563eb", marginTop: 4 }}>
                {monthStats.countMA} <span style={{ fontSize: 12, fontWeight: 500, color: t.textMuted }}>marcações</span>
              </div>
            </div>

            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textSub, textTransform: "uppercase" }}>Modificado pelo Gestor (MO)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#9333ea", marginTop: 4 }}>
                {monthStats.countMO} <span style={{ fontSize: 12, fontWeight: 500, color: t.textMuted }}>modificações</span>
              </div>
            </div>

            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textSub, textTransform: "uppercase" }}>Sem Registro (--:--)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: t.textMuted, marginTop: 4 }}>
                {monthStats.countZeros} <span style={{ fontSize: 12, fontWeight: 500, color: t.textMuted }}>lacunas</span>
              </div>
            </div>
          </div>

          {atestadosPendentes.length > 0 && (
            <div style={{ background: t.surface, border: `1.5px solid ${t.warningBorder}`, borderRadius: 14, padding: 20, marginBottom: 24, boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <AlertTriangle size={18} color={t.warning} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: t.text }}>
                  Atestados Pendentes de Aprovação ({atestadosPendentes.length})
                </h3>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {atestadosPendentes.map((grupo) => {
                  const datasFmt = grupo.dias.length > 1
                    ? `de ${grupo.dias[0].dayKey.split("-").reverse().join("/")} até ${grupo.dias[grupo.dias.length - 1].dayKey.split("-").reverse().join("/")}`
                    : grupo.dias[0].dayKey.split("-").reverse().join("/");
                  const isProcessing = atestadoProcessando === grupo.groupId;

                  return (
                    <div key={grupo.groupId} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                            Período: {datasFmt} ({grupo.dias.length} {grupo.dias.length === 1 ? "dia" : "dias"})
                          </div>
                          {grupo.cidAtestado && (
                            <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>
                              CID: <strong>{grupo.cidAtestado}</strong>
                            </div>
                          )}
                        </div>
                        {grupo.fotoAtestado && (
                          <a href={grupo.fotoAtestado} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: t.accent, fontWeight: 600 }}>
                            📎 Ver Anexo/Foto
                          </a>
                        )}
                      </div>

                      {grupo.fotoAtestado && (
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <img
                            src={grupo.fotoAtestado}
                            alt="Atestado"
                            style={{ maxWidth: 220, maxHeight: 160, borderRadius: 8, border: `1px solid ${t.border}`, objectFit: "cover" }}
                          />
                        </div>
                      )}

                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textSub, marginBottom: 4 }}>
                          Justificativa da Decisão *
                        </label>
                        <input
                          type="text"
                          placeholder="Informe o motivo da aprovação ou recusa..."
                          value={justificativaAtestado}
                          onChange={e => setJustificativaAtestado(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            background: t.surfaceAlt,
                            border: `1.5px solid ${t.border}`,
                            borderRadius: 8,
                            fontSize: 13,
                            color: t.text,
                            outline: "none"
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => handleDecisaoAtestado(grupo, "excluir")}
                          disabled={isProcessing}
                          style={{
                            background: t.surfaceAlt,
                            border: `1.5px solid ${t.border}`,
                            color: t.danger,
                            borderRadius: 8,
                            padding: "7px 14px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: isProcessing ? "not-allowed" : "pointer",
                            fontFamily: "inherit"
                          }}
                        >
                          🗑️ Excluir Marcação
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecisaoAtestado(grupo, "recusado")}
                          disabled={isProcessing}
                          style={{
                            background: isProcessing ? t.surfaceAlt : t.dangerBg,
                            border: `1.5px solid ${isProcessing ? t.border : t.dangerBorder}`,
                            color: isProcessing ? t.textMuted : t.danger,
                            borderRadius: 8,
                            padding: "7px 14px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: isProcessing ? "not-allowed" : "pointer",
                            fontFamily: "inherit"
                          }}
                        >
                          {isProcessing ? "Processando..." : "❌ Recusar Atestado"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecisaoAtestado(grupo, "aceito")}
                          disabled={isProcessing}
                          style={{
                            background: isProcessing ? t.surfaceAlt : t.successBg,
                            border: `1.5px solid ${isProcessing ? t.border : t.successBorder}`,
                            color: isProcessing ? t.textMuted : t.success,
                            borderRadius: 8,
                            padding: "7px 14px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: isProcessing ? "not-allowed" : "pointer",
                            fontFamily: "inherit"
                          }}
                        >
                          {isProcessing ? "Processando..." : "✅ Aprovar Atestado"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Espelho de Ponto Table */}
          <div
            style={{
              background: t.surface,
              border: `1.5px solid ${t.border}`,
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
              marginBottom: 24,
            }}
          >
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${t.border}`, background: t.surfaceAlt, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                  Espelho de Ponto Interativo — {selectedUser.nome} (Mat. {selectedUser.matricula})
                </span>
                <span style={{ fontSize: 12, color: t.textSub, marginLeft: 12 }}>
                  * Clique em qualquer marcação ou slot livre (--:--) para editar/incluir e ver histórico detalhado de auditoria.
                </span>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "center" }}>
                <thead>
                  <tr style={{ background: t.bg, borderBottom: `1.5px solid ${t.border}` }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", color: t.textSub, fontWeight: 700 }}>Data / Dia</th>
                    <th style={{ padding: "10px 12px", color: t.textSub, fontWeight: 700 }}>Entrada 1</th>
                    <th style={{ padding: "10px 12px", color: t.textSub, fontWeight: 700 }}>Saída 1</th>
                    <th style={{ padding: "10px 12px", color: t.textSub, fontWeight: 700 }}>Entrada 2</th>
                    <th style={{ padding: "10px 12px", color: t.textSub, fontWeight: 700 }}>Saída 2</th>
                    <th style={{ padding: "10px 12px", color: t.textSub, fontWeight: 700 }}>Situação / Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {monthDays.map((day) => {
                    const dataFmt = `${String(day.d).padStart(2, "0")}/${String(mesAno.mes + 1).padStart(2, "0")}/${mesAno.ano}`;

                    return (
                      <tr
                        key={day.dayKey}
                        style={{
                          borderBottom: `1px solid ${t.border}`,
                          background: day.isFds ? t.surfaceAlt : "transparent",
                          transition: "background 0.15s",
                        }}
                      >
                        <td style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: day.isFds ? t.textSub : t.text }}>
                          <span style={{ display: "inline-block", width: 36, color: t.accent, fontWeight: 700 }}>{day.diaSemana}</span>
                          <span>{dataFmt}</span>
                        </td>

                        {[0, 1, 2, 3].map((slotIdx) => {
                          const punch = day.punches[slotIdx];
                          const isAtestadoRecusado = punch && punch.ocorrencia === "atestado" && punch.statusAtestado === "recusado";
                          const hasValidOccurrence = punch && punch.ocorrencia && !isAtestadoRecusado;
                          const hasPunch = punch && (punch.hora || hasValidOccurrence);

                          let timeDisplay = "--:--";
                          let tag: "MA" | "MO" | "RECUSADA" | null = null;

                          if (punch) {
                            if (punch.ocorrencia && !isAtestadoRecusado) {
                              if (punch.ocorrencia === "dia_vazio" || punch.ocorrencia === "vazio" || punch.ocorrencia === "sem_vinculo" || punch.ocorrencia === "isento") {
                                timeDisplay = slotIdx === 0 ? "—" : "--:--";
                              } else if (punch.ocorrencia === "atestado") {
                                if (punch.statusAtestado === "aceito") {
                                  timeDisplay = "ATESTADO (ACEITO)";
                                } else {
                                  timeDisplay = "ATESTADO (PENDENTE)";
                                }
                              } else {
                                timeDisplay = punch.ocorrencia.toUpperCase();
                              }
                            } else if (punch.hora) {
                              timeDisplay = new Date(punch.hora).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              });

                              if (punch.statusAprovacao === "recusado" || punch.statusAprovacao === "rejeitado" || punch.origemMarcacao === "RECUSADA") {
                                tag = "RECUSADA";
                              } else if (punch.statusAprovacao === "aprovado" || punch.origemMarcacao === "MA" || punch.tipo === "manual_solicitado") {
                                tag = "MA";
                              } else if (punch.lancadoPorAdm || punch.modificadoPorGestor || punch.origemMarcacao === "MO") {
                                tag = "MO";
                              }
                            }
                          }

                          return (
                            <td key={slotIdx} style={{ padding: "8px 10px" }}>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => handleOpenSlot(day.dayKey, slotIdx, punch)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleOpenSlot(day.dayKey, slotIdx, punch);
                                  }
                                }}
                                style={{
                                  background: hasPunch ? (tag === "MA" ? "rgba(37,99,235,0.08)" : tag === "MO" ? "rgba(147,51,234,0.08)" : t.surfaceAlt) : "transparent",
                                  border: `1px dashed ${hasPunch ? (tag === "MA" ? "rgba(37,99,235,0.3)" : tag === "MO" ? "rgba(147,51,234,0.3)" : t.border) : t.border}`,
                                  borderRadius: 7,
                                  padding: "5px 10px",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  fontWeight: hasPunch ? 700 : 500,
                                  color: hasPunch ? t.text : t.textMuted,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  transition: "all 0.15s",
                                }}
                                title={hasPunch ? "Clique para gerenciar ou ver histórico de auditoria desta marcação" : "Clique para incluir marcação"}
                              >
                                <span>{timeDisplay}</span>

                                {tag === "MA" && (
                                  <span
                                    style={{
                                      background: "#2563eb",
                                      color: "#ffffff",
                                      fontSize: 9,
                                      fontWeight: 800,
                                      padding: "1px 4px",
                                      borderRadius: 3,
                                      letterSpacing: 0.5,
                                    }}
                                    title="Manual Aprovada (Solicitada pelo funcionário e aprovada)"
                                  >
                                    MA
                                  </span>
                                )}

                                {tag === "MO" && (
                                  <span
                                    style={{
                                      background: "#9333ea",
                                      color: "#ffffff",
                                      fontSize: 9,
                                      fontWeight: 800,
                                      padding: "1px 4px",
                                      borderRadius: 3,
                                      letterSpacing: 0.5,
                                    }}
                                    title="Modificada/Inserida diretamente pelo Gestor"
                                  >
                                    MO
                                  </span>
                                )}

                                {tag === "RECUSADA" && (
                                  <span
                                    style={{
                                      background: "#dc2626",
                                      color: "#ffffff",
                                      fontSize: 9,
                                      fontWeight: 800,
                                      padding: "1px 4px",
                                      borderRadius: 3,
                                      letterSpacing: 0.5,
                                    }}
                                    title="Marcação Recusada pelo Gestor"
                                  >
                                    RECUSADA
                                  </span>
                                )}

                                {(() => {
                                  const cellFoto = getFotoForPunchSlot(punch, day.dayKey, selectedUserId, selectedUser?.nome, selectedUser?.matricula, slotIdx, auditLogs);
                                  if (!cellFoto) return null;
                                  return (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPhotoModalData({
                                          fotoUrl: cellFoto,
                                          userName: selectedUser?.nome || "Colaborador",
                                          userMatricula: selectedUser?.matricula || "—",
                                          dayKey: day.dayKey,
                                          slotName: SLOT_NAMES[slotIdx] || `Batida #${slotIdx + 1}`,
                                          timeStr: punch?.hora ? new Date(punch.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"
                                        });
                                      }}
                                      style={{
                                        background: "rgba(139, 92, 246, 0.15)",
                                        border: "1px solid rgba(139, 92, 246, 0.35)",
                                        color: "#8b5cf6",
                                        borderRadius: 4,
                                        padding: "1px 5px",
                                        fontSize: 10,
                                        fontWeight: 750,
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 3,
                                        marginLeft: 2
                                      }}
                                      title="Clique para visualizar a foto / selfie de comprovação"
                                    >
                                      <Camera size={10} color="#8b5cf6" />
                                      <span>Foto</span>
                                    </button>
                                  );
                                })()}

                                {punch?.latitude && punch?.longitude && (
                                  <span title="Possui localização GPS gravada" style={{ display: "inline-flex", alignItems: "center" }}>
                                    <MapPin size={11} color={t.accent} />
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        <td style={{ padding: "10px 12px", color: t.textSub, fontSize: 11.5 }}>
                          {day.calc?.totalTrabalhado ? `${day.calc.totalTrabalhado}h` : "—"}
                          {day.calc?.status && day.calc.status !== "dia_vazio" && (
                            <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: day.calc.status === "falta" ? t.danger : t.textSub }}>
                              ({day.calc.status})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: 40, textAlign: "center", color: t.textSub }}>
          Nenhum colaborador selecionado. Utilize a busca por matrícula no topo para escolher um funcionário.
        </div>
      )}

      {/* MODAL DE EDIÇÃO E GERENCIAMENTO DE MARCAÇÃO */}
      {modalData && selectedUser && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: t.surface,
              border: `1.5px solid ${t.border}`,
              borderRadius: 16,
              maxWidth: 520,
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: `1px solid ${t.border}`,
                background: t.surfaceAlt,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
                  <Edit3 size={18} color={t.accent} /> Gerenciar Marcações — {SLOT_NAMES[modalData.slotIdx]}
                </h3>
                <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>
                  {selectedUser.nome} (Mat. {selectedUser.matricula}) — Data: {modalData.dayKey.split("-").reverse().join("/")}
                </div>
              </div>
              <button
                onClick={() => setModalData(null)}
                style={{ background: "none", border: "none", fontSize: 18, color: t.textSub, cursor: "pointer", fontWeight: 700 }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 20 }}>
              {/* Existing atestado info */}
              {modalData.punch && modalData.punch.ocorrencia === "atestado" && (
                <div
                  style={{
                    background: t.bg,
                    border: `1.5px solid ${modalData.punch.statusAtestado === "aceito" ? t.successBorder : modalData.punch.statusAtestado === "recusado" ? t.dangerBorder : t.warningBorder}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                    marginBottom: 16,
                    fontSize: 12.5,
                  }}
                >
                  <div style={{ fontWeight: 800, color: t.text, marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>🏥 Ocorrência: Atestado Médico</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: modalData.punch.statusAtestado === "aceito" ? t.successBg : modalData.punch.statusAtestado === "recusado" ? t.dangerBg : t.warningBg,
                        color: modalData.punch.statusAtestado === "aceito" ? t.success : modalData.punch.statusAtestado === "recusado" ? t.danger : t.warning,
                        border: `1px solid ${modalData.punch.statusAtestado === "aceito" ? t.successBorder : modalData.punch.statusAtestado === "recusado" ? t.dangerBorder : t.warningBorder}`,
                      }}
                    >
                      {modalData.punch.statusAtestado === "aceito" ? "✅ Aceito / Homologado" : modalData.punch.statusAtestado === "recusado" ? "❌ Recusado" : "⏳ Pendente"}
                    </span>
                  </div>

                  {(modalData.punch.cidAtestado || modalData.punch.cid) && (
                    <div style={{ color: t.textSub, marginTop: 4 }}>
                      <strong>CID:</strong> {modalData.punch.cidAtestado || modalData.punch.cid}
                    </div>
                  )}

                  {modalData.punch.motivoRecusaAtestado && (
                    <div style={{ color: t.danger, marginTop: 4, fontWeight: 600 }}>
                      <strong>Motivo da Recusa:</strong> "{modalData.punch.motivoRecusaAtestado}"
                    </div>
                  )}

                  {onDecisaoAtestado && (
                    <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!selectedUserId) return;
                          if (confirm("Tem certeza que deseja EXCLUIR/REMOVER o atestado desta data?")) {
                            setSaving(true);
                            try {
                              await onDecisaoAtestado(
                                selectedUserId,
                                modalData.punch?.atestadoGroupId || `slot_${modalData.dayKey}_${modalData.slotIdx}`,
                                [{ dayKey: modalData.dayKey, slotIdx: modalData.slotIdx }],
                                "excluir",
                                "Removido pelo gestor no espelho de ponto"
                              );
                              setSaveSuccessMsg("Atestado removido com sucesso!");
                              setTimeout(() => {
                                setModalData(null);
                                setSaveSuccessMsg("");
                              }, 800);
                            } catch (err) {
                              console.error(err);
                              setModalError("Erro ao remover atestado.");
                            } finally {
                              setSaving(false);
                            }
                          }
                        }}
                        style={{
                          background: t.dangerBg,
                          border: `1px solid ${t.dangerBorder}`,
                          color: t.danger,
                          borderRadius: 6,
                          padding: "5px 10px",
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        🗑️ Excluir / Limpar Atestado deste Dia
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Existing punch info */}
              {modalData.punch && modalData.punch.hora && (
                <div
                  style={{
                    background: t.bg,
                    border: `1px solid ${t.border}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                    marginBottom: 16,
                    fontSize: 12.5,
                  }}
                >
                  <div style={{ fontWeight: 700, color: t.text, marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                    <span>Horário Atual Registrado: {new Date(modalData.punch.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    {modalData.punch.origemMarcacao === "MA" || modalData.punch.statusAprovacao === "aprovado" ? (
                      <span style={{ color: "#2563eb", fontWeight: 800 }}>[Tag MA]</span>
                    ) : modalData.punch.origemMarcacao === "MO" || modalData.punch.modificadoPorGestor ? (
                      <span style={{ color: "#9333ea", fontWeight: 800 }}>[Tag MO]</span>
                    ) : (
                      <span style={{ color: "#16a34a", fontWeight: 700 }}>[Normal]</span>
                    )}
                  </div>

                  {modalData.punch.modificadoPor && (
                    <div style={{ color: t.textSub, marginTop: 2 }}>
                      <strong>Modificado Por:</strong> {modalData.punch.modificadoPor}
                    </div>
                  )}

                  {modalData.punch.justificativaAlteracao && (
                    <div style={{ color: t.textSub, marginTop: 2 }}>
                      <strong>Justificativa Registrada:</strong> "{modalData.punch.justificativaAlteracao}"
                    </div>
                  )}

                  {modalData.punch.latitude && modalData.punch.longitude && (
                    <div style={{ color: t.accent, marginTop: 4, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                      <MapPin size={13} /> Localização GPS: Lat {modalData.punch.latitude.toFixed(5)}, Long {modalData.punch.longitude.toFixed(5)}
                      <a
                        href={`https://www.google.com/maps?q=${modalData.punch.latitude},${modalData.punch.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: t.accent, textDecoration: "underline", marginLeft: 6 }}
                      >
                        Abrir Mapa
                      </a>
                    </div>
                  )}

                  {(() => {
                    const modalFoto = getFotoForPunchSlot(modalData.punch, modalData.dayKey, modalData.userId, selectedUser?.nome, selectedUser?.matricula, modalData.slotIdx, auditLogs);
                    if (!modalFoto) return null;
                    return (
                      <div style={{ marginTop: 10, padding: 12, background: t.surfaceAlt, borderRadius: 10, border: `1px solid ${t.border}` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <Camera size={14} color="#8b5cf6" /> Selfie / Comprovante Visual Registrado:
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setPhotoModalData({
                                fotoUrl: modalFoto,
                                userName: selectedUser?.nome || "Colaborador",
                                userMatricula: selectedUser?.matricula || "—",
                                dayKey: modalData.dayKey,
                                slotName: SLOT_NAMES[modalData.slotIdx] || `Batida #${modalData.slotIdx + 1}`,
                                timeStr: modalData.punch?.hora ? new Date(modalData.punch.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"
                              });
                            }}
                            style={{ background: "#8b5cf6", color: "#ffffff", border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 10.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                          >
                            🔍 Ampliar Selfie
                          </button>
                        </div>
                        <div style={{ textAlign: "center", background: "#000", borderRadius: 8, padding: 4, overflow: "hidden" }}>
                          <img
                            src={modalFoto}
                            alt="Foto Comprovante Selfie"
                            style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 6, objectFit: "contain", cursor: "pointer" }}
                            onClick={() => {
                              setPhotoModalData({
                                fotoUrl: modalFoto,
                                userName: selectedUser?.nome || "Colaborador",
                                userMatricula: selectedUser?.matricula || "—",
                                dayKey: modalData.dayKey,
                                slotName: SLOT_NAMES[modalData.slotIdx] || `Batida #${modalData.slotIdx + 1}`,
                                timeStr: modalData.punch?.hora ? new Date(modalData.punch.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"
                              });
                            }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Edit input fields */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Novo Horário da Marcação (HH:MM) *
                </label>
                <input
                  type="time"
                  value={inputHora}
                  onChange={(e) => setInputHora(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: t.bg,
                    border: `1.5px solid ${t.border}`,
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 700,
                    color: t.text,
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Justificativa Obrigatória da Edição / Inserção *
                </label>
                <textarea
                  rows={3}
                  placeholder="Informe o motivo da alteração (ex: Ajuste solicitado pelo supervisor, falha técnica no relógio, etc.)..."
                  value={inputJustificativa}
                  onChange={(e) => setInputJustificativa(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: t.bg,
                    border: `1.5px solid ${t.border}`,
                    borderRadius: 8,
                    fontSize: 13,
                    color: t.text,
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ background: "rgba(147,51,234,0.06)", border: "1px solid rgba(147,51,234,0.2)", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontSize: 11.5, color: t.textSub }}>
                📌 <strong>Regra de Conformidade Trabalhista:</strong> Qualquer inserção ou alteração realizada diretamente pelo gestor fica carimbada permanentemente com a tag <strong>MO (Modificado pelo Gestor)</strong> e registrada com timestamp e identificação do gestor na auditoria do sistema. Não é permitida a remoção pura de registros de ponto.
              </div>

              {modalError && (
                <div style={{ background: t.dangerBg, border: `1px solid ${t.dangerBorder}`, color: t.danger, borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 12, fontWeight: 600 }}>
                  ⚠️ {modalError}
                </div>
              )}

              {saveSuccessMsg && (
                <div style={{ background: t.successBg, border: `1px solid ${t.successBorder}`, color: t.success, borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={16} /> {saveSuccessMsg}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalData(null)}
                  disabled={saving}
                  style={{
                    background: t.surfaceAlt,
                    border: `1px solid ${t.border}`,
                    color: t.text,
                    padding: "9px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSavePunch}
                  disabled={saving}
                  style={{
                    background: saving ? t.surfaceAlt : t.accent,
                    color: "#ffffff",
                    border: "none",
                    padding: "9px 18px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: saving ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {saving ? "Salvando..." : "Salvar Alteração (MO)"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Marcar Período Vazio / Sem Vínculo */}
      {showModalPeriodoVazio && selectedUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: t.surface,
              border: `1.5px solid ${t.border}`,
              borderRadius: 16,
              maxWidth: 520,
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: `1px solid ${t.border}`,
                background: t.surfaceAlt,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
                  <CalendarRange size={18} color={t.accent} /> Deixar Período Vazio (Sem Faltas)
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textSub }}>
                  {selectedUser.nome} — Matrícula: {selectedUser.matricula}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModalPeriodoVazio(false)}
                style={{ background: "none", border: "none", color: t.textSub, cursor: "pointer", padding: 4 }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: 20 }}>
              {vazioError && (
                <div
                  style={{
                    background: t.dangerBg,
                    border: `1px solid ${t.dangerBorder}`,
                    color: t.danger,
                    padding: "10px 14px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    marginBottom: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <AlertTriangle size={16} />
                  <span>{vazioError}</span>
                </div>
              )}

              {vazioSuccessMsg && (
                <div
                  style={{
                    background: t.successBg,
                    border: `1px solid ${t.successBorder}`,
                    color: t.success,
                    padding: "10px 14px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    marginBottom: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{vazioSuccessMsg}</span>
                </div>
              )}

              <div style={{ background: t.bg, border: `1px solid ${t.border}`, padding: 12, borderRadius: 10, marginBottom: 16, fontSize: 12, color: t.textSub, lineHeight: 1.5 }}>
                💡 <strong>Como funciona:</strong> Ao selecionar um intervalo de datas (ex: do dia 1 ao dia em que a pessoa começou no meio do mês), esses dias serão gravados como <strong>"Vazio"</strong>. Eles não serão calculados como faltas nem descontarão do saldo do mês.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 5 }}>
                    Data Inicial (Dia X) *
                  </label>
                  <input
                    type="date"
                    value={vazioDataInicio}
                    onChange={(e) => setVazioDataInicio(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      background: t.bg,
                      border: `1.5px solid ${t.border}`,
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      color: t.text,
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 5 }}>
                    Data Final (Dia Y) *
                  </label>
                  <input
                    type="date"
                    value={vazioDataFim}
                    onChange={(e) => setVazioDataFim(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      background: t.bg,
                      border: `1.5px solid ${t.border}`,
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      color: t.text,
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 5 }}>
                  Motivo / Observação *
                </label>
                <input
                  type="text"
                  value={vazioMotivo}
                  onChange={(e) => setVazioMotivo(e.target.value)}
                  placeholder="ex: Admissão no meio do mês / Período sem vínculo"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: t.bg,
                    border: `1.5px solid ${t.border}`,
                    borderRadius: 8,
                    fontSize: 13,
                    color: t.text,
                    outline: "none",
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", borderTop: `1px solid ${t.border}`, paddingTop: 16 }}>
                <button
                  type="button"
                  onClick={() => handleAplicarPeriodoVazio("desfazer")}
                  disabled={savingPeriodoVazio}
                  style={{
                    background: t.bg,
                    border: `1px solid ${t.border}`,
                    color: t.danger,
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: savingPeriodoVazio ? "not-allowed" : "pointer",
                  }}
                  title="Remove a marcação de dia vazio dos dias no período selecionado, voltando ao cálculo normal"
                >
                  🔄 Desfazer / Limpar Período Vazio
                </button>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowModalPeriodoVazio(false)}
                    style={{
                      background: t.surfaceAlt,
                      border: `1px solid ${t.border}`,
                      color: t.text,
                      padding: "8px 14px",
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAplicarPeriodoVazio("marcar")}
                    disabled={savingPeriodoVazio}
                    style={{
                      background: savingPeriodoVazio ? t.surfaceAlt : t.accent,
                      color: "#ffffff",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: savingPeriodoVazio ? "not-allowed" : "pointer",
                    }}
                  >
                    {savingPeriodoVazio ? "Processando..." : "✅ Marcar como Período Vazio"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Foto / Selfie do Ponto em Gerenciar Marcações */}
      {photoModalData && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: 20
          }}
          onClick={() => setPhotoModalData(null)}
        >
          <div
            style={{
              background: t.surface,
              border: `1.5px solid ${t.border}`,
              borderRadius: 20,
              width: "100%",
              maxWidth: 480,
              overflow: "hidden",
              boxShadow: t.shadow,
              display: "flex",
              flexDirection: "column"
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: "18px 24px", background: t.surfaceAlt, borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(139, 92, 246, 0.15)", border: "1px solid rgba(139, 92, 246, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#8B5CF6" }}>
                  <Camera size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: t.text }}>Selfie de Comprovante de Ponto</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textSub }}>Controle de Marcações · Portaria 671 MTE</p>
                </div>
              </div>
              <button
                onClick={() => setPhotoModalData(null)}
                style={{ background: "transparent", border: "none", color: t.textMuted, fontSize: 18, cursor: "pointer", fontWeight: "bold" }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, maxHeight: "75vh", overflowY: "auto" }}>
              <div style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 650, color: t.textMuted }}>COLABORADOR</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginTop: 2 }}>{photoModalData.userName}</div>
                  <div style={{ fontSize: 11, color: t.textSub, fontFamily: "monospace" }}>Mat: {photoModalData.userMatricula}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 650, color: t.textMuted }}>SLA / BATIDA</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginTop: 2 }}>{photoModalData.slotName} ({photoModalData.timeStr})</div>
                  <div style={{ fontSize: 11, color: t.textSub }}>{photoModalData.dayKey.split("-").reverse().join("/")}</div>
                </div>
              </div>

              <div style={{ position: "relative", width: "100%", borderRadius: 14, overflow: "hidden", border: `2px solid ${t.border}`, background: "#000", textAlign: "center" }}>
                <img
                  src={photoModalData.fotoUrl}
                  alt="Selfie de Comprovante"
                  style={{ width: "100%", maxHeight: 340, objectFit: "contain", display: "block" }}
                />
                <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", padding: "4px 10px", borderRadius: 8, color: "#22c55e", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 size={12} /> Comprovante Biométrico Auditado
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 24px", background: t.surfaceAlt, borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setPhotoModalData(null)}
                style={{ background: t.accent, color: "#ffffff", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Fechar Visualizador
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
