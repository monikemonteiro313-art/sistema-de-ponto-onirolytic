import React, { useState } from "react";
import { ThemeColors } from "../types";
import { Clock, FileText, Calendar, SquarePen, ArrowLeft, CheckCircle, VolumeX, Upload, MapPin, Check, X, Stethoscope, Folder } from "lucide-react";

interface PontinhoTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: ThemeColors;
  userName?: string;
  initialStep?: number;
}

type GuideOption = null | "bater_ponto" | "atestado" | "marcacoes" | "correcao";

export const PontinhoTourModal: React.FC<PontinhoTourModalProps> = ({
  isOpen,
  onClose,
  t,
  userName = "COLABORADOR(A)",
}) => {
  const [selectedOption, setSelectedOption] = useState<GuideOption>(null);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedOption(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Extract first name for a warm personal greeting
  const firstName = userName ? userName.trim().split(" ")[0].toUpperCase() : "COLABORADOR(A)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        animation: "fadeIn 0.2s ease-out"
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: t.surface,
          border: `2px solid ${t.border}`,
          borderRadius: 24,
          width: "100%",
          maxWidth: 720,
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          position: "relative"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div
          style={{
            padding: "16px 20px",
            background: "linear-gradient(135deg, #1e293b, #0f172a)",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${t.border}`
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                background: "rgba(59,130,246,0.3)",
                border: "1px solid #3b82f6",
                color: "#60a5fa",
                borderRadius: 12,
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: "0.5px"
              }}
            >
              🤖 PONTINHO
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#f8fafc", letterSpacing: "0.3px" }}>
              GUIA ORIENTATIVO DO PONTO DIGITAL
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                background: "rgba(255,255,255,0.12)",
                color: "#94a3b8",
                padding: "4px 10px",
                borderRadius: 20,
                display: "flex",
                alignItems: "center",
                gap: 5
              }}
              title="Orientações por texto em tela para facilitar a leitura"
            >
              <VolumeX size={13} /> GUIA ILUSTRATIVO
            </span>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: "50%",
                width: 34,
                height: 34,
                cursor: "pointer",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s"
              }}
              title="Fechar guia"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div
          style={{
            padding: "24px 20px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 20
          }}
        >
          {/* Mascot Greeting Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              background: t.surfaceAlt,
              padding: 16,
              borderRadius: 20,
              border: `2px solid ${t.border}`
            }}
          >
            {/* Mascot Avatar SVG */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <svg width="86" height="86" viewBox="0 0 100 100" style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))" }}>
                <circle cx="50" cy="50" r="44" fill={selectedOption ? "#10b981" : "#3b82f6"} />
                <circle cx="50" cy="50" r="44" fill="url(#bgGlow)" opacity="0.3" />
                <defs>
                  <radialGradient id="bgGlow" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
                  </radialGradient>
                </defs>

                {/* Blushing cheeks */}
                <ellipse cx="28" cy="58" rx="7" ry="4" fill="#f43f5e" opacity="0.4" />
                <ellipse cx="72" cy="58" rx="7" ry="4" fill="#f43f5e" opacity="0.4" />

                {/* Eyes */}
                <circle cx="28" cy="42" r="7" fill="#ffffff" />
                <circle cx="30" cy="40" r="3.5" fill="#0f172a" />
                <circle cx="32" cy="38" r="1.5" fill="#ffffff" />

                <circle cx="72" cy="42" r="7" fill="#ffffff" />
                <circle cx="74" cy="40" r="3.5" fill="#0f172a" />
                <circle cx="76" cy="38" r="1.5" fill="#ffffff" />

                {/* Smile */}
                <path d="M 32 56 Q 50 74 68 56 Z" fill="#ffffff" />

                {/* Feet */}
                <ellipse cx="36" cy="90" rx="10" ry="5" fill="#1e293b" />
                <ellipse cx="64" cy="90" rx="10" ry="5" fill="#1e293b" />
              </svg>

              <div
                style={{
                  position: "absolute",
                  bottom: -6,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#0f172a",
                  color: "#ffffff",
                  fontSize: 10,
                  fontWeight: 900,
                  padding: "2px 8px",
                  borderRadius: 10,
                  whiteSpace: "nowrap"
                }}
              >
                👋 Pontinho
              </div>
            </div>

            {/* Speech Bubble */}
            <div
              style={{
                flex: 1,
                background: t.surface,
                border: `2px solid ${selectedOption ? "#10b981" : "#3b82f6"}`,
                borderRadius: 18,
                padding: "14px 18px",
                boxShadow: "0 4px 14px rgba(0,0,0,0.06)"
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: selectedOption ? "#059669" : "#2563eb",
                  letterSpacing: "0.5px",
                  marginBottom: 4,
                  textTransform: "uppercase"
                }}
              >
                PONTINHO RESPONDE:
              </div>

              {selectedOption === null && (
                <div style={{ fontSize: 17, fontWeight: 800, color: t.text, lineHeight: 1.45 }}>
                  "OLÁ, <span style={{ color: "#2563eb" }}>{firstName}</span>! TUDO BEM? SOBRE O QUE VOCÊ GOSTARIA DE SABER HOJE? ESCOLHA UMA DAS OPÇÕES ABAIXO:"
                </div>
              )}

              {selectedOption === "bater_ponto" && (
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text, lineHeight: 1.45 }}>
                  "VEJA COMO É FÁCIL BATER O SEU PONTO! BASTA SEGUIR OS PASSO A PASSO ABAIXO E CLICAR NOS BOTÕES CORRESPONDENTES:"
                </div>
              )}

              {selectedOption === "atestado" && (
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text, lineHeight: 1.45 }}>
                  "PRECISA LANÇAR UM ATESTADO MÉDICO? APRENDA COMO ANEXAR SEU COMPROVANTE E REGISTRAR O PERÍODO DE AFASTAMENTO:"
                </div>
              )}

              {selectedOption === "marcacoes" && (
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text, lineHeight: 1.45 }}>
                  "QUER CONSULTAR O SEU EXTRATO DE MARCAÇÕES? CONFIRA COMO VISUALIZAR SEUS HORÁRIOS DO MÊS:"
                </div>
              )}

              {selectedOption === "correcao" && (
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text, lineHeight: 1.45 }}>
                  "ESQUECEU DE BATER O PONTO? VEJA COMO SOLICITAR UMA CORREÇÃO DE HORÁRIO PARA AVALIAÇÃO DO SEU GESTOR:"
                </div>
              )}
            </div>
          </div>

          {/* MAIN MENU SELECTION (WHEN NO OPTION SELECTED) */}
          {selectedOption === null && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: t.textSub, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                SELEÇÃO DE DÚVIDA (CLIQUE EM UMA OPÇÃO):
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                {/* Option 1 */}
                <button
                  type="button"
                  onClick={() => setSelectedOption("bater_ponto")}
                  style={{
                    background: "rgba(59,130,246,0.08)",
                    border: "2.5px solid #3b82f6",
                    borderRadius: 18,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                      style={{
                        background: "#3b82f6",
                        color: "#ffffff",
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}
                    >
                      <Clock size={24} />
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#1d4ed8", textTransform: "uppercase" }}>
                        1. COMO BATER O PONTO
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginTop: 2 }}>
                        Aprenda a registrar entrada, intervalo e saída no seu dia a dia.
                      </div>
                    </div>
                  </div>
                  <div style={{ background: "#3b82f6", color: "#ffffff", padding: "8px 14px", borderRadius: 12, fontSize: 13, fontWeight: 900, whiteSpace: "nowrap" }}>
                    VER GUIA ➔
                  </div>
                </button>

                {/* Option 2 */}
                <button
                  type="button"
                  onClick={() => setSelectedOption("atestado")}
                  style={{
                    background: "rgba(14,165,233,0.08)",
                    border: "2.5px solid #0284c7",
                    borderRadius: 18,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                      style={{
                        background: "#0284c7",
                        color: "#ffffff",
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}
                    >
                      <FileText size={24} />
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#0369a1", textTransform: "uppercase" }}>
                        2. COMO LANÇAR ATESTADO
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginTop: 2 }}>
                        Anexe seu atestado médico (PDF ou foto) e registre as datas de afastamento.
                      </div>
                    </div>
                  </div>
                  <div style={{ background: "#0284c7", color: "#ffffff", padding: "8px 14px", borderRadius: 12, fontSize: 13, fontWeight: 900, whiteSpace: "nowrap" }}>
                    VER GUIA ➔
                  </div>
                </button>

                {/* Option 3 */}
                <button
                  type="button"
                  onClick={() => setSelectedOption("marcacoes")}
                  style={{
                    background: "rgba(139,92,246,0.08)",
                    border: "2.5px solid #8b5cf6",
                    borderRadius: 18,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                      style={{
                        background: "#8b5cf6",
                        color: "#ffffff",
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}
                    >
                      <Calendar size={24} />
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#6d28d9", textTransform: "uppercase" }}>
                        3. COMO VER MINHAS MARCAÇÕES DE PONTO
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginTop: 2 }}>
                        Consulte seu relatório de frequência e histórico de pontos do mês.
                      </div>
                    </div>
                  </div>
                  <div style={{ background: "#8b5cf6", color: "#ffffff", padding: "8px 14px", borderRadius: 12, fontSize: 13, fontWeight: 900, whiteSpace: "nowrap" }}>
                    VER GUIA ➔
                  </div>
                </button>

                {/* Option 4 */}
                <button
                  type="button"
                  onClick={() => setSelectedOption("correcao")}
                  style={{
                    background: "rgba(245,158,11,0.08)",
                    border: "2.5px solid #f59e0b",
                    borderRadius: 18,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                      style={{
                        background: "#f59e0b",
                        color: "#ffffff",
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}
                    >
                      <SquarePen size={24} />
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#b45309", textTransform: "uppercase" }}>
                        4. COMO SOLICITAR UMA CORREÇÃO DE PONTO
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginTop: 2 }}>
                        Esqueceu de bater o ponto? Envie um pedido de ajuste com justificativa ao RH.
                      </div>
                    </div>
                  </div>
                  <div style={{ background: "#f59e0b", color: "#ffffff", padding: "8px 14px", borderRadius: 12, fontSize: 13, fontWeight: 900, whiteSpace: "nowrap" }}>
                    VER GUIA ➔
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* DETAIL VIEW 1: COMO BATER O PONTO */}
          {selectedOption === "bater_ponto" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#2563eb", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                ⏱️ PASSO A PASSO: BATER O PONTO
              </div>

              {/* Step 1 */}
              <div style={{ background: t.surfaceAlt, border: `2px solid ${t.border}`, borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: t.text, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: "#3b82f6", color: "#fff", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900 }}>1</span>
                  CLIQUE NO BOTÃO DE BATER PONTO:
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.textSub, lineHeight: 1.5 }}>
                  Na tela principal do aplicativo, localize o botão grande com o símbolo de relógio:
                </div>
                {/* Button Mockup Illustration */}
                <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
                  <div
                    style={{
                      background: "linear-gradient(135deg, #22c55e, #15803d)",
                      color: "#ffffff",
                      borderRadius: 16,
                      padding: "14px 28px",
                      fontSize: 17,
                      fontWeight: 900,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      boxShadow: "0 6px 18px rgba(34,197,94,0.35)",
                      border: "2px solid #ffffff"
                    }}
                  >
                    <Clock size={22} />
                    <span>🟢 BATER PONTO AGORA</span>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ background: t.surfaceAlt, border: `2px solid ${t.border}`, borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: t.text, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: "#3b82f6", color: "#fff", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900 }}>2</span>
                  CONFIRME A SUA LOCALIZAÇÃO GPS:
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.textSub, lineHeight: 1.5 }}>
                  Se o seu celular ou computador solicitar autorização para ver sua localização, clique no botão para **PERMITIR**:
                </div>
                {/* Button Mockup Illustration */}
                <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
                  <div
                    style={{
                      background: "#3b82f6",
                      color: "#ffffff",
                      borderRadius: 12,
                      padding: "10px 20px",
                      fontSize: 15,
                      fontWeight: 900,
                      display: "flex",
                      alignItems: "center",
                      gap: 8
                    }}
                  >
                    <MapPin size={18} />
                    <span>📍 Permitir Acesso à Localização</span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ background: t.surfaceAlt, border: `2px solid ${t.border}`, borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: t.text, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: "#3b82f6", color: "#fff", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900 }}>3</span>
                  ACOMPANHE OS BOTÕES DO DIA:
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.textSub, lineHeight: 1.5 }}>
                  Conforme o dia avança, clique no botão correspondente ao seu momento de trabalho:
                </div>

                {/* Buttons Grid Mockup */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
                  <div style={{ background: "#10b981", color: "#fff", padding: "10px 12px", borderRadius: 12, fontWeight: 900, fontSize: 14, textAlign: "center" }}>
                    🟢 Entrada
                  </div>
                  <div style={{ background: "#f59e0b", color: "#fff", padding: "10px 12px", borderRadius: 12, fontWeight: 900, fontSize: 14, textAlign: "center" }}>
                    🟡 Saída Almoço
                  </div>
                  <div style={{ background: "#3b82f6", color: "#fff", padding: "10px 12px", borderRadius: 12, fontWeight: 900, fontSize: 14, textAlign: "center" }}>
                    🔵 Volta Almoço
                  </div>
                  <div style={{ background: "#ef4444", color: "#fff", padding: "10px 12px", borderRadius: 12, fontWeight: 900, fontSize: 14, textAlign: "center" }}>
                    🔴 Saída Final
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DETAIL VIEW 2: COMO LANÇAR ATESTADO */}
          {selectedOption === "atestado" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0284c7", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                🩺 PASSO A PASSO: LANÇAR ATESTADO MÉDICO
              </div>

              {/* Step 1 */}
              <div style={{ background: t.surfaceAlt, border: `2px solid ${t.border}`, borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: t.text, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: "#0284c7", color: "#fff", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900 }}>1</span>
                  CLIQUE NO BOTÃO DE ATESTADO:
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.textSub, lineHeight: 1.5 }}>
                  No seu painel principal, clique no botão com ícone de estetoscópio:
                </div>
                {/* Button Mockup */}
                <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
                  <div
                    style={{
                      background: t.surfaceAlt,
                      border: `2px solid ${t.border}`,
                      borderRadius: 12,
                      padding: "10px 22px",
                      fontSize: 15,
                      fontWeight: 800,
                      color: t.text,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                    }}
                  >
                    <Stethoscope size={18} color="#3b82f6" />
                    <span>ATESTADO</span>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ background: t.surfaceAlt, border: `2px solid ${t.border}`, borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: t.text, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: "#0284c7", color: "#fff", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900 }}>2</span>
                  ANEXE O COMPROVANTE DO ATESTADO:
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.textSub, lineHeight: 1.5 }}>
                  Clique no botão de anexo para escolher o arquivo (foto ou PDF) salvo no seu dispositivo:
                </div>
                {/* Button Mockup */}
                <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
                  <div
                    style={{
                      background: t.surface,
                      border: "2px dashed #0284c7",
                      color: "#0284c7",
                      borderRadius: 14,
                      padding: "12px 20px",
                      fontSize: 15,
                      fontWeight: 900,
                      display: "flex",
                      alignItems: "center",
                      gap: 8
                    }}
                  >
                    <Upload size={20} />
                    <span>📁 Anexar Comprovante / Documento (PDF/Imagem)</span>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#d97706", background: "rgba(245,158,11,0.1)", padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(245,158,11,0.3)" }}>
                  💡 Nota: O envio do atestado é feito exclusivamente por anexo de arquivo.
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ background: t.surfaceAlt, border: `2px solid ${t.border}`, borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: t.text, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: "#0284c7", color: "#fff", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900 }}>3</span>
                  PREENCHA AS DATAS E CONCLUA O ENVIAR:
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.textSub, lineHeight: 1.5 }}>
                  Insira a Data Inicial, o número de dias e depois clique em **ENVIAR ATESTADO**:
                </div>
                {/* Button Mockup */}
                <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
                  <div
                    style={{
                      background: "#16a34a",
                      color: "#ffffff",
                      borderRadius: 14,
                      padding: "12px 24px",
                      fontSize: 16,
                      fontWeight: 900,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 4px 14px rgba(22,163,74,0.3)"
                    }}
                  >
                    <CheckCircle size={20} />
                    <span>💾 Enviar Atestado ao RH</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DETAIL VIEW 3: MARCACOES */}
          {selectedOption === "marcacoes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#6d28d9", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                📁 PASSO A PASSO: VER MARCAÇÕES E ESPELHO DE PONTO
              </div>

              {/* Step 1 */}
              <div style={{ background: t.surfaceAlt, border: `2px solid ${t.border}`, borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: t.text, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: "#8b5cf6", color: "#fff", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900 }}>1</span>
                  CLIQUE NA PASTINHA DE ESPELHO PDF / MARCAÇÕES:
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.textSub, lineHeight: 1.5 }}>
                  No seu painel, clique no botão com ícone de pasta:
                </div>
                {/* Button Mockup */}
                <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
                  <div
                    style={{
                      background: t.surfaceAlt,
                      border: `2px solid ${t.border}`,
                      borderRadius: 12,
                      padding: "10px 22px",
                      fontSize: 15,
                      fontWeight: 800,
                      color: t.text,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                    }}
                  >
                    <Folder size={18} color="#3b82f6" />
                    <span>ESPELHO PDF</span>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ background: t.surfaceAlt, border: `2px solid ${t.border}`, borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: t.text, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: "#8b5cf6", color: "#fff", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900 }}>2</span>
                  SELECIONE O MÊS E ANO DOWLOAD:
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.textSub, lineHeight: 1.5 }}>
                  Utilize a caixinha de seleção para trocar o mês e conferir dias anteriores, faltas, folgas e exportar o relatório oficial em PDF!
                </div>
              </div>
            </div>
          )}

          {/* DETAIL VIEW 4: CORRECAO */}
          {selectedOption === "correcao" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#b45309", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                ✏️ PASSO A PASSO: SOLICITAR CORREÇÃO
              </div>

              {/* Step 1 */}
              <div style={{ background: t.surfaceAlt, border: `2px solid ${t.border}`, borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: t.text, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: "#f59e0b", color: "#fff", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900 }}>1</span>
                  ABRA A SOLICITAÇÃO DE AJUSTE:
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.textSub, lineHeight: 1.5 }}>
                  Clique no botão de solicitação de correção no seu painel:
                </div>
                {/* Button Mockup */}
                <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
                  <div
                    style={{
                      background: t.surfaceAlt,
                      border: `2px solid ${t.border}`,
                      borderRadius: 12,
                      padding: "10px 22px",
                      fontSize: 15,
                      fontWeight: 800,
                      color: "#d97706",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                    }}
                  >
                    <SquarePen size={18} color="#d97706" />
                    <span>SOLICITAR CORREÇÃO</span>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ background: t.surfaceAlt, border: `2px solid ${t.border}`, borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: t.text, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: "#f59e0b", color: "#fff", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900 }}>2</span>
                  DIGITE A HORA CORRETA E A JUSTIFICATIVA:
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.textSub, lineHeight: 1.5 }}>
                  Informe o dia, a hora exata e o motivo (exemplo: "Esqueci de registrar na chegada") e clique no botão verde de envio:
                </div>
                {/* Button Mockup */}
                <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
                  <div
                    style={{
                      background: "#16a34a",
                      color: "#ffffff",
                      borderRadius: 14,
                      padding: "12px 24px",
                      fontSize: 16,
                      fontWeight: 900,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 4px 14px rgba(22,163,74,0.3)"
                    }}
                  >
                    <CheckCircle size={20} />
                    <span>📤 Enviar Solicitação para a Chefia</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Navigation */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: `1px solid ${t.border}`,
            background: t.surfaceAlt,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12
          }}
        >
          {selectedOption !== null ? (
            <button
              type="button"
              onClick={() => setSelectedOption(null)}
              style={{
                background: t.surface,
                border: `2px solid ${t.border}`,
                borderRadius: 14,
                padding: "12px 20px",
                fontSize: 15,
                fontWeight: 900,
                color: t.text,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8
              }}
            >
              <ArrowLeft size={18} />
              <span>VOLTAR AO MENU PRINCIPAL</span>
            </button>
          ) : (
            <div style={{ fontSize: 13, fontWeight: 800, color: t.textSub }}>
              Precisa de ajuda? Escolha uma das opções acima.
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#16a34a",
              color: "#ffffff",
              border: "none",
              borderRadius: 14,
              padding: "12px 24px",
              fontSize: 15,
              fontWeight: 900,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 14px rgba(22,163,74,0.3)"
            }}
          >
            <Check size={20} />
            <span>ENTENDI, FECHAR GUIA</span>
          </button>
        </div>
      </div>
    </div>
  );
};
