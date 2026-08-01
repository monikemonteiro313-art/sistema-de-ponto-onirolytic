import React, { useState, useMemo } from "react";
import { ShieldAlert, Lock, Search, Filter, CheckCircle2, Clock, FileText, Trash2, Eye, X, MessageSquare, AlertTriangle, ArrowRight, ShieldCheck, Image as ImageIcon } from "lucide-react";
import { ThemeColors, Denuncia } from "../types";
import { Btn, Tag } from "./SharedUI";

interface DenunciasViewProps {
  t: ThemeColors;
  denuncias: Denuncia[];
  onUpdateStatus: (id: string, status: Denuncia["status"], respostaAdm?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function DenunciasView({ t, denuncias = [], onUpdateStatus, onDelete }: DenunciasViewProps) {
  const [filterStatus, setFilterStatus] = useState<"todas" | "pendente" | "em_analise" | "resolvido" | "arquivado">("todas");
  const [search, setSearch] = useState("");
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const [editingResponseId, setEditingResponseId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Derived Statistics
  const total = denuncias.length;
  const pendentes = useMemo(() => denuncias.filter(d => d.status === "pendente").length, [denuncias]);
  const emAnalise = useMemo(() => denuncias.filter(d => d.status === "em_analise").length, [denuncias]);
  const resolvidos = useMemo(() => denuncias.filter(d => d.status === "resolvido").length, [denuncias]);
  const arquivados = useMemo(() => denuncias.filter(d => d.status === "arquivado").length, [denuncias]);

  // Filtered List
  const filteredList = useMemo(() => {
    return denuncias.filter(item => {
      const matchStatus = filterStatus === "todas" ? true : item.status === filterStatus;
      const matchSearch = search.trim() === "" ? true : item.texto.toLowerCase().includes(search.toLowerCase()) || (item.respostaAdm && item.respostaAdm.toLowerCase().includes(search.toLowerCase()));
      return matchStatus && matchSearch;
    });
  }, [denuncias, filterStatus, search]);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (_) {
      return isoString;
    }
  };

  const handleStatusChange = async (id: string, newStatus: Denuncia["status"]) => {
    setLoadingId(id);
    try {
      await onUpdateStatus(id, newStatus);
    } catch (e) {
      console.error("Erro ao atualizar status:", e);
    } finally {
      setLoadingId(null);
    }
  };

  const handleSaveResponse = async (id: string) => {
    setLoadingId(id);
    try {
      const current = denuncias.find(d => d.id === id);
      const currentStatus = current ? current.status : "em_analise";
      await onUpdateStatus(id, currentStatus, responseText);
      setEditingResponseId(null);
      setResponseText("");
    } catch (e) {
      console.error("Erro ao salvar resposta:", e);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDeleteItem = async (id: string) => {
    setLoadingId(id);
    try {
      await onDelete(id);
      setConfirmDeleteId(null);
    } catch (e) {
      console.error("Erro ao excluir denúncia:", e);
    } finally {
      setLoadingId(null);
    }
  };

  const getStatusBadge = (status: Denuncia["status"]) => {
    switch (status) {
      case "pendente":
        return <Tag label="Pendente" color={t.warning} bg={t.warningBg} border={t.warningBorder} />;
      case "em_analise":
        return <Tag label="Em Análise" color="#2563EB" bg="#EFF6FF" border="#BFDBFE" />;
      case "resolvido":
        return <Tag label="Resolvido" color={t.success} bg={t.successBg} border={t.successBorder} />;
      case "arquivado":
        return <Tag label="Arquivado" color={t.textMuted} bg={t.surfaceAlt} border={t.border} />;
      default:
        return <Tag label={status} color={t.textSub} bg={t.surfaceAlt} border={t.border} />;
    }
  };

  return (
    <div style={{ padding: "20px 24px" }}>
      {/* Top Banner Header */}
      <div
        style={{
          background: `linear-gradient(135deg, ${t.surfaceAlt}, ${t.surface})`,
          border: `1.5px solid ${t.border}`,
          borderRadius: 14,
          padding: "20px 24px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: t.warningBg,
              border: `1.5px solid ${t.warningBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}
          >
            <ShieldAlert size={28} color={t.warning} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: t.text }}>
              Guia de Denúncias de Irregularidades
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Lock size={13} color={t.success} />
              <span style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>
                Registros estritamente anônimos recebidos sem rastreamento de matrícula, IP ou GPS.
              </span>
            </div>
          </div>
        </div>

        {/* Stats Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
            <span style={{ fontSize: 11, color: t.textMuted, display: "block", textTransform: "uppercase", fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: t.text }}>{total}</span>
          </div>

          <div style={{ background: t.warningBg, border: `1.5px solid ${t.warningBorder}`, borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
            <span style={{ fontSize: 11, color: t.warning, display: "block", textTransform: "uppercase", fontWeight: 700 }}>Pendentes</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: t.warning }}>{pendentes}</span>
          </div>

          <div style={{ background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
            <span style={{ fontSize: 11, color: "#2563EB", display: "block", textTransform: "uppercase", fontWeight: 700 }}>Em Análise</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#2563EB" }}>{emAnalise}</span>
          </div>

          <div style={{ background: t.successBg, border: `1.5px solid ${t.successBorder}`, borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
            <span style={{ fontSize: 11, color: t.success, display: "block", textTransform: "uppercase", fontWeight: 700 }}>Resolvidos</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: t.success }}>{resolvidos}</span>
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
        {/* Status Tabs Filter */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "todas", label: `Todas (${total})` },
            { id: "pendente", label: `Pendentes (${pendentes})` },
            { id: "em_analise", label: `Em Análise (${emAnalise})` },
            { id: "resolvido", label: `Resolvidas (${resolvidos})` },
            { id: "arquivado", label: `Arquivadas (${arquivados})` }
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

        {/* Search input */}
        <div style={{ position: "relative", minWidth: 260 }}>
          <Search size={16} color={t.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nas denúncias..."
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

      {/* Reports List */}
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
          <ShieldCheck size={48} color={t.textMuted} style={{ margin: "0 auto 12px", opacity: 0.6 }} />
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: t.text }}>
            Nenhuma denúncia encontrada
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: t.textSub }}>
            {search ? "Nenhum resultado corresponde à sua pesquisa." : "Nenhuma denúncia foi registrada nesta categoria até o momento."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {filteredList.map((item) => (
            <div
              key={item.id}
              style={{
                background: t.surface,
                border: `1.5px solid ${t.border}`,
                borderRadius: 14,
                padding: "20px 22px",
                boxShadow: `0 2px 8px ${t.shadow}`,
                transition: "all 0.2s"
              }}
            >
              {/* Header Row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 14,
                  paddingBottom: 12,
                  borderBottom: `1px solid ${t.border}`
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: t.textSub }}>
                    <Clock size={14} color={t.textMuted} />
                    <span>{formatDate(item.criadoEm)}</span>
                  </div>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: t.success,
                      background: t.successBg,
                      border: `1px solid ${t.successBorder}`,
                      borderRadius: 99,
                      padding: "2px 8px"
                    }}
                  >
                    <Lock size={10} color={t.success} /> 100% ANÔNIMO
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {getStatusBadge(item.status)}
                </div>
              </div>

              {/* Main Content Body */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, color: t.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {item.texto}
                </div>
              </div>

              {/* Attached Photo Preview */}
              {item.fotoUrl && (
                <div style={{ marginBottom: 18 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: t.textSub, display: "block", marginBottom: 6 }}>
                    📷 Anexo / Foto de Evidência:
                  </span>
                  <div
                    style={{
                      position: "relative",
                      display: "inline-block",
                      borderRadius: 10,
                      overflow: "hidden",
                      border: `1.5px solid ${t.border}`,
                      background: "#000",
                      cursor: "pointer"
                    }}
                    onClick={() => setExpandedPhoto(item.fotoUrl || null)}
                  >
                    <img
                      src={item.fotoUrl}
                      alt="Evidência anexada"
                      style={{ maxHeight: 180, maxWidth: "100%", objectFit: "contain", display: "block" }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(0,0,0,0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: 0,
                        transition: "opacity 0.2s",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 12,
                        gap: 6
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = "0"; }}
                    >
                      <Eye size={16} /> Expandir Foto
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Response / Notes Section */}
              {item.respostaAdm && editingResponseId !== item.id && (
                <div
                  style={{
                    background: t.surfaceAlt,
                    border: `1.5px solid ${t.border}`,
                    borderRadius: 10,
                    padding: "12px 16px",
                    marginBottom: 16
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.accent, display: "flex", alignItems: "center", gap: 5 }}>
                      <MessageSquare size={14} /> Resposta / Parecer da Administração:
                    </span>
                    <button
                      onClick={() => {
                        setEditingResponseId(item.id);
                        setResponseText(item.respostaAdm || "");
                      }}
                      style={{ background: "none", border: "none", color: t.textSub, fontSize: 11.5, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                    >
                      Editar
                    </button>
                  </div>
                  <div style={{ fontSize: 13, color: t.text, lineHeight: 1.5 }}>
                    {item.respostaAdm}
                  </div>
                  {item.atualizadoEm && (
                    <span style={{ fontSize: 10.5, color: t.textMuted, display: "block", marginTop: 4 }}>
                      Atualizado em: {formatDate(item.atualizadoEm)}
                    </span>
                  )}
                </div>
              )}

              {/* Editing Response Form */}
              {editingResponseId === item.id && (
                <div
                  style={{
                    background: t.surfaceAlt,
                    border: `1.5px solid ${t.accent}`,
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 16
                  }}
                >
                  <label style={{ fontSize: 12, fontWeight: 700, color: t.accent, display: "block", marginBottom: 6 }}>
                    Registrar Parecer Interno / Resposta do ADM:
                  </label>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    rows={3}
                    placeholder="Escreva providências tomadas ou observações internas..."
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
                      marginBottom: 10
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <Btn
                      t={t}
                      small
                      variant="ghost"
                      onClick={() => {
                        setEditingResponseId(null);
                        setResponseText("");
                      }}
                    >
                      Cancelar
                    </Btn>
                    <Btn
                      t={t}
                      small
                      variant="primary"
                      onClick={() => handleSaveResponse(item.id)}
                      disabled={loadingId === item.id}
                    >
                      Salvar Parecer
                    </Btn>
                  </div>
                </div>
              )}

              {/* Actions Toolbar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                  paddingTop: 12,
                  borderTop: `1px solid ${t.border}`
                }}
              >
                {/* Status Switcher */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: t.textMuted }}>Mudar status:</span>
                  
                  {item.status !== "pendente" && (
                    <button
                      onClick={() => handleStatusChange(item.id, "pendente")}
                      disabled={loadingId === item.id}
                      style={{
                        background: t.warningBg,
                        color: t.warning,
                        border: `1px solid ${t.warningBorder}`,
                        borderRadius: 7,
                        padding: "4px 9px",
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      Pendente
                    </button>
                  )}

                  {item.status !== "em_analise" && (
                    <button
                      onClick={() => handleStatusChange(item.id, "em_analise")}
                      disabled={loadingId === item.id}
                      style={{
                        background: "#EFF6FF",
                        color: "#2563EB",
                        border: "1px solid #BFDBFE",
                        borderRadius: 7,
                        padding: "4px 9px",
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      Em Análise
                    </button>
                  )}

                  {item.status !== "resolvido" && (
                    <button
                      onClick={() => handleStatusChange(item.id, "resolvido")}
                      disabled={loadingId === item.id}
                      style={{
                        background: t.successBg,
                        color: t.success,
                        border: `1px solid ${t.successBorder}`,
                        borderRadius: 7,
                        padding: "4px 9px",
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      Resolvido
                    </button>
                  )}

                  {item.status !== "arquivado" && (
                    <button
                      onClick={() => handleStatusChange(item.id, "arquivado")}
                      disabled={loadingId === item.id}
                      style={{
                        background: t.surfaceAlt,
                        color: t.textSub,
                        border: `1px solid ${t.border}`,
                        borderRadius: 7,
                        padding: "4px 9px",
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      Arquivar
                    </button>
                  )}
                </div>

                {/* Response / Delete Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {!item.respostaAdm && editingResponseId !== item.id && (
                    <Btn
                      t={t}
                      small
                      variant="ghost"
                      onClick={() => {
                        setEditingResponseId(item.id);
                        setResponseText("");
                      }}
                    >
                      <MessageSquare size={13} /> Adicionar Parecer
                    </Btn>
                  )}

                  <button
                    onClick={() => setConfirmDeleteId(item.id)}
                    title="Excluir denúncia"
                    style={{
                      background: t.dangerBg,
                      border: `1.5px solid ${t.dangerBorder}`,
                      color: t.danger,
                      borderRadius: 7,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expanded Photo Lightbox Modal */}
      {expandedPhoto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            background: "rgba(0,0,0,0.88)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24
          }}
          onClick={() => setExpandedPhoto(null)}
        >
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            <img
              src={expandedPhoto}
              alt="Foto da denúncia ampliada"
              style={{ maxWidth: "100%", maxHeight: "85vh", objectFit: "contain", borderRadius: 12, border: "2px solid rgba(255,255,255,0.2)" }}
            />
            <button
              onClick={() => setExpandedPhoto(null)}
              style={{
                position: "absolute",
                top: -16,
                right: -16,
                background: t.accent,
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: 36,
                height: 36,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            background: "rgba(0,0,0,0.7)",
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
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Excluir Denúncia</h3>
            </div>
            <p style={{ fontSize: 13.5, color: t.textSub, margin: "0 0 20px", lineHeight: 1.5 }}>
              Tem certeza que deseja remover esta denúncia permanentemente? Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn
                t={t}
                variant="ghost"
                onClick={() => setConfirmDeleteId(null)}
                disabled={loadingId === confirmDeleteId}
              >
                Cancelar
              </Btn>
              <Btn
                t={t}
                variant="danger"
                onClick={() => handleDeleteItem(confirmDeleteId)}
                disabled={loadingId === confirmDeleteId}
              >
                {loadingId === confirmDeleteId ? "Excluindo..." : "Confirmar Exclusão"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
