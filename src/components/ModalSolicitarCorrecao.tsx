import React, { useState, useEffect } from "react";
import { Clock, MapPin, AlertTriangle, CheckCircle2, X, Send, Compass, ShieldCheck } from "lucide-react";
import { ThemeColors, User } from "../types";
import { Btn } from "./SharedUI";

interface ModalSolicitarCorrecaoProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  t: ThemeColors;
  onSubmit: (data: {
    data: string;
    hora: string;
    slotIdx: number;
    motivo: string;
    latitude?: number | null;
    longitude?: number | null;
    accuracy?: number | null;
  }) => Promise<void>;
}

import { getBestCurrentPosition } from "../utils/geolocationHelper";

export function ModalSolicitarCorrecao({
  isOpen,
  onClose,
  currentUser,
  t,
  onSubmit
}: ModalSolicitarCorrecaoProps) {
  const getTodayISO = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getNowTimeString = () => {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const [dateVal, setDateVal] = useState<string>(getTodayISO());
  const [timeVal, setTimeVal] = useState<string>(getNowTimeString());
  const [slotIdx, setSlotIdx] = useState<number>(0);
  const [motivo, setMotivo] = useState<string>("");

  // Geolocation state
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [geoErrorMsg, setGeoErrorMsg] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Capture GPS location on mount / open
  useEffect(() => {
    if (isOpen) {
      captureLocation();
    } else {
      resetForm();
    }
  }, [isOpen]);

  const captureLocation = async () => {
    setGeoStatus("loading");
    setGeoErrorMsg(null);

    try {
      const pos = await getBestCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
      setAccuracy(Math.round(pos.coords.accuracy));
      setGeoStatus("success");
    } catch (err: any) {
      console.warn("[GPS] Erro ao obter localização:", err);
      setGeoStatus("error");
      if (err?.code === 1 || String(err?.message || "").includes("denied") || String(err?.message || "").includes("recusado")) {
        setGeoErrorMsg("Permissão de localização negada pelo usuário ou pelo aplicativo.");
      } else if (err?.code === 2) {
        setGeoErrorMsg("Sinal de GPS indisponível no momento.");
      } else {
        setGeoErrorMsg("Não foi possível obter a localização exata.");
      }
    }
  };

  const resetForm = () => {
    setDateVal(getTodayISO());
    setTimeVal(getNowTimeString());
    setSlotIdx(0);
    setMotivo("");
    setGeoStatus("idle");
    setLat(null);
    setLng(null);
    setAccuracy(null);
    setGeoErrorMsg(null);
    setLoading(false);
    setSucesso(false);
    setFormError(null);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navigator.onLine) {
      setFormError("Solicitação de correção requer internet para envio ao gestor.");
      return;
    }
    if (!dateVal) {
      setFormError("Por favor, selecione a data da batida.");
      return;
    }
    if (!timeVal) {
      setFormError("Por favor, informe o horário da batida.");
      return;
    }
    if (!motivo.trim() || motivo.trim().length < 8) {
      setFormError("Por favor, forneça um motivo/justificativa claro (mínimo 8 caracteres).");
      return;
    }

    setLoading(true);
    setFormError(null);

    try {
      await onSubmit({
        data: dateVal,
        hora: timeVal,
        slotIdx,
        motivo: motivo.trim(),
        latitude: lat,
        longitude: lng,
        accuracy: accuracy
      });

      setSucesso(true);
      setTimeout(() => {
        onClose();
        resetForm();
      }, 2500);
    } catch (err) {
      console.error("Erro ao enviar solicitação de correção:", err);
      setFormError("Não foi possível enviar a solicitação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const slotLabels = [
    { idx: 0, label: "Entrada (Início do Expediente)" },
    { idx: 1, label: "Saída para Almoço / Intervalo" },
    { idx: 2, label: "Retorno do Almoço / Intervalo" },
    { idx: 3, label: "Saída (Fim do Expediente)" }
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px 10px",
        animation: "fadeIn 0.2s ease-out"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div
        style={{
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          borderRadius: 18,
          width: "100%",
          maxWidth: 500,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: `0 20px 50px ${t.shadow}`,
          position: "relative",
          boxSizing: "border-box"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 18px 14px",
            borderBottom: `1px solid ${t.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: t.surfaceAlt,
            gap: 10
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: t.accentGlow,
                border: `1.5px solid ${t.borderFocus}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <Clock size={20} color={t.accent} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: t.text }}>
                Solicitar Correção de Ponto
              </h3>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: t.textSub, display: "block", marginTop: 2 }}>
                Envie a solicitação de inclusão/ajuste para aprovação do gestor.
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: "none",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              padding: 6,
              borderRadius: 8,
              color: t.textMuted,
              display: "flex"
            }}
          >
            <X size={20} />
          </button>
        </div>

        {sucesso ? (
          <div style={{ padding: 36, textAlign: "center" }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: t.successBg,
                border: `2px solid ${t.successBorder}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px"
              }}
            >
              <CheckCircle2 size={36} color={t.success} />
            </div>
            <h4 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: t.text }}>
              Solicitação Enviada!
            </h4>
            <p style={{ margin: 0, fontSize: 13.5, color: t.textSub, lineHeight: 1.5 }}>
              Sua solicitação de correção foi registrada e enviada para o gestor.
              Assim que for aprovada, o ponto será automaticamente adicionado ao seu espelho.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: "16px 18px" }}>
            {formError && (
              <div
                style={{
                  background: t.dangerBg,
                  border: `1.5px solid ${t.dangerBorder}`,
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: t.danger,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

            {/* Date & Time inputs row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: t.text, marginBottom: 6 }}>
                  Data do Ponto <span style={{ color: t.danger }}>*</span>
                </label>
                <input
                  type="date"
                  value={dateVal}
                  onChange={(e) => setDateVal(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: t.inputBg,
                    border: `1.5px solid ${t.border}`,
                    borderRadius: 10,
                    color: t.text,
                    fontSize: 13.5,
                    padding: "10px 12px",
                    outline: "none"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: t.text, marginBottom: 6 }}>
                  Horário Real <span style={{ color: t.danger }}>*</span>
                </label>
                <input
                  type="time"
                  value={timeVal}
                  onChange={(e) => setTimeVal(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: t.inputBg,
                    border: `1.5px solid ${t.border}`,
                    borderRadius: 10,
                    color: t.text,
                    fontSize: 13.5,
                    padding: "10px 12px",
                    outline: "none"
                  }}
                />
              </div>
            </div>

            {/* Slot selection */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: t.text, marginBottom: 6 }}>
                Tipo de Batida <span style={{ color: t.danger }}>*</span>
              </label>
              <select
                value={slotIdx}
                onChange={(e) => setSlotIdx(Number(e.target.value))}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: t.inputBg,
                  border: `1.5px solid ${t.border}`,
                  borderRadius: 10,
                  color: t.text,
                  fontSize: 13.5,
                  padding: "10px 12px",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                {slotLabels.map((s) => (
                  <option key={s.idx} value={s.idx}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Motivo / Justificativa */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: t.text, marginBottom: 6 }}>
                Motivo / Justificativa da Correção <span style={{ color: t.danger }}>*</span>
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                placeholder="Ex.: Esqueci de bater a saída do almoço por conta de reunião urgente, solicito ajuste..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: t.inputBg,
                  border: `1.5px solid ${t.border}`,
                  borderRadius: 10,
                  color: t.text,
                  fontSize: 13,
                  padding: "10px 12px",
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit"
                }}
              />
            </div>

            {/* GPS Location Box */}
            <div
              style={{
                background: t.surfaceAlt,
                border: `1.5px solid ${geoStatus === "success" ? t.successBorder : t.border}`,
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 20
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={15} color={geoStatus === "success" ? t.success : t.accent} />
                  Localização Geográfica (GPS)
                </span>
                <button
                  type="button"
                  onClick={captureLocation}
                  style={{
                    background: "none",
                    border: "none",
                    color: t.accent,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <Compass size={13} /> {geoStatus === "loading" ? "Buscando..." : "Recapturar"}
                </button>
              </div>

              {geoStatus === "loading" && (
                <div style={{ fontSize: 12, color: t.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="animate-spin" style={{ display: "inline-block" }}>⌛</span>
                  Obtendo coordenadas do GPS do seu dispositivo...
                </div>
              )}

              {geoStatus === "success" && lat !== null && lng !== null && (
                <div style={{ fontSize: 12, color: t.success, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={14} color={t.success} />
                  <span>
                    GPS Capturado: Lat {lat.toFixed(5)}, Long {lng.toFixed(5)}
                    {accuracy ? ` (Precisão ±${accuracy}m)` : ""}
                  </span>
                </div>
              )}

              {geoStatus === "error" && (
                <div style={{ fontSize: 12, color: t.warning, fontWeight: 500 }}>
                  ⚠️ {geoErrorMsg || "GPS indisponível."} A solicitação será enviada informando ausência de GPS.
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
              <Btn
                type="button"
                variant="ghost"
                t={t}
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </Btn>

              <Btn
                type="submit"
                variant="primary"
                t={t}
                disabled={loading || !motivo.trim()}
              >
                {loading ? "Enviando..." : "Enviar Solicitação"}
              </Btn>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
