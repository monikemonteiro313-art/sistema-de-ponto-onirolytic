import React, { useState, useEffect, useMemo } from "react";
import { 
  MapPin, 
  Camera, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertTriangle, 
  Send, 
  ExternalLink, 
  RefreshCw, 
  Search, 
  ShieldAlert, 
  Filter, 
  Calendar,
  Trash2,
  X
} from "lucide-react";
import { ThemeColors, User as UserType, PrePonto } from "../types";
import { loadOfflineQueue, clearSyncedPunches, OfflinePunchItem } from "../utils/preferencesService";

interface RegistrosOfflineViewProps {
  t: ThemeColors;
  users: UserType[];
  prePontos: PrePonto[];
  pontosGlobal: Record<string | number, Record<string, any[]>>;
  onForceSyncRecord: (item: OfflinePunchItem | PrePonto) => Promise<boolean>;
  onSyncData?: () => Promise<void>;
}

export function RegistrosOfflineView({
  t,
  users,
  prePontos,
  pontosGlobal = {},
  onForceSyncRecord,
  onSyncData
}: RegistrosOfflineViewProps) {
  const [offlineQueueItems, setOfflineQueueItems] = useState<OfflinePunchItem[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [hideAlreadySynced, setHideAlreadySynced] = useState<boolean>(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isBatchSyncing, setIsBatchSyncing] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<{ photoUrl: string; userName: string; dateStr: string } | null>(null);

  // Carrega itens da fila local do dispositivo
  const reloadQueue = async () => {
    try {
      const items = await loadOfflineQueue();
      setOfflineQueueItems(items || []);
    } catch (err) {
      console.warn("[RegistrosOfflineView] Erro ao carregar fila offline:", err);
    }
  };

  const handleRefreshAll = async () => {
    setIsLoadingQueue(true);
    setStatusMessage(null);
    try {
      if (onSyncData) {
        await onSyncData();
      }
      await reloadQueue();
      setStatusMessage({
        type: "success",
        text: "🔄 Dados do Firebase e fila de contingência atualizados com sucesso!"
      });
    } catch (err) {
      console.warn("[RegistrosOfflineView] Erro ao atualizar fila e servidor:", err);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  useEffect(() => {
    reloadQueue().finally(() => setIsLoadingQueue(false));
  }, []);

  // Auto-limpeza: Se o ponto na fila offline JÁ CONSTA no pontosGlobal (com a hora gravada no Firebase),
  // ele é removido da fila local automaticamente para não gerar poluição visual na tela do gestor.
  useEffect(() => {
    if (!offlineQueueItems || offlineQueueItems.length === 0 || !pontosGlobal) return;

    const itemsToClean: OfflinePunchItem[] = [];

    for (const item of offlineQueueItems) {
      const uId = Number(item.userId);
      const userDays = pontosGlobal[uId] || pontosGlobal[String(uId)];
      const dayArr = userDays?.[item.dayKey];
      const existing = dayArr?.[item.slotIdx];

      if (existing && existing.hora && !existing.gravadoOffline && existing.serverTime !== "pending") {
        itemsToClean.push(item);
      }
    }

    if (itemsToClean.length > 0) {
      console.log(`[RegistrosOfflineView] Auto-limpando ${itemsToClean.length} item(ns) da fila local que já constam no Firebase...`);
      clearSyncedPunches(itemsToClean).then(() => {
        setOfflineQueueItems(prev => prev.filter(i => !itemsToClean.some(c => Number(c.userId) === Number(i.userId) && c.dayKey === i.dayKey && c.slotIdx === i.slotIdx)));
      }).catch(err => console.warn("Auto-clean error:", err));
    }
  }, [offlineQueueItems, pontosGlobal]);

  // Unifica itens da fila local com Pré-Pontos pendentes oriundos de contingência (>48h)
  const unifiedRecords = useMemo(() => {
    const list: Array<{
      id: string;
      rawItem: OfflinePunchItem | PrePonto;
      isFromDiskQueue: boolean;
      userId: number;
      userName: string;
      matricula: string;
      dayKey: string;
      slotIdx: number;
      hora: string;
      registradoEm: string;
      latitude: number | null;
      longitude: number | null;
      accuracy: number | null;
      fotoComprovante: string | null;
      hoursOld: number;
      alreadyInFirebase: boolean;
      obs?: string;
    }> = [];

    const userMap = new Map(users.map(u => [Number(u.id), u]));
    const nowTs = Date.now();

    // 1. Processa itens da fila local (offline_punches_queue)
    for (const item of offlineQueueItems) {
      const uId = Number(item.userId);
      const userObj = userMap.get(uId);
      const regTs = item.registradoEm ? new Date(item.registradoEm).getTime() : nowTs;
      const hoursOld = Math.max(0, (nowTs - regTs) / (1000 * 60 * 60));

      const userDays = pontosGlobal[uId] || pontosGlobal[String(uId)];
      const dayArr = userDays?.[item.dayKey];
      const existing = dayArr?.[item.slotIdx];
      const alreadyInFirebase = Boolean(existing && existing.hora && !existing.gravadoOffline && existing.serverTime !== "pending");

      list.push({
        id: `disk_${uId}_${item.dayKey}_${item.slotIdx}_${item.registradoEm}`,
        rawItem: item,
        isFromDiskQueue: true,
        userId: uId,
        userName: userObj?.nome || `Usuário #${uId}`,
        matricula: userObj?.matricula || String(uId),
        dayKey: item.dayKey,
        slotIdx: item.slotIdx,
        hora: item.hora,
        registradoEm: item.registradoEm || new Date().toISOString(),
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null,
        accuracy: item.accuracy ?? null,
        fotoComprovante: item.fotoComprovante || null,
        hoursOld,
        alreadyInFirebase,
        obs: item.obs
      });
    }

    // 2. Processa Pré-Pontos pendentes que foram gerados por retenção >48h ou contém geolocalização/foto
    for (const pre of prePontos) {
      if (pre.status !== "pendente") continue;

      // Evita duplicatas se já estiver presente na fila local do disco
      const isAlreadyInDisk = list.some(
        l => l.userId === Number(pre.userId) && l.dayKey === pre.dayKey && l.slotIdx === pre.idx
      );
      if (isAlreadyInDisk) continue;

      const uId = Number(pre.userId);
      const userObj = userMap.get(uId);
      const regTs = pre.quando ? new Date(pre.quando).getTime() : nowTs;
      const hoursOld = Math.max(0, (nowTs - regTs) / (1000 * 60 * 60));

      const userDays = pontosGlobal[uId] || pontosGlobal[String(uId)];
      const dayArr = userDays?.[pre.dayKey];
      const existing = dayArr?.[pre.idx];
      const alreadyInFirebase = Boolean(existing && existing.hora && !existing.gravadoOffline && existing.serverTime !== "pending");

      list.push({
        id: pre.id,
        rawItem: pre,
        isFromDiskQueue: false,
        userId: uId,
        userName: pre.userName || userObj?.nome || `Usuário #${uId}`,
        matricula: pre.matricula || userObj?.matricula || String(uId),
        dayKey: pre.dayKey,
        slotIdx: pre.idx,
        hora: pre.hora || (pre.quando ? new Date(pre.quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "00:00"),
        registradoEm: pre.quando || new Date().toISOString(),
        latitude: pre.latitude ?? null,
        longitude: pre.longitude ?? null,
        accuracy: pre.accuracy ?? null,
        fotoComprovante: pre.fotoComprovante || null,
        hoursOld,
        alreadyInFirebase,
        obs: pre.obs
      });
    }

    // Ordena do mais antigo para o mais recente (prioriza o que tem mais tempo retido)
    return list.sort((a, b) => b.hoursOld - a.hoursOld);
  }, [offlineQueueItems, prePontos, users, pontosGlobal]);

  // Filtra por busca e por filtro de ocultar já sincronizados
  const filteredRecords = useMemo(() => {
    let result = unifiedRecords;

    if (hideAlreadySynced) {
      result = result.filter(r => !r.alreadyInFirebase);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r => 
        r.userName.toLowerCase().includes(q) || 
        r.matricula.toLowerCase().includes(q) ||
        r.dayKey.includes(q)
      );
    }

    return result;
  }, [unifiedRecords, searchQuery, hideAlreadySynced]);

  // Ação de Envio Manual pelo Gestor (Passa por Validação / Autocura)
  const handleSendToFirebase = async (record: typeof unifiedRecords[0]) => {
    setSyncingId(record.id);
    setStatusMessage(null);

    try {
      console.log(`[RegistrosOfflineView] Iniciando validação/envio com autocura para usuário ${record.userName} (${record.dayKey})...`);
      
      // Chama a função principal de sincronização (que inclui verificação de duplicidade / autocura)
      const success = await onForceSyncRecord(record.rawItem);

      if (success) {
        setStatusMessage({
          type: "success",
          text: `✅ Processado com Autocura! O registro de ${record.userName} (${record.dayKey} às ${record.hora}) foi verificado, harmonizado com a folha do Firebase e a fila local foi atualizada.`
        });
        // Atualiza a fila e recarrega dados do servidor
        await handleRefreshAll();
      } else {
        setStatusMessage({
          type: "error",
          text: `⚠️ O Firebase não respondeu ou recusou a comunicação. O registro de ${record.userName} PERMANECE SEGURO na fila local e não foi descartado.`
        });
      }
    } catch (err) {
      console.error("[RegistrosOfflineView] Erro inesperado ao enviar:", err);
      setStatusMessage({
        type: "error",
        text: `⚠️ Erro de conexão com o Firebase. O registro permanece seguro na fila para nova tentativa.`
      });
    } finally {
      setSyncingId(null);
    }
  };

  // Sincroniza em lote todos os registros visíveis na fila de contingência
  const handleSyncAllRecords = async () => {
    const listToSync = filteredRecords;
    if (listToSync.length === 0) return;
    setIsBatchSyncing(true);
    setStatusMessage(null);
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < listToSync.length; i++) {
        const record = listToSync[i];
        setBatchProgress({ current: i + 1, total: listToSync.length });
        try {
          const success = await onForceSyncRecord(record.rawItem);
          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          console.warn(`[BatchSync] Erro ao sincronizar ${record.id}:`, err);
          failCount++;
        }
        await new Promise(r => setTimeout(r, 60));
      }

      setStatusMessage({
        type: "success",
        text: `🚀 Subida concluída! ${successCount} registro(s) sincronizado(s) com sucesso para o banco de dados${failCount > 0 ? ` (${failCount} erro(s))` : ""}.`
      });
      await handleRefreshAll();
    } catch (err) {
      console.error("[BatchSync] Erro no envio em lote:", err);
    } finally {
      setIsBatchSyncing(false);
      setBatchProgress(null);
    }
  };

  const slotLabels = ["1ª Entrada (M1)", "1ª Saída (M2)", "2ª Entrada (M3)", "2ª Saída (M4)"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Banner / Header informativo */}
      <div 
        style={{ 
          background: t.surface, 
          border: `1.5px solid ${t.border}`, 
          borderRadius: 16, 
          padding: 20,
          boxShadow: `0 4px 16px ${t.shadow}`
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#d97706", fontWeight: 800, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              <ShieldAlert size={18} />
              <span>Fila de Contingência / Batidas Offline</span>
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: t.text }}>
              Registros Offline Retidos nos Dispositivos
            </h2>
            <p style={{ margin: "4px 0 0 0", fontSize: 13, color: t.textSub, maxWidth: 720 }}>
              Gerencie batidas gravadas nos celulares dos colaboradores que aguardam envio. Registros que ultrapassam <strong>48 horas</strong> podem ser validados e enviados manualmente pelo gestor com preservação integral de GPS e foto.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {filteredRecords.length > 0 && (
              <button
                type="button"
                onClick={handleSyncAllRecords}
                disabled={isBatchSyncing || isLoadingQueue}
                style={{
                  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 18px",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: isBatchSyncing ? "wait" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 2px 8px rgba(37,99,235,0.35)",
                  opacity: (isBatchSyncing || isLoadingQueue) ? 0.7 : 1,
                  transition: "all 0.15s"
                }}
              >
                <Send size={15} className={isBatchSyncing ? "spin" : ""} />
                <span>
                  {isBatchSyncing && batchProgress
                    ? `Enviando (${batchProgress.current}/${batchProgress.total})...`
                    : `🚀 Subir Todos (${filteredRecords.length})`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={isLoadingQueue || isBatchSyncing}
              style={{
                background: t.surfaceAlt,
                color: t.text,
                border: `1px solid ${t.border}`,
                borderRadius: 10,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.15s"
              }}
            >
              <RefreshCw size={15} className={isLoadingQueue ? "spin" : ""} />
              <span>Atualizar Fila</span>
            </button>
          </div>
        </div>

        {/* Métrica Resumo */}
        <div style={{ display: "flex", gap: 16, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.border}`, flexWrap: "wrap" }}>
          <div style={{ background: t.surfaceAlt, borderRadius: 10, padding: "10px 16px", border: `1px solid ${t.border}`, flex: "1 1 180px" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>Total Retido na Fila</span>
            <div style={{ fontSize: 22, fontWeight: 900, color: t.text, marginTop: 2 }}>
              {unifiedRecords.length} {unifiedRecords.length === 1 ? "registro" : "registros"}
            </div>
          </div>

          <div style={{ background: "rgba(245,158,11,0.08)", borderRadius: 10, padding: "10px 16px", border: "1px solid rgba(245,158,11,0.25)", flex: "1 1 180px" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#d97706", textTransform: "uppercase" }}>Retidos Há +48 Horas</span>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#d97706", marginTop: 2 }}>
              {unifiedRecords.filter(r => r.hoursOld >= 48).length} {unifiedRecords.filter(r => r.hoursOld >= 48).length === 1 ? "alerta" : "alertas"}
            </div>
          </div>
        </div>
      </div>

      {/* Banner de Mensagem de Status */}
      {statusMessage && (
        <div
          style={{
            background: statusMessage.type === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            border: `1.5px solid ${statusMessage.type === "success" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
            color: statusMessage.type === "success" ? "#16a34a" : "#dc2626",
            borderRadius: 12,
            padding: "14px 18px",
            fontSize: 13,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12
          }}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Barra de Filtro e Pesquisa */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ position: "relative", flex: "1 1 280px" }}>
          <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: t.textMuted }} />
          <input
            type="text"
            placeholder="Buscar por colaborador, matrícula ou data (aaaa-mm-dd)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              background: t.inputBg,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              padding: "10px 14px 10px 40px",
              fontSize: 13,
              color: t.text,
              outline: "none"
            }}
          />
        </div>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, color: t.text, userSelect: "none", background: t.surfaceAlt, padding: "8px 14px", borderRadius: 10, border: `1px solid ${t.border}` }}>
          <input
            type="checkbox"
            checked={hideAlreadySynced}
            onChange={e => setHideAlreadySynced(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: t.accent, cursor: "pointer" }}
          />
          <span>Ocultar pontos que já constam na folha do Firebase</span>
        </label>
      </div>

      {/* LISTA DE REGISTROS RETIDOS */}
      {isLoadingQueue ? (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 40, textAlign: "center", color: t.textSub }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom: 12, color: t.accent }} />
          <div>Carregando fila de contingência dos dispositivos...</div>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 40, textAlign: "center" }}>
          <CheckCircle2 size={40} style={{ color: "#22c55e", marginBottom: 12 }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: t.text }}>Nenhum Registro Retido na Fila Offline</h3>
          <p style={{ margin: "4px 0 0 0", fontSize: 13, color: t.textSub }}>
            {searchQuery ? "Nenhum resultado para a busca efetuada." : "Todas as batidas de ponto foram sincronizadas com sucesso com o Firebase."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filteredRecords.map((record) => {
            const isOver48h = record.hoursOld >= 48;
            const formattedDate = record.dayKey.split("-").reverse().join("/");
            const isSyncingThis = syncingId === record.id;

            return (
              <div
                key={record.id}
                style={{
                  background: t.surface,
                  border: `1.5px solid ${isOver48h ? "rgba(245,158,11,0.5)" : t.border}`,
                  borderRadius: 14,
                  padding: 18,
                  boxShadow: isOver48h ? "0 4px 12px rgba(245,158,11,0.08)" : `0 2px 8px ${t.shadow}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  transition: "all 0.15s"
                }}
              >
                {/* Linha Superior: Dados do Colaborador + Badges */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: isOver48h ? "rgba(245,158,11,0.15)" : t.surfaceAlt,
                        color: isOver48h ? "#d97706" : t.accent,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: 16,
                        border: `1px solid ${isOver48h ? "rgba(245,158,11,0.3)" : t.border}`
                      }}
                    >
                      {record.userName.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: t.text }}>
                          {record.userName}
                        </h4>
                        <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub, background: t.surfaceAlt, padding: "2px 8px", borderRadius: 6, border: `1px solid ${t.border}` }}>
                          Matrícula: {record.matricula}
                        </span>
                        {record.alreadyInFirebase && (
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#16a34a", background: "rgba(34,197,94,0.12)", padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(34,197,94,0.3)" }}>
                            ✓ Já Consta na Folha Oficial
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>
                        Data: <strong>{formattedDate}</strong> • Horário Exato: <strong style={{ color: t.accent }}>{record.hora}</strong> ({slotLabels[record.slotIdx] || `Batida #${record.slotIdx + 1}`})
                      </div>
                    </div>
                  </div>

                  {/* Badge de Tempo Retido / Status */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isOver48h ? (
                      <span style={{ background: "rgba(245,158,11,0.15)", color: "#b45309", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <AlertTriangle size={13} /> Retido Há {Math.floor(record.hoursOld)}h (Exige Ação)
                      </span>
                    ) : (
                      <span style={{ background: "rgba(59,130,246,0.12)", color: "#2563eb", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Clock size={13} /> Fila Local ({Math.floor(record.hoursOld)}h atrás)
                      </span>
                    )}
                  </div>
                </div>

                {/* Linha Central: Evidências (GPS + Foto) */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, background: t.surfaceAlt, borderRadius: 10, padding: 12, border: `1px solid ${t.border}` }}>
                  {/* Bloco GPS / Localização */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                      <MapPin size={13} style={{ color: t.accent }} />
                      <span>Localização GPS Capturada</span>
                    </div>

                    {record.latitude !== null && record.longitude !== null ? (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: t.text, fontFamily: "monospace" }}>
                          Lat: {record.latitude.toFixed(6)} | Lng: {record.longitude.toFixed(6)}
                        </div>
                        {record.accuracy !== null && (
                          <div style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>
                            Precisão do sinal: ±{Math.round(record.accuracy)} metros
                          </div>
                        )}
                        <a
                          href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            marginTop: 6,
                            fontSize: 11,
                            fontWeight: 800,
                            color: t.accent,
                            textDecoration: "none"
                          }}
                        >
                          <ExternalLink size={12} /> Abrir no Google Maps
                        </a>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: t.textMuted, fontStyle: "italic" }}>
                        Geolocalização não registrada ou sem permissão de GPS no momento da batida.
                      </div>
                    )}
                  </div>

                  {/* Bloco Foto / Comprovante Selfie */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                      <Camera size={13} style={{ color: t.accent }} />
                      <span>Foto Comprovante (Selfie)</span>
                    </div>

                    {record.fotoComprovante ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img
                          src={record.fotoComprovante}
                          alt="Selfie Comprovante"
                          onClick={() => setSelectedPhotoModal({ photoUrl: record.fotoComprovante!, userName: record.userName, dateStr: `${formattedDate} - ${record.hora}` })}
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 8,
                            objectFit: "cover",
                            border: `1.5px solid ${t.border}`,
                            cursor: "pointer",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedPhotoModal({ photoUrl: record.fotoComprovante!, userName: record.userName, dateStr: `${formattedDate} - ${record.hora}` })}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: t.accent,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            padding: 0,
                            textDecoration: "underline"
                          }}
                        >
                          Ampliar Foto
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: t.textMuted }}>
                        Sem foto anexada para esta batida.
                      </div>
                    )}
                  </div>
                </div>

                {/* Linha Inferior: Botão de Ação Manual do Gestor */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, paddingTop: 4 }}>
                  <div style={{ fontSize: 11, color: t.textMuted }}>
                    {record.obs ? `Obs: "${record.obs}"` : "Preservação integral de horário, foto e geolocalização."}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSendToFirebase(record)}
                    disabled={isSyncingThis}
                    style={{
                      background: isOver48h ? "#d97706" : t.accent,
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 10,
                      padding: "10px 20px",
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: isSyncingThis ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      opacity: isSyncingThis ? 0.7 : 1,
                      boxShadow: `0 2px 8px ${isOver48h ? "rgba(217,119,6,0.3)" : t.accentGlow}`,
                      transition: "all 0.15s"
                    }}
                  >
                    {isSyncingThis ? (
                      <>
                        <RefreshCw size={15} className="spin" />
                        <span>Validando Autocura com Firebase...</span>
                      </>
                    ) : (
                      <>
                        <Send size={15} />
                        <span>🚀 Validar e Enviar (Autocura)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Lightbox para Ampliar Foto Comprovante */}
      {selectedPhotoModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(4px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20
          }}
          onClick={() => setSelectedPhotoModal(null)}
        >
          <div
            style={{
              background: t.surface,
              border: `1.5px solid ${t.border}`,
              borderRadius: 16,
              padding: 20,
              maxWidth: 480,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)"
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: t.text }}>
                  Selfie Comprovante - {selectedPhotoModal.userName}
                </h4>
                <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>
                  {selectedPhotoModal.dateStr}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhotoModal(null)}
                style={{ background: "transparent", border: "none", color: t.text, cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <img
              src={selectedPhotoModal.photoUrl}
              alt="Selfie Ampliada"
              style={{
                width: "100%",
                maxHeight: 420,
                objectFit: "contain",
                borderRadius: 12,
                border: `1px solid ${t.border}`,
                background: "#000000"
              }}
            />

            <button
              type="button"
              onClick={() => setSelectedPhotoModal(null)}
              style={{
                background: t.surfaceAlt,
                color: t.text,
                border: `1px solid ${t.border}`,
                borderRadius: 10,
                padding: "10px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                width: "100%"
              }}
            >
              Fechar Visualização
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
