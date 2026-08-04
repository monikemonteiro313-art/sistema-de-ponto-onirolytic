import React, { useState, useMemo } from "react";
import { Search, Calendar, Clock, ShieldCheck, MapPin, Edit3, Info, Eye, History, AlertTriangle, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { ThemeColors, User, PontosGlobal, Batida, DiaPontos, AuditLogEntry } from "../types";
import { calcularDia, resumoMesCalculado } from "../utils/hrHelpers";
import { getJornada } from "../data/mockData";

interface GerenciarMarcacoesViewProps {
  t: ThemeColors;
  users: User[];
  currentUser: User;
  pontosGlobal: PontosGlobal;
  auditLogs: AuditLogEntry[];
  onSalvarPonto: (userId: number, dayKey: string, batidaIdx: number, novaHora: string, justificativa: string) => Promise<void>;
  feriados?: string[];
  minimoHorasDia?: number;
}

const SLOT_NAMES = ["Entrada 1", "Saída 1 (Almoço)", "Entrada 2 (Retorno)", "Saída 2"];

export function GerenciarMarcacoesView({
  t,
  users,
  currentUser,
  pontosGlobal,
  auditLogs,
  onSalvarPonto,
  feriados = [],
  minimoHorasDia = 7,
}: GerenciarMarcacoesViewProps) {
  // Filters state
  const [searchMatricula, setSearchMatricula] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(() => {
    const active = users.find((u) => !u.desativado && u.tipo !== "adm-dev");
    return active ? active.id : users[0]?.id || null;
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

  // Audit history drawer/modal
  const [auditDetailPunch, setAuditDetailPunch] = useState<{
    dayKey: string;
    slotIdx: number;
    punch: Batida;
  } | null>(null);

  // Filter users based on search string
  const filteredUsers = useMemo(() => {
    const query = searchMatricula.trim().toLowerCase();
    if (!query) return users.filter((u) => !u.desativado);
    return users.filter(
      (u) =>
        u.matricula.toLowerCase().includes(query) ||
        u.nome.toLowerCase().includes(query)
    );
  }, [users, searchMatricula]);

  const selectedUser = useMemo(() => {
    return users.find((u) => u.id === selectedUserId) || null;
  }, [users, selectedUserId]);

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
      const calc = calcularDia(selectedUserId, dayKey, users, pontosGlobal, feriados);

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
      const timeStr = new Date(existingPunch.hora).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setInputHora(timeStr);
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

          <div style={{ flex: "1 1 300px" }}>
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
                          const hasPunch = punch && (punch.hora || punch.ocorrencia);

                          let timeDisplay = "--:--";
                          let tag: "MA" | "MO" | null = null;

                          if (punch) {
                            if (punch.ocorrencia) {
                              timeDisplay = punch.ocorrencia.toUpperCase();
                            } else if (punch.hora) {
                              timeDisplay = new Date(punch.hora).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              });

                              if (punch.statusAprovacao === "aprovado" || punch.origemMarcacao === "MA" || punch.tipo === "manual_solicitado") {
                                tag = "MA";
                              } else if (punch.lancadoPorAdm || punch.modificadoPorGestor || punch.origemMarcacao === "MO") {
                                tag = "MO";
                              }
                            }
                          }

                          return (
                            <td key={slotIdx} style={{ padding: "8px 10px" }}>
                              <button
                                type="button"
                                onClick={() => handleOpenSlot(day.dayKey, slotIdx, punch)}
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

                                {punch?.latitude && punch?.longitude && (
                                  <span title="Possui localização GPS gravada" style={{ display: "inline-flex", alignItems: "center" }}>
                                    <MapPin size={11} color={t.accent} />
                                  </span>
                                )}
                              </button>
                            </td>
                          );
                        })}

                        <td style={{ padding: "10px 12px", color: t.textSub, fontSize: 11.5 }}>
                          {day.calc?.totalTrabalhado ? `${day.calc.totalTrabalhado}h` : "—"}
                          {day.calc?.status && (
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
    </div>
  );
}
