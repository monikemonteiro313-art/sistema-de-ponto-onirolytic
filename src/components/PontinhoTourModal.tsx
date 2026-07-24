import React, { useState } from "react";
import { ThemeColors } from "../types";
import { Clock, Camera, Edit3, CheckCircle, ChevronRight, ChevronLeft, HelpCircle, X, Sparkles, VolumeX } from "lucide-react";

interface PontinhoTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: ThemeColors;
  userName?: string;
  initialStep?: number;
}

export const PontinhoTourModal: React.FC<PontinhoTourModalProps> = ({
  isOpen,
  onClose,
  t,
  userName = "COLABORADOR(A)",
  initialStep = 1
}) => {
  const [step, setStep] = useState<number>(initialStep);
  const totalSteps = 7;

  React.useEffect(() => {
    if (isOpen) {
      setStep(initialStep || 1);
    }
  }, [isOpen, initialStep]);

  if (!isOpen) return null;

  // Mascot expressions/poses per step
  const getMascotExpression = (s: number) => {
    switch (s) {
      case 1:
        return {
          eyeLeft: "circle",
          eyeRight: "circle",
          mouth: "happy",
          hand: "wave",
          bg: "#3b82f6",
          badge: "👋 OLÁ!"
        };
      case 2:
        return {
          eyeLeft: "wink",
          eyeRight: "circle",
          mouth: "smile",
          hand: "point_down",
          bg: "#8b5cf6",
          badge: "🔍 ATENÇÃO AQUI!"
        };
      case 3:
        return {
          eyeLeft: "sparkle",
          eyeRight: "sparkle",
          mouth: "open_smile",
          hand: "pin",
          bg: "#10b981",
          badge: "📍 LOCALIZAÇÃO GPS!"
        };
      case 4:
        return {
          eyeLeft: "circle",
          eyeRight: "circle",
          mouth: "pensei",
          hand: "write",
          bg: "#f59e0b",
          badge: "✍️ DIGITE A HORA!"
        };
      case 5:
        return {
          eyeLeft: "sparkle",
          eyeRight: "circle",
          mouth: "smile",
          hand: "wave",
          bg: "#ec4899",
          badge: "⏰ OPÇÕES DO EXPEDIENTE!"
        };
      case 6:
        return {
          eyeLeft: "sparkle",
          eyeRight: "circle",
          mouth: "smile",
          hand: "write",
          bg: "#0284c7",
          badge: "📋 LANÇAR ATESTADO!"
        };
      case 7:
        return {
          eyeLeft: "star",
          eyeRight: "star",
          mouth: "big_smile",
          hand: "thumbs_up",
          bg: "#22c55e",
          badge: "🎉 PRONTO!"
        };
      default:
        return {
          eyeLeft: "circle",
          eyeRight: "circle",
          mouth: "smile",
          hand: "wave",
          bg: "#3b82f6",
          badge: " Pontinho"
        };
    }
  };

  const expr = getMascotExpression(step);

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
          maxWidth: 680,
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          position: "relative"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div
          style={{
            padding: "16px 20px",
            background: `linear-gradient(135deg, ${expr.bg}, #1e293b)`,
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
                background: "rgba(255,255,255,0.2)",
                borderRadius: 12,
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: "0.5px"
              }}
            >
              PASSO {step} DE {totalSteps}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>
              GUIA INTERATIVO DO PONTO DIGITAL
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                background: "rgba(255,255,255,0.15)",
                padding: "4px 8px",
                borderRadius: 20,
                display: "flex",
                alignItems: "center",
                gap: 4
              }}
              title="O Pontinho é um assistente mudo que orienta por texto na tela"
            >
              <VolumeX size={12} /> MASCOTE MUDO
            </span>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                cursor: "pointer",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: "bold"
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div
          style={{
            padding: "24px 20px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 20
          }}
        >
          {/* Mascot Header Section */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              background: t.surfaceAlt,
              padding: 16,
              borderRadius: 20,
              border: `1.5px solid ${t.border}`
            }}
          >
            {/* Cute Mascot SVG "Pontinho" */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <svg width="84" height="84" viewBox="0 0 100 100" style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.15))" }}>
                {/* Body ball */}
                <circle cx="50" cy="50" r="44" fill={expr.bg} />
                <circle cx="50" cy="50" r="44" fill="url(#ballGlow)" opacity="0.3" />
                <defs>
                  <radialGradient id="ballGlow" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
                  </radialGradient>
                </defs>

                {/* Blushing cheeks */}
                <ellipse cx="28" cy="58" rx="7" ry="4" fill="#f43f5e" opacity="0.4" />
                <ellipse cx="72" cy="58" rx="7" ry="4" fill="#f43f5e" opacity="0.4" />

                {/* Left Eye */}
                {expr.eyeLeft === "sparkle" || expr.eyeLeft === "star" ? (
                  <text x="24" y="46" fontSize="18" textAnchor="middle" fill="#ffffff">✨</text>
                ) : expr.eyeLeft === "wink" ? (
                  <path d="M 22 42 Q 28 36 34 42" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
                ) : (
                  <g>
                    <circle cx="28" cy="42" r="7" fill="#ffffff" />
                    <circle cx="30" cy="40" r="3.5" fill="#0f172a" />
                    <circle cx="32" cy="38" r="1.5" fill="#ffffff" />
                  </g>
                )}

                {/* Right Eye */}
                {expr.eyeRight === "sparkle" || expr.eyeRight === "star" ? (
                  <text x="76" y="46" fontSize="18" textAnchor="middle" fill="#ffffff">✨</text>
                ) : (
                  <g>
                    <circle cx="72" cy="42" r="7" fill="#ffffff" />
                    <circle cx="74" cy="40" r="3.5" fill="#0f172a" />
                    <circle cx="76" cy="38" r="1.5" fill="#ffffff" />
                  </g>
                )}

                {/* Mouth */}
                {expr.mouth === "big_smile" ? (
                  <path d="M 32 58 Q 50 78 68 58 Z" fill="#ffffff" />
                ) : expr.mouth === "open_smile" ? (
                  <path d="M 34 58 Q 50 74 66 58 Z" fill="#ffffff" />
                ) : expr.mouth === "pensei" ? (
                  <circle cx="50" cy="62" r="5" fill="#ffffff" />
                ) : (
                  <path d="M 34 56 Q 50 70 66 56" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
                )}

                {/* Cute little feet */}
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
                {expr.badge}
              </div>
            </div>

            {/* Mascot Speech Bubble (MUTE / TEXT ONLY) */}
            <div
              style={{
                flex: 1,
                background: t.surface,
                border: `2px solid ${expr.bg}`,
                borderRadius: 16,
                padding: "14px 16px",
                position: "relative",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: expr.bg,
                  letterSpacing: "0.5px",
                  marginBottom: 4
                }}
              >
                PONTINHO DIZ (EM CAIXA ALTA PARA FACILITAR A LEITURA):
              </div>

              {step === 1 && (
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text, lineHeight: 1.45 }}>
                  "OLÁ, {userName.toUpperCase()}! EU SOU O PONTINHO! VOU TE ENSINAR A REGISTRAR O SEU PONTO DE FORMA MUITO SIMPLES!"
                </div>
              )}

              {step === 2 && (
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text, lineHeight: 1.45 }}>
                  "QUANDO VOCÊ CLICA PARA BATER O PONTO, O SISTEMA MOSTRA 2 OPÇÕES PRINCIPAIS. VEJA A DIFERENÇA ENTRE ELAS LOGO ABAIXO!"
                </div>
              )}

              {step === 3 && (
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text, lineHeight: 1.45 }}>
                  "SE VOCÊ ESCOLHEU 'REGISTRAR AGORA': O SISTEMA REGISTRA SUA LOCALIZAÇÃO GPS AUTOMATICAMENTE NO MOMENTO EXATO, SEM PRECISAR DE CÂMERA!"
                </div>
              )}

              {step === 4 && (
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text, lineHeight: 1.45 }}>
                  "SE VOCÊ ESCOLHEU 'INCORPORAR MANUAMENTE': INFORME A HORA E A JUSTIFICATIVA (OBRIGATÓRIA). O PONTO FICARÁ COM MARCAÇÃO (M) E IRÁ PARA APROVAÇÃO DO SEU GESTOR!"
                </div>
              )}

              {step === 5 && (
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text, lineHeight: 1.45 }}>
                  "DEPOIS DE REGISTRAR A PRIMEIRA MARCAÇÃO, AS DEMAIS OPÇÕES DE MARCAÇÃO APARECERÃO NA SUA TELA. VEJA COMO FUNCIONA CADA UMA DELAS!"
                </div>
              )}

              {step === 6 && (
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text, lineHeight: 1.45 }}>
                  "PRECISA ENVIAR UM ATESTADO MÉDICO? VEJA COMO PREENCHER A DATA, O CÓDIGO CID E COMO FUNCIONAM OS ATESTADOS DE APENAS ALGUMAS HORAS!"
                </div>
              )}

              {step === 7 && (
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text, lineHeight: 1.45 }}>
                  "ÚLTIMO PASSO: CLIQUE EM 'CONFIRMAR E ENVIAR'! UMA MENSAGEM VERDE IRÁ APARECER CONFIRMANDO QUE SEU PONTO FOI SALVO!"
                </div>
              )}
            </div>
          </div>

          {/* STEP 1 DETAILS */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: t.text, textTransform: "uppercase" }}>
                1. COMO ENCONTRAR O BOTÃO DE ENTRADA / SAÍDA
              </div>

              <div
                style={{
                  background: t.surfaceAlt,
                  border: `2px dashed ${t.border}`,
                  borderRadius: 18,
                  padding: "20px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12
                }}
              >
                <div
                  style={{
                    background: "rgba(59,130,246,0.12)",
                    border: "3px solid #3b82f6",
                    borderRadius: "50%",
                    width: 64,
                    height: 64,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 0 8px rgba(59,130,246,0.15)"
                  }}
                >
                  <Clock size={32} color="#3b82f6" />
                </div>

                <div style={{ fontSize: 20, fontWeight: 900, color: "#3b82f6", letterSpacing: "0.5px" }}>
                  ENTRADA
                </div>

                <div style={{ fontSize: 15, fontWeight: 800, color: t.text, textTransform: "uppercase", maxWidth: 460 }}>
                  NA TELA INICIAL DO SEU PAINEL, VOCÊ VERÁ UM BOTÃO GRANDE E COLORIDO COMO ESTE NO CENTRO.
                </div>

                <div style={{ fontSize: 14, fontWeight: 700, color: t.textSub, textTransform: "uppercase", background: t.surface, padding: "10px 16px", borderRadius: 12, border: `1px solid ${t.border}` }}>
                  👉 PASSO: BASTA DAR UM TOQUE EM CIMA DO BOTÃO PARA COMEÇAR A MARCAÇÃO DO SEU HORÁRIO.
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 DETAILS: CIRCLED COMPARISON */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: t.text, textTransform: "uppercase" }}>
                2. ENTENDA AS DUAS OPÇÕES DE MARCAÇÃO
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
                {/* Option 1: Registrar Agora */}
                <div
                  style={{
                    background: "rgba(16,185,129,0.08)",
                    border: "3px solid #10b981",
                    borderRadius: 18,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    position: "relative"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 900, color: "#059669", textTransform: "uppercase" }}>
                      <Camera size={22} />
                      OPÇÃO 1: ✓ REGISTRAR AGORA
                    </div>
                    <span style={{ background: "#10b981", color: "#ffffff", fontSize: 11, fontWeight: 900, padding: "4px 10px", borderRadius: 12 }}>
                      USO NO MOMENTO EXATO
                    </span>
                  </div>

                  <div style={{ fontSize: 15, fontWeight: 800, color: t.text, textTransform: "uppercase", lineHeight: 1.45 }}>
                    USE ESTA OPÇÃO SE VOCÊ ESTÁ BANTENDO O PONTO NO MOMENTO CERTO EM QUE ESTÁ ENTRANDO OU SAINDO DA EMPRESA.
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 700, color: t.textSub, textTransform: "uppercase", background: t.surface, padding: "8px 12px", borderRadius: 10, border: `1px solid ${t.border}` }}>
                    📌 REGISTRA SUA LOCALIZAÇÃO DE GPS DE FORMA AUTOMÁTICA E IMEDIATA, SEM PRECISAR DE CÂMERA.
                  </div>
                </div>

                {/* Option 2: Incorporar Manualmente */}
                <div
                  style={{
                    background: "rgba(245,158,11,0.08)",
                    border: "3px solid #f59e0b",
                    borderRadius: 18,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    position: "relative"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 900, color: "#d97706", textTransform: "uppercase" }}>
                      <Edit3 size={22} />
                      OPÇÃO 2: ✍️ INCORPORAR MANUAMENTE
                    </div>
                    <span style={{ background: "#f59e0b", color: "#ffffff", fontSize: 11, fontWeight: 900, padding: "4px 10px", borderRadius: 12 }}>
                      ESQUECIMENTO OU AJUSTE
                    </span>
                  </div>

                  <div style={{ fontSize: 15, fontWeight: 800, color: t.text, textTransform: "uppercase", lineHeight: 1.45 }}>
                    USE ESTA OPÇÃO SE VOCÊ ESQUECEU DE BATER O PONTO MAIS CEDO, OU SE FICOU SEM INTERNET NO HORÁRIO DA ENTRADA.
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 700, color: t.textSub, textTransform: "uppercase", background: t.surface, padding: "8px 12px", borderRadius: 10, border: `1px solid ${t.border}` }}>
                    📌 VOCÊ DEVE INFORMAR O HORÁRIO E A JUSTIFICATIVA (OBRIGATÓRIA). O PONTO É IDENTIFICADO COM (M) E VAI PARA APROVAÇÃO DO RH.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 DETAILS: REGISTRAR AGORA (LOCALIZACAO) */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#059669", textTransform: "uppercase" }}>
                3. COMO REGISTRAR COM LOCALIZAÇÃO GPS (REGISTRAR AGORA)
              </div>

              <div style={{ background: t.surfaceAlt, border: `2px solid ${t.border}`, borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, background: t.surface, padding: 12, borderRadius: 12, border: `1px solid ${t.border}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#10b981", color: "#fff", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>1</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: t.text, textTransform: "uppercase" }}>
                    CLIQUE NO BOTÃO "REGISTRAR AGORA" NA TELA
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, background: t.surface, padding: 12, borderRadius: 12, border: `1px solid ${t.border}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#10b981", color: "#fff", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>2</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: t.text, textTransform: "uppercase" }}>
                    O NAVEGADOR PEDIRÁ AUTORIZAÇÃO PARA ACESSAR SUA GEOLOCALIZAÇÃO
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, background: t.surface, padding: 12, borderRadius: 12, border: `1px solid ${t.border}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#10b981", color: "#fff", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>3</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: t.text, textTransform: "uppercase" }}>
                    CLIQUE EM "PERMITIR". O PONTO É GRAVADO IMEDIATAMENTE!
                  </div>
                </div>

                <div style={{ background: "rgba(59,130,246,0.1)", border: "1.5px solid #3b82f6", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 800, color: t.text, textTransform: "uppercase", textAlign: "center" }}>
                  💡 DICA DE LOCALIZAÇÃO: MANTENHA O GPS/LOCALIZAÇÃO DO SEU CELULAR ATIVADO PARA VALIDAR A PRESENÇA FÍSICA.
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 DETAILS: INCORPORAR MANUALMENTE */}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#d97706", textTransform: "uppercase" }}>
                4. COMO PREENCHER A INCORPORAÇÃO MANUAL
              </div>

              <div style={{ background: t.surfaceAlt, border: `2px solid ${t.border}`, borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, background: t.surface, padding: 12, borderRadius: 12, border: `1px solid ${t.border}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f59e0b", color: "#fff", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>1</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: t.text, textTransform: "uppercase" }}>
                    DIGITE O HORÁRIO CORRETO QUE TRABALHOU (EXEMPLO: 08:00)
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, background: t.surface, padding: 12, borderRadius: 12, border: `1px solid ${t.border}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f59e0b", color: "#fff", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>2</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: t.text, textTransform: "uppercase" }}>
                    ESCREVA A JUSTIFICATIVA (EXEMPLO: "ESQUECI DE MARCAR NA CHEGADA" OU "PROBLEMA NO CELULAR")
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, background: t.surface, padding: 12, borderRadius: 12, border: `1px solid ${t.border}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f59e0b", color: "#fff", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>3</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: t.text, textTransform: "uppercase" }}>
                    CLIQUE NO BOTÃO "GRAVAR INCORPORAÇÃO MANUAL"
                  </div>
                </div>

                <div style={{ background: "rgba(245,158,11,0.1)", border: "1.5px solid #f59e0b", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 800, color: t.text, textTransform: "uppercase", textAlign: "center" }}>
                  ⚠️ ATENÇÃO: MARCAÇÕES MANUAIS FICAM IDENTIFICADAS E PASSAM PELA CONFERÊNCIA DO SEU GESTOR DE RH.
                </div>
              </div>
            </div>
          )}

          {/* STEP 5 DETAILS: DEMAIS MARCAÇÕES E OPÇÕES DO EXPEDIENTE */}
          {step === 5 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#ec4899", textTransform: "uppercase" }}>
                5. ENTENDA AS OPÇÕES QUE APARECEM APÓS A PRIMEIRA MARCAÇÃO
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Saída Sem Almoço */}
                <div style={{ background: "rgba(239,68,68,0.08)", border: "2px solid #ef4444", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#dc2626", textTransform: "uppercase" }}>
                    🔴 SAÍDA SEM ALMOÇO
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: t.text, textTransform: "uppercase", lineHeight: 1.4 }}>
                    SERVE PARA FINAIS DE SEMANA, PARA QUEM TRABALHA DIRETO OU VAI EMBORA MAIS CEDO.
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.textSub, textTransform: "uppercase", background: t.surface, padding: "6px 10px", borderRadius: 8, border: `1px solid ${t.border}` }}>
                    👉 AO CLICAR, VOCÊ ENCERRA SEU EXPEDIENTE DO DIA E VAI PARA CASA!
                  </div>
                </div>

                {/* Almoço e Volta */}
                <div style={{ background: "rgba(245,158,11,0.08)", border: "2px solid #f59e0b", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#d97706", textTransform: "uppercase" }}>
                    🟡 ALMOÇO E VOLTA DO ALMOÇO
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: t.text, textTransform: "uppercase", lineHeight: 1.4 }}>
                    SE VOCÊ ESTÁ INDO ALMOÇAR, CLIQUE EM <span style={{ color: "#d97706" }}>"ALMOÇO"</span> PARA COMECAR O SEU INTERVALO.
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: t.text, textTransform: "uppercase", lineHeight: 1.4 }}>
                    QUANDO SEU ALMOÇO TERMINAR, CLIQUE EM <span style={{ color: "#10b981" }}>"VOLTA"</span> PARA RETORNAR AO TRABALHO.
                  </div>
                </div>

                {/* Saída Final */}
                <div style={{ background: "rgba(59,130,246,0.08)", border: "2px solid #3b82f6", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#2563eb", textTransform: "uppercase" }}>
                    🔵 SAÍDA FINAL DO EXPEDIENTE
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: t.text, textTransform: "uppercase", lineHeight: 1.4 }}>
                    QUANDO SEU EXPEDIENTE TERMINAR NO FIM DO DIA, CLIQUE EM <span style={{ color: "#2563eb" }}>"SAÍDA"</span>.
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>
                    📌 NOTA: A OPÇÃO DE SAÍDA FINAL SÓ APARECE APÓS VOCÊ REGISTRAR A VOLTA DO ALMOÇO.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6 DETAILS: COMO LANÇAR ATESTADO MÉDICO */}
          {step === 6 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0284c7", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                📋 COMO LANÇAR SEU ATESTADO MÉDICO
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Ícone e acesso */}
                <div style={{ background: "rgba(2,132,199,0.08)", border: "2px solid #0284c7", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#0284c7", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                    📋 1. CLIQUE NO BOTÃO "LANÇAR ATESTADO"
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, lineHeight: 1.4 }}>
                    Localize o botão com o ícone de atestado 📋 no seu painel para abrir o formulário de envio do documento médico.
                  </div>
                </div>

                {/* Datas do Atestado */}
                <div style={{ background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: t.text, textTransform: "uppercase" }}>
                    📅 2. INFORME AS DATAS CONFORME O ATESTADO
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.textSub, lineHeight: 1.4 }}>
                    • <strong>Data de Início e Retorno:</strong> Selecione o período exato estipulado pelo seu médico.<br/>
                    • <strong>Atestado de 1 dia:</strong> Coloque a mesma data no campo Inicial e no campo Final.
                  </div>
                </div>

                {/* CID e Anexo */}
                <div style={{ background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: t.text, textTransform: "uppercase" }}>
                    📑 3. DIGITE O CÓDIGO CID E ANEXE A FOTO
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.textSub, lineHeight: 1.4 }}>
                    • <strong>CID:</strong> Insira o código da doença que consta no documento (ex: M54, J11, Z00). Caso o médico não tenha anotado por sigilo, pode ser deixado em branco ou conforme norma interna.<br/>
                    • <strong>Foto do Atestado:</strong> Anexe uma foto bem nítida e legível do documento para validação do RH.
                  </div>
                </div>

                {/* Dia Inteiro vs Horas Parciais */}
                <div style={{ background: "rgba(245,158,11,0.08)", border: "2px solid #f59e0b", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#d97706", textTransform: "uppercase" }}>
                    ⏱️ 4. ATESTADO DE APENAS HORAS (PARCIAL) VS DIA INTEIRO
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: t.text, lineHeight: 1.45 }}>
                    🔴 <strong>Atestado de Dia Inteiro:</strong> Cobre a jornada completa do dia e encerra o expediente daquela data.<br/><br/>
                    🟡 <strong>Atestado Parcial (Apenas Horas):</strong> Marque a opção <em>"Atestado de Horas (Parcial)"</em> e insira o horário inicial e final do atendimento (ex: 08:30 às 10:30).
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#dc2626", background: "rgba(239,68,68,0.1)", padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", lineHeight: 1.4 }}>
                    ⚠️ <strong>ATENÇÃO:</strong> O ATESTADO PARCIAL NÃO ENCERRA O SEU EXPEDIENTE! VOCÊ CONTINUARÁ TRABALHANDO E REGISTRANDO NORMALMENTE SUAS OUTRAS BATIDAS DE PONTO (ENTRADA, ALMOÇO, VOLTA OU SAÍDA) NO RESTANTE DO DIA.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 7 DETAILS: ENVIAR E CONFIRMAR */}
          {step === 7 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#16a34a", textTransform: "uppercase" }}>
                7. CONFIRMAÇÃO E CONCLUSÃO DA MARCAÇÃO
              </div>

              <div style={{ background: "rgba(34,197,94,0.08)", border: "2px solid #22c55e", borderRadius: 18, padding: 20, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <CheckCircle size={56} color="#22c55e" />

                <div style={{ fontSize: 20, fontWeight: 900, color: "#16a34a", textTransform: "uppercase" }}>
                  MARCAÇÃO CONCLUÍDA COM SUCESSO!
                </div>

                <div style={{ fontSize: 15, fontWeight: 800, color: t.text, textTransform: "uppercase", maxWidth: 520, lineHeight: 1.45 }}>
                  APÓS CLICAR EM CONFIRMAR, UMA FAIXA VERDE APARECERÁ NA TELA CONFIRMANDO QUE O SEU PONTO FOI SALVO COM SEGURANÇA NO SISTEMA.
                </div>

                <div style={{ background: t.surface, padding: "12px 18px", borderRadius: 14, border: `1px solid ${t.border}`, width: "100%", maxWidth: 500 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: t.textSub, textTransform: "uppercase" }}>
                    🤖 DÚVIDAS NO DIA A DIA?
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: t.text, textTransform: "uppercase", marginTop: 4 }}>
                    VOCÊ PODERÁ REVISITAR ESTE PASSO A PASSO A QUALQUER MOMENTO CLICANDO NO BOTÃO <span style={{ color: t.accent }}>"🤖 GUIA PASSO A PASSO"</span> NO SEU PAINEL!
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Controls */}
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
          <button
            type="button"
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            style={{
              background: step === 1 ? t.surface : t.surfaceAlt,
              border: `1px solid ${t.border}`,
              borderRadius: 14,
              padding: "12px 18px",
              fontSize: 14,
              fontWeight: 800,
              color: step === 1 ? t.textMuted : t.text,
              cursor: step === 1 ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              textTransform: "uppercase"
            }}
          >
            <ChevronLeft size={18} /> VOLTAR
          </button>

          {/* Dots Indicator */}
          <div style={{ display: "flex", gap: 6 }}>
            {Array.from({ length: totalSteps }).map((_, idx) => (
              <div
                key={idx}
                onClick={() => setStep(idx + 1)}
                style={{
                  width: idx + 1 === step ? 24 : 10,
                  height: 10,
                  borderRadius: 5,
                  background: idx + 1 === step ? expr.bg : t.border,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              />
            ))}
          </div>

          {step < totalSteps ? (
            <button
              type="button"
              onClick={() => setStep(s => Math.min(totalSteps, s + 1))}
              style={{
                background: expr.bg,
                color: "#ffffff",
                border: "none",
                borderRadius: 14,
                padding: "12px 22px",
                fontSize: 15,
                fontWeight: 900,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: `0 4px 14px ${expr.bg}44`,
                textTransform: "uppercase"
              }}
            >
              PRÓXIMO PASSO <ChevronRight size={20} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "#22c55e",
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
                boxShadow: "0 4px 14px rgba(34,197,94,0.4)",
                textTransform: "uppercase"
              }}
            >
              ENTENDI TUDO, CONCLUIR GUIA! ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
