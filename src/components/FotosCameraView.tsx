import React, { useState, useMemo } from "react";
import { Camera, Search, Filter, Eye, Download, Calendar, User as UserIcon, MapPin, Image as ImageIcon, Grid, List, Info, CheckCircle2, RefreshCw } from "lucide-react";
import { ThemeColors, User, PontosGlobal, Batida } from "../types";
import { Paginacao } from "./Paginacao";

export interface CameraPunchItem {
  id: string;
  userId: number;
  userName: string;
  userMatricula: string;
  dayKey: string; // "YYYY-MM-DD"
  slotIdx: number; // 0, 1, 2, 3
  punch: Batida;
  fotoUrl: string;
  tipoFoto: "selfie" | "atestado";
}

interface FotosCameraViewProps {
  t: ThemeColors;
  users: User[];
  pontosGlobal: PontosGlobal;
  onRefresh?: () => void;
  isSyncing?: boolean;
}

const slotLabels = ["1ª Entrada", "1ª Saída (Almoço)", "2ª Entrada (Retorno)", "2ª Saída"];

export function FotosCameraView({ t, users, pontosGlobal, onRefresh, isSyncing }: FotosCameraViewProps) {
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>(""); // YYYY-MM
  const [selectedTipoFoto, setSelectedTipoFoto] = useState<"todos" | "selfie" | "atestado">("todos");
  const [selectedSlot, setSelectedSlot] = useState<string>("todos");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [expandedItem, setExpandedItem] = useState<CameraPunchItem | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Extract all camera punches from pontosGlobal
  const allCameraPunches = useMemo(() => {
    const items: CameraPunchItem[] = [];
    if (!pontosGlobal) return items;

    const userMap = new Map<number, User>();
    (users || []).forEach(u => {
      if (u && typeof u.id === "number") {
        userMap.set(u.id, u);
      }
    });

    Object.entries(pontosGlobal).forEach(([userIdStr, userDays]) => {
      const userId = Number(userIdStr);
      const user = userMap.get(userId);
      const userName = user?.nome || `Colaborador #${userId}`;
      const userMatricula = user?.matricula || "—";

      if (!userDays) return;

      Object.entries(userDays).forEach(([dayKey, dayArray]) => {
        if (!Array.isArray(dayArray)) return;

        dayArray.forEach((punch, slotIdx) => {
          if (!punch) return;

          // Selfie photo
          if (punch.fotoComprovante && typeof punch.fotoComprovante === "string" && punch.fotoComprovante.length > 20) {
            items.push({
              id: `${userId}_${dayKey}_${slotIdx}_selfie`,
              userId,
              userName,
              userMatricula,
              dayKey,
              slotIdx,
              punch,
              fotoUrl: punch.fotoComprovante,
              tipoFoto: "selfie"
            });
          }

          // Atestado photo
          if (punch.fotoAtestado && typeof punch.fotoAtestado === "string" && punch.fotoAtestado.length > 20) {
            items.push({
              id: `${userId}_${dayKey}_${slotIdx}_atestado`,
              userId,
              userName,
              userMatricula,
              dayKey,
              slotIdx,
              punch,
              fotoUrl: punch.fotoAtestado,
              tipoFoto: "atestado"
            });
          }
        });
      });
    });

    // Sort descending by registration date/time or dayKey
    return items.sort((a, b) => {
      const timeA = a.punch.registradoEm || a.punch.hora || `${a.dayKey}T00:00:00`;
      const timeB = b.punch.registradoEm || b.punch.hora || `${b.dayKey}T00:00:00`;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });
  }, [pontosGlobal, users]);

  // Apply filters
  const filteredPunches = useMemo(() => {
    return allCameraPunches.filter(item => {
      // Search term
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = item.userName.toLowerCase().includes(q);
        const matchMat = item.userMatricula.toLowerCase().includes(q);
        const matchDay = item.dayKey.includes(q);
        if (!matchName && !matchMat && !matchDay) return false;
      }

      // Month filter
      if (selectedMonth) {
        if (!item.dayKey.startsWith(selectedMonth)) return false;
      }

      // Photo type filter
      if (selectedTipoFoto !== "todos") {
        if (item.tipoFoto !== selectedTipoFoto) return false;
      }

      // Slot filter
      if (selectedSlot !== "todos") {
        if (item.slotIdx !== Number(selectedSlot)) return false;
      }

      return true;
    });
  }, [allCameraPunches, search, selectedMonth, selectedTipoFoto, selectedSlot]);

  // Pagination
  const totalPages = Math.ceil(filteredPunches.length / pageSize) || 1;
  const paginatedPunches = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPunches.slice(start, start + pageSize);
  }, [filteredPunches, page, pageSize]);

  // Helper download function
  const downloadPhoto = (fotoUrl: string, filename: string) => {
    try {
      const a = document.createElement("a");
      a.href = fotoUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Erro ao baixar foto:", err);
      window.open(fotoUrl, "_blank");
    }
  };

  // Helper date formatting
  const formatDateBR = (dayKey: string) => {
    if (!dayKey || !dayKey.includes("-")) return dayKey;
    const [yyyy, mm, dd] = dayKey.split("-");
    return `${dd}/${mm}/${yyyy}`;
  };

  // Helper time formatting
  const formatTime = (punch: Batida) => {
    if (punch.hora) {
      if (punch.hora.includes("T")) {
        const d = new Date(punch.hora);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        }
      } else {
        return punch.hora;
      }
    }
    if (punch.registradoEm) {
      const d = new Date(punch.registradoEm);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      }
    }
    return "—";
  };

  const totalSelfies = allCameraPunches.filter(i => i.tipoFoto === "selfie").length;
  const totalAtestados = allCameraPunches.filter(i => i.tipoFoto === "atestado").length;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1120, margin: "0 auto" }}>
      {/* Top Banner Info */}
      <div
        style={{
          background: t.surfaceAlt,
          border: `1.5px solid ${t.border}`,
          borderRadius: 14,
          padding: "16px 20px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${t.accent}, #10B981)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)"
            }}
          >
            <Camera size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: t.text }}>
              Gestão e Controle de Pontos com Câmera
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: t.textMuted }}>
              Monitoramento visual de selfies de comprovação e fotos anexadas no registro de ponto.
            </p>
          </div>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isSyncing}
            style={{
              background: t.surface,
              border: `1.5px solid ${t.border}`,
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: "12.5px",
              fontWeight: 600,
              color: t.text,
              cursor: isSyncing ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <RefreshCw size={14} style={{ animation: isSyncing ? "spin 1s linear infinite" : "none" }} />
            <span>{isSyncing ? "Atualizando..." : "Atualizar Fotos"}</span>
          </button>
        )}
      </div>

      {/* Notice Banner (ReadOnly) */}
      <div
        style={{
          background: "rgba(16, 185, 129, 0.08)",
          border: "1.5px solid rgba(16, 185, 129, 0.25)",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 10
        }}
      >
        <Info size={18} color="#10B981" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: t.text, lineHeight: 1.4 }}>
          <strong>Painel de Exibição / Leitura:</strong> As fotos são gravadas e associadas automaticamente às batidas. Não é necessária aprovação manual. Clique em qualquer imagem para ampliá-la ou fazer download em alta resolução.
        </span>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
          marginBottom: 24
        }}
      >
        <div
          style={{
            background: t.surface,
            border: `1.5px solid ${t.border}`,
            borderRadius: 12,
            padding: "16px 18px",
            boxShadow: `0 2px 8px ${t.shadow}`
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>Total de Fotos</span>
            <ImageIcon size={16} color={t.accent} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: t.text }}>
            {allCameraPunches.length}
          </div>
          <span style={{ fontSize: 11, color: t.textSub }}>Registros com câmera salvos</span>
        </div>

        <div
          style={{
            background: t.surface,
            border: `1.5px solid ${t.border}`,
            borderRadius: 12,
            padding: "16px 18px",
            boxShadow: `0 2px 8px ${t.shadow}`
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>Selfies do Ponto</span>
            <Camera size={16} color="#10B981" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#10B981" }}>
            {totalSelfies}
          </div>
          <span style={{ fontSize: 11, color: t.textSub }}>Comprovação de presença</span>
        </div>

        <div
          style={{
            background: t.surface,
            border: `1.5px solid ${t.border}`,
            borderRadius: 12,
            padding: "16px 18px",
            boxShadow: `0 2px 8px ${t.shadow}`
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>Fotos de Atestados</span>
            <CheckCircle2 size={16} color="#F59E0B" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#F59E0B" }}>
            {totalAtestados}
          </div>
          <span style={{ fontSize: 11, color: t.textSub }}>Documentos médicos</span>
        </div>

        <div
          style={{
            background: t.surface,
            border: `1.5px solid ${t.border}`,
            borderRadius: 12,
            padding: "16px 18px",
            boxShadow: `0 2px 8px ${t.shadow}`
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>Filtradas na Busca</span>
            <Filter size={16} color={t.accent} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: t.text }}>
            {filteredPunches.length}
          </div>
          <span style={{ fontSize: 11, color: t.textSub }}>Resultados exibidos</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div
        style={{
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          borderRadius: 12,
          padding: "16px 18px",
          marginBottom: 20,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", flex: 1 }}>
          {/* Search Input */}
          <div style={{ position: "relative", minWidth: 220, flex: "1 1 220px" }}>
            <Search size={14} color={t.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Buscar colaborador ou data..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{
                width: "100%",
                background: t.surfaceAlt,
                border: `1.5px solid ${t.border}`,
                borderRadius: 8,
                padding: "8px 12px 8px 34px",
                fontSize: "13px",
                color: t.text,
                outline: "none",
                fontFamily: "inherit"
              }}
            />
          </div>

          {/* Month Filter */}
          <input
            type="month"
            value={selectedMonth}
            onChange={e => { setSelectedMonth(e.target.value); setPage(1); }}
            style={{
              background: t.surfaceAlt,
              border: `1.5px solid ${t.border}`,
              borderRadius: 8,
              padding: "7px 12px",
              fontSize: "13px",
              color: t.text,
              outline: "none",
              fontFamily: "inherit"
            }}
          />

          {/* Type Filter */}
          <select
            value={selectedTipoFoto}
            onChange={e => { setSelectedTipoFoto(e.target.value as any); setPage(1); }}
            style={{
              background: t.surfaceAlt,
              border: `1.5px solid ${t.border}`,
              borderRadius: 8,
              padding: "7px 12px",
              fontSize: "13px",
              color: t.text,
              outline: "none",
              fontFamily: "inherit",
              cursor: "pointer"
            }}
          >
            <option value="todos">Todos os Tipos de Foto</option>
            <option value="selfie">📸 Selfies de Ponto</option>
            <option value="atestado">📄 Fotos de Atestados</option>
          </select>

          {/* Slot Filter */}
          <select
            value={selectedSlot}
            onChange={e => { setSelectedSlot(e.target.value); setPage(1); }}
            style={{
              background: t.surfaceAlt,
              border: `1.5px solid ${t.border}`,
              borderRadius: 8,
              padding: "7px 12px",
              fontSize: "13px",
              color: t.text,
              outline: "none",
              fontFamily: "inherit",
              cursor: "pointer"
            }}
          >
            <option value="todos">Todas as Batidas</option>
            <option value="0">1ª Entrada</option>
            <option value="1">1ª Saída (Almoço)</option>
            <option value="2">2ª Entrada (Retorno)</option>
            <option value="3">2ª Saída</option>
          </select>
        </div>

        {/* View Mode Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: t.surfaceAlt, padding: 3, borderRadius: 8, border: `1px solid ${t.border}` }}>
          <button
            onClick={() => setViewMode("grid")}
            title="Visualização em Grade de Cards"
            style={{
              background: viewMode === "grid" ? t.surface : "transparent",
              color: viewMode === "grid" ? t.accent : t.textMuted,
              border: "none",
              borderRadius: 6,
              padding: "6px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              fontWeight: 600
            }}
          >
            <Grid size={14} /> Cards
          </button>
          <button
            onClick={() => setViewMode("table")}
            title="Visualização em Tabela Analítica"
            style={{
              background: viewMode === "table" ? t.surface : "transparent",
              color: viewMode === "table" ? t.accent : t.textMuted,
              border: "none",
              borderRadius: 6,
              padding: "6px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              fontWeight: 600
            }}
          >
            <List size={14} /> Tabela
          </button>
        </div>
      </div>

      {/* Content Section */}
      {filteredPunches.length === 0 ? (
        <div
          style={{
            background: t.surface,
            border: `1.5px dashed ${t.border}`,
            borderRadius: 14,
            padding: "48px 20px",
            textAlign: "center"
          }}
        >
          <Camera size={40} color={t.textMuted} style={{ marginBottom: 12, opacity: 0.6 }} />
          <h3 style={{ margin: "0 0 6px", fontSize: 16, color: t.text, fontWeight: 700 }}>
            Nenhum registro de foto encontrado
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: t.textMuted }}>
            {allCameraPunches.length === 0
              ? "Ainda não existem batidas registradas com foto ou selfie no sistema."
              : "Tente alterar os filtros de busca para visualizar outros registros."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: 16,
            marginBottom: 24
          }}
        >
          {paginatedPunches.map((item, idx) => (
            <div
              key={`${item.id}_${idx}`}
              style={{
                background: t.surface,
                border: `1.5px solid ${t.border}`,
                borderRadius: 12,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: `0 2px 8px ${t.shadow}`,
                transition: "transform 0.2s, box-shadow 0.2s"
              }}
            >
              {/* Photo Thumbnail Container */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: 200,
                  background: "#000",
                  cursor: "pointer",
                  overflow: "hidden"
                }}
                onClick={() => setExpandedItem(item)}
              >
                <img
                  src={item.fotoUrl}
                  alt={`Foto de ${item.userName}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transition: "transform 0.3s ease"
                  }}
                />

                {/* Badge Top Left (Type) */}
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    background: item.tipoFoto === "selfie" ? "rgba(16, 185, 129, 0.9)" : "rgba(245, 158, 11, 0.9)",
                    backdropFilter: "blur(4px)",
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  {item.tipoFoto === "selfie" ? (
                    <>
                      <Camera size={12} /> Selfie
                    </>
                  ) : (
                    <>
                      <ImageIcon size={12} /> Atestado
                    </>
                  )}
                </div>

                {/* Badge Top Right (Slot) */}
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    background: "rgba(0, 0, 0, 0.75)",
                    backdropFilter: "blur(4px)",
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: 6
                  }}
                >
                  {slotLabels[item.slotIdx] || `Batida #${item.slotIdx + 1}`}
                </div>

                {/* Expand Overlay Hint */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 10,
                    right: 10,
                    background: "rgba(0,0,0,0.65)",
                    color: "#fff",
                    borderRadius: 6,
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <Eye size={12} /> Expandir
                </div>
              </div>

              {/* Card Footer Details */}
              <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                      {item.userName}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <UserIcon size={12} />
                    <span>Matrícula: {item.userMatricula}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: t.text, marginBottom: 8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: t.surfaceAlt, padding: "3px 8px", borderRadius: 6, border: `1px solid ${t.border}` }}>
                      <Calendar size={12} color={t.accent} />
                      {formatDateBR(item.dayKey)}
                    </span>
                    <span style={{ fontWeight: 700, color: t.accent }}>
                      ⏰ {formatTime(item.punch)}
                    </span>
                  </div>

                  {/* GPS Info */}
                  {item.punch.latitude && item.punch.longitude ? (
                    <div style={{ fontSize: 11, color: "#10B981", display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
                      <MapPin size={12} />
                      <span>GPS: {item.punch.latitude.toFixed(4)}, {item.punch.longitude.toFixed(4)}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: t.textMuted, display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
                      <Camera size={12} />
                      <span>Comprovação via Foto</span>
                    </div>
                  )}

                  {item.punch.obs && (
                    <div style={{ fontSize: 11, color: t.textSub, background: t.surfaceAlt, padding: "6px 8px", borderRadius: 6, border: `1px solid ${t.border}`, fontStyle: "italic" }}>
                      "{item.punch.obs}"
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => setExpandedItem(item)}
                    style={{
                      flex: 1,
                      background: t.accentGlow,
                      border: `1.5px solid ${t.accent}`,
                      color: t.accent,
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4
                    }}
                  >
                    <Eye size={13} /> Visualizar
                  </button>
                  <button
                    onClick={() => downloadPhoto(item.fotoUrl, `ponto_${item.tipoFoto}_${item.userMatricula}_${item.dayKey}.jpg`)}
                    title="Baixar Foto"
                    style={{
                      background: t.surfaceAlt,
                      border: `1.5px solid ${t.border}`,
                      color: t.text,
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Download size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div
          style={{
            background: t.surface,
            border: `1.5px solid ${t.border}`,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: `0 2px 8px ${t.shadow}`,
            marginBottom: 24
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: t.surfaceAlt, borderBottom: `1.5px solid ${t.border}`, textAlign: "left" }}>
                  <th style={{ padding: "12px 16px", color: t.textMuted, fontWeight: 700 }}>Miniatura</th>
                  <th style={{ padding: "12px 16px", color: t.textMuted, fontWeight: 700 }}>Colaborador</th>
                  <th style={{ padding: "12px 16px", color: t.textMuted, fontWeight: 700 }}>Data e Hora</th>
                  <th style={{ padding: "12px 16px", color: t.textMuted, fontWeight: 700 }}>Batida / Tipo</th>
                  <th style={{ padding: "12px 16px", color: t.textMuted, fontWeight: 700 }}>Localização / GPS</th>
                  <th style={{ padding: "12px 16px", color: t.textMuted, fontWeight: 700, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPunches.map((item, idx) => (
                  <tr
                    key={`${item.id}_${idx}`}
                    style={{
                      borderBottom: `1px solid ${t.border}`,
                      background: idx % 2 === 0 ? "transparent" : t.surfaceAlt
                    }}
                  >
                    <td style={{ padding: "10px 16px" }}>
                      <div
                        onClick={() => setExpandedItem(item)}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 8,
                          overflow: "hidden",
                          background: "#000",
                          cursor: "pointer",
                          border: `1px solid ${t.border}`
                        }}
                      >
                        <img src={item.fotoUrl} alt="Thumbnail" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ fontWeight: 700, color: t.text }}>{item.userName}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>Matrícula: {item.userMatricula}</div>
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ fontWeight: 600, color: t.text }}>{formatDateBR(item.dayKey)}</div>
                      <div style={{ fontSize: 12, color: t.accent, fontWeight: 700 }}>{formatTime(item.punch)}</div>
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>
                        {slotLabels[item.slotIdx] || `Slot #${item.slotIdx + 1}`}
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: item.tipoFoto === "selfie" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                          color: item.tipoFoto === "selfie" ? "#10B981" : "#F59E0B",
                          display: "inline-block",
                          marginTop: 2
                        }}
                      >
                        {item.tipoFoto === "selfie" ? "Selfie Ponto" : "Foto Atestado"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {item.punch.latitude && item.punch.longitude ? (
                        <div style={{ fontSize: 11, color: "#10B981", display: "flex", alignItems: "center", gap: 4 }}>
                          <MapPin size={12} />
                          <span>{item.punch.latitude.toFixed(4)}, {item.punch.longitude.toFixed(4)}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: t.textMuted }}>Sem GPS (Comprovação Câmera)</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => setExpandedItem(item)}
                          title="Visualizar"
                          style={{
                            background: t.accentGlow,
                            border: `1px solid ${t.accent}`,
                            color: t.accent,
                            borderRadius: 6,
                            padding: "5px 9px",
                            cursor: "pointer"
                          }}
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => downloadPhoto(item.fotoUrl, `ponto_${item.tipoFoto}_${item.userMatricula}_${item.dayKey}.jpg`)}
                          title="Baixar Foto"
                          style={{
                            background: t.surfaceAlt,
                            border: `1px solid ${t.border}`,
                            color: t.text,
                            borderRadius: 6,
                            padding: "5px 9px",
                            cursor: "pointer"
                          }}
                        >
                          <Download size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ marginTop: 16 }}>
          <Paginacao
            totalItems={filteredPunches.length}
            itemsPerPage={pageSize}
            currentPage={page}
            onPageChange={setPage}
            t={t}
          />
        </div>
      )}

      {/* Lightbox / High Resolution Modal */}
      {expandedItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20
          }}
          onClick={() => setExpandedItem(null)}
        >
          <div
            style={{
              background: t.surface,
              border: `1.5px solid ${t.border}`,
              borderRadius: 16,
              maxWidth: 750,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: `0 20px 50px rgba(0,0,0,0.5)`,
              display: "flex",
              flexDirection: "column"
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: `1.5px solid ${t.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Camera size={18} color={t.accent} />
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>
                    Foto do Registro de Ponto
                  </h3>
                  <span style={{ fontSize: 12, color: t.textMuted }}>
                    {expandedItem.userName} ({expandedItem.userMatricula})
                  </span>
                </div>
              </div>

              <button
                onClick={() => setExpandedItem(null)}
                style={{
                  background: t.surfaceAlt,
                  border: `1px solid ${t.border}`,
                  color: t.text,
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  fontSize: 16,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Image View */}
            <div style={{ padding: 20, textAlign: "center", background: "#050505" }}>
              <img
                src={expandedItem.fotoUrl}
                alt="Foto Ampliada"
                style={{
                  maxWidth: "100%",
                  maxHeight: "55vh",
                  objectFit: "contain",
                  borderRadius: 8,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.4)"
                }}
              />
            </div>

            {/* Metadata Footer */}
            <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, background: t.surfaceAlt, borderTop: `1px solid ${t.border}` }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, display: "block" }}>COLABORADOR</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{expandedItem.userName}</span>
                <span style={{ fontSize: 11, color: t.textSub, display: "block" }}>Matrícula: {expandedItem.userMatricula}</span>
              </div>

              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, display: "block" }}>DATA E HORÁRIO</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>{formatDateBR(expandedItem.dayKey)} às {formatTime(expandedItem.punch)}</span>
                <span style={{ fontSize: 11, color: t.textSub, display: "block" }}>{slotLabels[expandedItem.slotIdx] || `Slot #${expandedItem.slotIdx + 1}`}</span>
              </div>

              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, display: "block" }}>LOCALIZAÇÃO GPS</span>
                {expandedItem.punch.latitude && expandedItem.punch.longitude ? (
                  <a
                    href={`https://maps.google.com/?q=${expandedItem.punch.latitude},${expandedItem.punch.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, fontWeight: 600, color: "#10B981", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2 }}
                  >
                    <MapPin size={12} /> Ver no Mapa ({expandedItem.punch.latitude.toFixed(4)}, {expandedItem.punch.longitude.toFixed(4)})
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: t.textMuted, display: "block", marginTop: 2 }}>
                    GPS não fornecido (Comprovação via Selfie)
                  </span>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: t.textMuted }}>
                Tipo: {expandedItem.tipoFoto === "selfie" ? "Selfie de Comprovação" : "Foto de Atestado / Anexo"}
              </span>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => downloadPhoto(expandedItem.fotoUrl, `ponto_${expandedItem.tipoFoto}_${expandedItem.userMatricula}_${expandedItem.dayKey}.jpg`)}
                  style={{
                    background: `linear-gradient(135deg, ${t.accent}, #10B981)`,
                    border: "none",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)"
                  }}
                >
                  <Download size={14} /> Baixar Foto
                </button>
                <button
                  onClick={() => setExpandedItem(null)}
                  style={{
                    background: t.surfaceAlt,
                    border: `1px solid ${t.border}`,
                    color: t.text,
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
