import React from "react";
import { ShieldCheck, Eye, MapPin, Lock, FileText, Database, X } from "lucide-react";
import { ThemeColors } from "../types";

interface LgpdModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: ThemeColors;
}

export function LgpdModal({ isOpen, onClose, t }: LgpdModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: t.surface,
        display: "flex",
        flexDirection: "column",
        zIndex: 9999,
        overflow: "hidden",
        animation: "fadeIn 0.22s ease-out",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: `1px solid ${t.border}`,
          background: t.surfaceAlt,
        }}
      >
        <div
          style={{
            maxWidth: 800,
            width: "100%",
            margin: "0 auto",
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `rgba(34, 197, 94, 0.1)`,
                border: `1.5px solid rgba(34, 197, 94, 0.25)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={22} color="#22c55e" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>
                Conformidade LGPD & Uso de Dados
              </h3>
              <p style={{ fontSize: 12, color: t.textSub, margin: "2px 0 0 0" }}>
                Garantia de privacidade e proteção aos seus registros de ponto
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 6,
              borderRadius: 8,
              color: t.textSub,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = t.border;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content Container (Scrollable) */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          background: t.surface,
        }}
      >
        <div
          style={{
            maxWidth: 800,
            width: "100%",
            margin: "0 auto",
            padding: "32px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
            boxSizing: "border-box",
          }}
        >
          {/* Brief explanation */}
          <div
            style={{
              background: t.surfaceAlt,
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              padding: "16px 20px",
              fontSize: 13.5,
              color: t.textSub,
              lineHeight: "1.6",
            }}
          >
            A presente plataforma opera em estrito cumprimento com a <strong>Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD)</strong>. A transparência e a segurança dos dados de jornada são fundamentais para o Cérebro de Autocura e para o sistema de ponto.
          </div>

          {/* List of compliance areas */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Item 1: Finalidade Legítima */}
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ color: t.accent, marginTop: 2, flexShrink: 0 }}>
                <FileText size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: 14.5, fontWeight: 600, color: t.text, margin: "0 0 6px 0" }}>
                  1. Finalidade Legítima (Base Legal: Execução de Contrato)
                </h4>
                <p style={{ fontSize: 13, color: t.textSub, margin: 0, lineHeight: "1.55" }}>
                  Seus dados de marcação de ponto (horários de entrada, intervalo e saída) são coletados única e exclusivamente para a execução do contrato de trabalho, cumprimento de obrigações legais (Art. 7º, V da LGPD e Portaria 671 MTE) e fechamento de folha de pagamento.
                </p>
              </div>
            </div>

            {/* Item 2: Consentimento e Transparência */}
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ color: t.accent, marginTop: 2, flexShrink: 0 }}>
                <Eye size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: 14.5, fontWeight: 600, color: t.text, margin: "0 0 6px 0" }}>
                  2. Transparência Plena & Consentimento
                </h4>
                <p style={{ fontSize: 13, color: t.textSub, margin: 0, lineHeight: "1.55" }}>
                  Você aceita o Termo de Ciência antes de utilizar o sistema e possui visibilidade total de suas marcações em tempo real através do painel pessoal. Nenhum dado de ponto é compartilhado com terceiros sem seu consentimento expresso.
                </p>
              </div>
            </div>

            {/* Item 3: Geolocalização */}
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ color: t.accent, marginTop: 2, flexShrink: 0 }}>
                <MapPin size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: 14.5, fontWeight: 600, color: t.text, margin: "0 0 6px 0" }}>
                  3. Coleta de Geolocalização Delimitada
                </h4>
                <p style={{ fontSize: 13, color: t.textSub, margin: 0, lineHeight: "1.55" }}>
                  A coleta ocorre <strong>apenas no instante do clique</strong> para registrar o ponto. O aplicativo <strong>não monitora sua localização em segundo plano</strong> ou de forma contínua.
                </p>
              </div>
            </div>

            {/* Item 4: Segurança e Imutabilidade */}
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ color: t.accent, marginTop: 2, flexShrink: 0 }}>
                <Lock size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: 14.5, fontWeight: 600, color: t.text, margin: "0 0 6px 0" }}>
                  4. Segurança, Integridade e "Autocura"
                </h4>
                <p style={{ fontSize: 13, color: t.textSub, margin: 0, lineHeight: "1.55" }}>
                  Todos os dados são salvos de forma protegida e autenticada. Alterações manuais e inconsistências temporais do relógio local do usuário são auditadas pelo <strong>Cérebro de Autocura</strong> para evitar adulterações fraudes, assegurando que o registro seja totalmente confiável perante a lei.
                </p>
              </div>
            </div>

            {/* Item 5: Direitos dos Titulares */}
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ color: t.accent, marginTop: 2, flexShrink: 0 }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: 14.5, fontWeight: 600, color: t.text, margin: "0 0 6px 0" }}>
                  5. Direitos do Titular (Artigo 18 da LGPD)
                </h4>
                <p style={{ fontSize: 13, color: t.textSub, margin: 0, lineHeight: "1.55" }}>
                  Você pode requerer a confirmação da existência do tratamento de seus dados, obter acesso facilitado a todo o seu histórico, bem como solicitar a retificação ou inserção de justificativas para pontos orfãos e ausências diretamente ao administrador.
                </p>
              </div>
            </div>

            {/* Item 6: Retenção e Descarte Seguro */}
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ color: t.accent, marginTop: 2, flexShrink: 0 }}>
                <Database size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: 14.5, fontWeight: 600, color: t.text, margin: "0 0 6px 0" }}>
                  6. Retenção de Dados Regulamentar
                </h4>
                <p style={{ fontSize: 13, color: t.textSub, margin: 0, lineHeight: "1.55" }}>
                  Seus dados são armazenados de forma criptografada na nuvem do Google Firestore apenas durante o período de vigência de seu contrato laboral e prazos legais de auditoria trabalhista, após os quais são permanentemente excluídos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: `1px solid ${t.border}`,
          background: t.surfaceAlt,
        }}
      >
        <div
          style={{
            maxWidth: 800,
            width: "100%",
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            justifyContent: "flex-end",
            boxSizing: "border-box",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: t.accent,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = t.accentHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = t.accent;
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
