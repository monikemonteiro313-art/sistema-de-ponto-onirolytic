import React, { useState } from "react";
import { AlertTriangle, Lock, Upload, X, CheckCircle2, ShieldAlert, Image as ImageIcon } from "lucide-react";
import { ThemeColors } from "../types";
import { Btn } from "./SharedUI";
import { compressImageBase64 } from "../utils/hrHelpers";

interface ModalDenunciaAnonimaProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { texto: string; fotoUrl?: string | null }) => Promise<void>;
  t: ThemeColors;
}

export function ModalDenunciaAnonima({ isOpen, onClose, onSubmit, t }: ModalDenunciaAnonimaProps) {
  const [texto, setTexto] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErro("Por favor, selecione apenas arquivos de imagem (PNG, JPG, WEBP).");
      return;
    }

    try {
      setErro(null);
      // Read file to data URL and compress
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          const compressed = await compressImageBase64(base64, 800, 800, 0.65);
          setFotoUrl(compressed);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Erro ao carregar imagem da denúncia:", err);
      setErro("Não foi possível carregar a foto. Tente uma imagem menor.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) {
      setErro("Por favor, descreva a irregularidade antes de enviar.");
      return;
    }

    if (texto.trim().length < 10) {
      setErro("A descrição da denúncia deve ter no mínimo 10 caracteres para que possa ser analisada com clareza.");
      return;
    }

    setLoading(true);
    setErro(null);

    try {
      await onSubmit({
        texto: texto.trim(),
        fotoUrl
      });
      setSucesso(true);
      setTimeout(() => {
        handleResetAndClose();
      }, 3000);
    } catch (err) {
      console.error("Erro ao enviar denúncia:", err);
      setErro("Ocorreu um erro ao enviar sua denúncia. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setTexto("");
    setFotoUrl(null);
    setSucesso(false);
    setErro(null);
    setLoading(false);
    onClose();
  };

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
        padding: 16,
        animation: "fadeIn 0.2s ease-out"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          handleResetAndClose();
        }
      }}
    >
      <div
        style={{
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          borderRadius: 16,
          width: "100%",
          maxWidth: 520,
          boxShadow: `0 20px 50px ${t.shadow}`,
          overflow: "hidden",
          position: "relative",
          boxSizing: "border-box"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: `1px solid ${t.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: t.surfaceAlt
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: t.warningBg,
                border: `1.5px solid ${t.warningBorder}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <ShieldAlert size={24} color={t.warning} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text }}>
                Canal de Denúncia Anônima
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                <Lock size={12} color={t.success} />
                <span style={{ fontSize: 12, fontWeight: 600, color: t.success }}>
                  Garantia de Sigilo & Anonymity 100%
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleResetAndClose}
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
                width: 64,
                height: 64,
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
            <h4 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: t.text }}>
              Denúncia Enviada com Sucesso!
            </h4>
            <p style={{ margin: 0, fontSize: 13.5, color: t.textSub, lineHeight: 1.5 }}>
              Sua mensagem foi registrada no sistema. Ela será analisada pelo setor responsável com sigilo total e imparcialidade.
            </p>
            <div style={{ marginTop: 24 }}>
              <Btn t={t} onClick={handleResetAndClose} variant="primary">
                Fechar
              </Btn>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: 24 }}>
            {/* Informational Banner */}
            <div
              style={{
                background: t.surfaceAlt,
                border: `1.5px solid ${t.border}`,
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 20,
                display: "flex",
                alignItems: "flex-start",
                gap: 10
              }}
            >
              <Lock size={18} color={t.accent} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 12.5, color: t.textSub, lineHeight: 1.45 }}>
                <strong style={{ color: t.text }}>Proteção Absoluta do Denunciante:</strong> Não coletamos sua localização GPS, endereço IP, nome, matrícula ou dados de dispositivo. A denúncia é armazenada em formato cru e anônimo.
              </div>
            </div>

            {erro && (
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
                <span>{erro}</span>
              </div>
            )}

            {/* Textarea field */}
            <div style={{ marginBottom: 18 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: t.text,
                  marginBottom: 6
                }}
              >
                Relato da Irregularidade <span style={{ color: t.danger }}>*</span>
              </label>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={5}
                placeholder="Descreva detalhadamente o ocorrido, locais, fatos ou condutas irregulares..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: t.inputBg,
                  border: `1.5px solid ${t.border}`,
                  borderRadius: 10,
                  color: t.text,
                  fontSize: 13.5,
                  padding: "12px 14px",
                  outline: "none",
                  fontFamily: "inherit",
                  resize: "vertical",
                  minHeight: 110
                }}
              />
              <span style={{ fontSize: 11.5, color: t.textMuted, display: "block", marginTop: 4 }}>
                Não inclua dados pessoais seus se deseja manter o anonimato completo.
              </span>
            </div>

            {/* Photo upload field (Optional) */}
            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: t.text,
                  marginBottom: 6
                }}
              >
                Anexar Foto / Evidência <span style={{ fontSize: 11.5, color: t.textMuted }}>(Opcional)</span>
              </label>

              {fotoUrl ? (
                <div
                  style={{
                    position: "relative",
                    borderRadius: 10,
                    overflow: "hidden",
                    border: `1.5px solid ${t.border}`,
                    background: "#000",
                    maxHeight: 200,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <img
                    src={fotoUrl}
                    alt="Evidência da denúncia"
                    style={{ width: "100%", height: 180, objectFit: "contain" }}
                  />
                  <button
                    type="button"
                    onClick={() => setFotoUrl(null)}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      background: "rgba(0,0,0,0.75)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: "50%",
                      width: 28,
                      height: 28,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                    title="Remover foto"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "18px 16px",
                    background: t.surfaceAlt,
                    border: `1.5px dashed ${t.border}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    textAlign: "center"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = t.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = t.border;
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: "none" }}
                  />
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: t.inputBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: t.accent
                    }}
                  >
                    <Upload size={18} />
                  </div>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                      Clique para selecionar uma foto
                    </span>
                    <span style={{ fontSize: 11.5, color: t.textMuted, display: "block", marginTop: 2 }}>
                      PNG, JPG ou WEBP (opcional)
                    </span>
                  </div>
                </label>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
              <Btn
                type="button"
                variant="ghost"
                t={t}
                onClick={handleResetAndClose}
                disabled={loading}
              >
                Cancelar
              </Btn>

              <Btn
                type="submit"
                variant="primary"
                t={t}
                disabled={loading || !texto.trim()}
              >
                {loading ? "Enviando..." : "Enviar Denúncia Anônima"}
              </Btn>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
