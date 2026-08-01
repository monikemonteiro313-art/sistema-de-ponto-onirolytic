import React, { useState, useMemo } from "react";
import { Clock, CheckCircle2, XCircle, AlertTriangle, MapPin, Search, Filter, Lock, Check, X, MessageSquare, ExternalLink, Calendar } from "lucide-react";
import { ThemeColors, SolicitacaoCorrecao } from "../types";
import { Btn, Tag } from "./SharedUI";

interface SolicitacoesCorrecaoViewProps {
  t: ThemeColors;
  solicitacoes: SolicitacaoCorrecao[];
  onAprovar: (id: string, revisadoPor: string) => Promise<void>;
  onRejeitar: (id: string, motivoRejeicao: string, revisadoPor: string) => Promise<void>;
  currentUser?: any;
  currentUserName?: string;
}

export function SolicitacoesCorrecaoView({
  t,
  solicitacoes = [],
  onAprovar,
  onRejeitar,
  currentUser,
  currentUserName
}: SolicitacoesCorrecaoViewProps) {
  const effectiveUserName = currentUser?.nome || currentUserName || "Gestor / ADM";
  const [filterStatus, setFilterStatus] = useState<"todas" | "pendente" | "aprovado" | "rejeitado">("pendente");
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Rejection Modal State
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const slotNames = [
    "Entrada (1º Turno)",
    "Saída p/ Almoço",
    "Retorno do Almoço",
    "Saída (Fim de Expediente)"
  ];

  // Derived counts
  const total = solicitacoes.length;
  const pendentes = useMemo(() => solicitacoes.filter(s => s.status === "pendente").length, [solicitacoes]);
  const aprovadas = useMemo(() => solicitacoes.filter(s => s.status === "aprovado").length, [solicitacoes]);
  const rejeitadas = useMemo(() => solicitacoes.filter(s => s.status === "rejeitado").length, [solicitacoes]);

  // Filtered list
  const filteredList = useMemo(() => {
    return solicitacoes.filter(item => {
      const matchStatus = filterStatus === "todas" ? true : item.status === filterStatus;
      const term = search.toLowerCase().trim();
      const matchSearch =
        term === ""
          ? true
          : item.userName.toLowerCase().includes(term) ||
            item.matricula.toLowerCase().includes(term) ||
            item.motivo.toLowerCase().includes(term) ||
            item.data.includes(term);
      return matchStatus && matchSearch;
    });
  }, [solicitacoes, filterStatus, search]);

  const formatDate = (isoOrDateStr: string) => {
    try {
      if (isoOrDateStr.includes("T")) {
        const d = new Date(isoOrDateStr);
        return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      }
      // YYYY-MM-DD
      const [y, m, d] = isoOrDateStr.split("-");
      return `${d}/${m}/${y}`;
    } catch (_) {
      return isoOrDateStr;
    }
  };

  const handleApprove = async (id: string) => {
    setLoadingId(id);
    try {
      await onAprovar(id, effectiveUserName);
    } catch (err) {
      console.error("Erro ao aprovar solicitação:", err);
    } finally {
      setLoadingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalId) return;
    setLoadingId(rejectModalId);
    try {
      await onRejeitar(rejectModalId, rejectReason.trim() || "Não atende aos critérios", effectiveUserName);
      setRejectModalId(null);
      setRejectReason("");
    } catch (err) {
      console.error("Erro ao rejeitar solicitação:", err);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div style={{ padding: "16px 12px", boxSizing: "border-box", maxWidth: "100%" }}>
      {/* Banner */}
      <div
        style={{
          background: `linear-gradient(135deg, ${t.surfaceAlt}, ${t.surface})`,
          border: `1.5px solid ${t.border}`,
          borderRadius: 16,
          padding: "16px 18px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 14
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: t.accentGlow,
              border: `1.5px solid ${t.borderFocus}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}
          >
            <Clock size={28} color={t.accent} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: t.text }}>
              Fila de Aprovação de Correções de Ponto
            </h2>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: t.textSub, display: "block", marginTop: 3 }}>
              Analise e aprove as solicitações de ajuste enviadas pelos colaboradores. Ao aprovar, o ponto é inserido automaticamente no sistema.
            </span>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
            <span style={{ fontSize: 11, color: t.textMuted, display: "block", textTransform: "uppercase", fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: t.text }}>{total}</span>
          </div>

          <div style={{ background: t.warningBg, border: `1.5px solid ${t.warningBorder}`, borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
            <span style={{ fontSize: 11, color: t.warning, display: "block", textTransform: "uppercase", fontWeight: 700 }}>Pendentes</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: t.warning }}>{pendentes}</span>
          </div>

          <div style={{ background: t.successBg, border: `1.5px solid ${t.successBorder}`, borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
            <span style={{ fontSize: 11, color: t.success, display: "block", textTransform: "uppercase", fontWeight: 700 }}>Aprovadas</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: t.success }}>{aprovadas}</span>
          </div>

          <div style={{ background: t.dangerBg, border: `1.5px solid ${t.dangerBorder}`, borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
            <span style={{ fontSize: 11, color: t.danger, display: "block", textTransform: "uppercase", fontWeight: 700 }}>Rejeitadas</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: t.danger }}>{rejeitadas}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "pendente", label: `Pendentes (${pendentes})` },
            { id: "aprovado", label: `Aprovadas (${aprovadas})` },
            { id: "rejeitado", label: `Rejeitadas (${rejeitadas})` },
            { id: "todas", label: `Todas (${total})` }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id as any)}
              style={{
                background: filterStatus === f.id ? t.accent : t.surfaceAlt,
                color: filterStatus === f.id ? "#fff" : t.textSub,
                border: `1.5px solid ${filterStatus === f.id ? t.accent : t.border}`,
                borderRadius: 9,
                padding: "7px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.18s"
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", minWidth: 260 }}>
          <Search size={16} color={t.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por colaborador, matrícula..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: t.inputBg,
              border: `1.5px solid ${t.border}`,
              borderRadius: 9,
              color: t.text,
              fontSize: 13,
              padding: "8px 12px 8px 36px",
              outline: "none"
            }}
          />
        </div>
      </div>

      {/* Content List */}
      {filteredList.length === 0 ? (
        <div
          style={{
            background: t.surface,
            border: `1.5px dashed ${t.border}`,
            borderRadius: 14,
            padding: "48px 24px",
            textAlign: "center",
            color: t.textMuted
          }}
        >
          <Clock size={48} color={t.textMuted} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: t.text }}>
            Nenhuma solicitação encontrada
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: t.textSub }}>
            {search ? "Nenhum resultado corresponde aos filtros informados." : "Não há solicitações pendentes de correção no momento."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filteredList.map((item) => (
            <div
              key={item.id}
              style={{
                background: t.surface,
                border: `1.5px solid ${item.status === "pendente" ? t.warningBorder : t.border}`,
                borderRadius: 14,
                padding: "14px 16px",
                boxShadow: `0 2px 8px ${t.shadow}`,
                transition: "all 0.2s"
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 12,
                  paddingBottom: 10,
                  borderBottom: `1px solid ${t.border}`
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: t.text }}>
                    {item.userName} <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>(Matrícula: {item.matricula})</span>
                  </h4>
                  <span style={{ fontSize: 11.5, color: t.textMuted, display: "block", marginTop: 2 }}>
                    Enviado em {formatDate(item.criadoEm)}
                  </span>
                </div>

                <div>
                  {item.status === "pendente" && (
                    <Tag label="Pendente de Aprovação" color={t.warning} bg={t.warningBg} border={t.warningBorder} />
                  )}
                  {item.status === "aprovado" && (
                    <Tag label="Aprovado" color={t.success} bg={t.successBg} border={t.successBorder} />
                  )}
                  {item.status === "rejeitado" && (
                    <Tag label="Rejeitado" color={t.danger} bg={t.dangerBg} border={t.dangerBorder} />
                  )}
                </div>
              </div>

              {/* Details grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: 12,
                  marginBottom: 14,
                  background: t.surfaceAlt,
                  border: `1px solid ${t.border}`,
                  borderRadius: 10,
                  padding: "12px 14px"
                }}
              >
                <div>
                  <span style={{ fontSize: 11, color: t.textMuted, textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                    📅 Data do Ponto
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                    {formatDate(item.data)}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: t.textMuted, textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                    ⏰ Horário Solicitado
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: t.accent }}>
                    {item.hora} hs
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: t.textMuted, textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                    📌 Tipo de Batida
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                    {slotNames[item.slotIdx] || `Batida #${item.slotIdx + 1}`}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: t.textMuted, textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                    📍 Geolocalização (GPS)
                  </span>
                  {item.latitude !== null && item.longitude !== null && item.latitude !== undefined && item.longitude !== undefined ? (
                    <a
                      href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: t.success,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        textDecoration: "underline",
                        marginTop: 2
                      }}
                    >
                      <MapPin size={13} color={t.success} />
                      {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)} <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span style={{ fontSize: 12, color: t.textMuted, marginTop: 2, display: "block" }}>
                      Sem GPS gravado
                    </span>
                  )}
                </div>
              </div>

              {/* Motivo */}
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.textSub, display: "block", marginBottom: 4 }}>
                  Motivo / Justificativa informada:
                </span>
                <div style={{ fontSize: 13.5, color: t.text, lineHeight: 1.5, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 8, padding: "10px 12px" }}>
                  "{item.motivo}"
                </div>
              </div>

              {/* Review feedback if processed */}
              {item.status !== "pendente" && (
                <div style={{ marginBottom: 14, fontSize: 12, color: t.textSub }}>
                  <strong>Revisado por:</strong> {item.revisadoPor || "Gestor"} em {item.revisadoEm ? formatDate(item.revisadoEm) : "-"}
                  {item.motivoRejeicao && (
                    <div style={{ color: t.danger, marginTop: 4, fontWeight: 600 }}>
                      Motivo da Recusa: {item.motivoRejeicao}
                    </div>
                  )}
                </div>
              )}

              {/* Actions Footer */}
              {item.status === "pendente" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 10,
                    paddingTop: 10,
                    borderTop: `1px solid ${t.border}`
                  }}
                >
                  <Btn
                    t={t}
                    small
                    variant="danger"
                    disabled={loadingId === item.id}
                    onClick={() => {
                      setRejectModalId(item.id);
                      setRejectReason("");
                    }}
                  >
                    <XCircle size={15} /> Rejeitar
                  </Btn>

                  <Btn
                    t={t}
                    small
                    variant="success"
                    disabled={loadingId === item.id}
                    onClick={() => handleApprove(item.id)}
                  >
                    <CheckCircle2 size={15} /> {loadingId === item.id ? "Aprovando..." : "Aprovar & Inserir Ponto"}
                  </Btn>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModalId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
        >
          <div
            style={{
              background: t.surface,
              border: `1.5px solid ${t.border}`,
              borderRadius: 14,
              padding: 24,
              maxWidth: 420,
              width: "100%",
              boxShadow: `0 10px 30px ${t.shadow}`
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: t.danger, marginBottom: 12 }}>
              <XCircle size={22} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Rejeitar Solicitação de Ponto</h3>
            </div>
            <p style={{ fontSize: 13, color: t.textSub, margin: "0 0 14px", lineHeight: 1.4 }}>
              Informe o motivo da recusa para que o colaborador possa ser notificado:
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Ex.: Incompatível com os registros de acesso / falta comprovante..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: t.inputBg,
                border: `1.5px solid ${t.border}`,
                borderRadius: 8,
                padding: 10,
                fontSize: 13,
                color: t.text,
                outline: "none",
                marginBottom: 18,
                fontFamily: "inherit"
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn
                t={t}
                variant="ghost"
                onClick={() => setRejectModalId(null)}
                disabled={loadingId === rejectModalId}
              >
                Cancelar
              </Btn>
              <Btn
                t={t}
                variant="danger"
                onClick={handleConfirmReject}
                disabled={loadingId === rejectModalId}
              >
                {loadingId === rejectModalId ? "Rejeitando..." : "Confirmar Recusa"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
