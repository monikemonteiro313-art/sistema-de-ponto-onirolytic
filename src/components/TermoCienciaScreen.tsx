import React, { useState, useRef } from "react";
import { Shield, Check } from "lucide-react";
import { ThemeColors, User } from "../types";

interface TermoCienciaScreenProps {
  t: ThemeColors;
  currentUser: User;
  onAceitar: () => void;
  onRecusar: () => void;
}

export function TermoCienciaScreen({ t, currentUser, onAceitar, onRecusar }: TermoCienciaScreenProps) {
  const [scrolled, setScrolled] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      setScrolled(true);
    }
  }

  function aceitar() {
    setLoading(true);
    setTimeout(() => onAceitar(), 800);
  }

  const firstName = currentUser?.nome?.split(" ")[0] || "Colaboradora";
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px",
        fontFamily: "'DM Sans','Segoe UI',sans-serif"
      }}
    >
      <div
        style={{
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          borderRadius: 20,
          width: "100%",
          maxWidth: 520,
          boxShadow: t.shadow,
          overflow: "hidden"
        }}
      >
        {/* Header */}
        <div
          style={{
            background: `linear-gradient(135deg, ${t.accent}22, ${t.accent}08)`,
            borderBottom: `1.5px solid ${t.border}`,
            padding: "24px 28px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                background: `linear-gradient(135deg, ${t.accent}, #2040CC)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <Shield size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text }}>Termo de Ciência e Uso</h2>
              <p style={{ margin: 0, fontSize: "12.5px", color: t.textSub }}>Leia com atenção antes de continuar</p>
            </div>
          </div>
          <div style={{ background: t.accentGlow, border: `1.5px solid ${t.borderFocus}`, borderRadius: 8, padding: "8px 12px" }}>
            <span style={{ fontSize: "12.5px", color: t.accent, fontWeight: 600 }}>
              Olá, {firstName}! Este é seu primeiro acesso. Antes de continuar, leia e aceite os termos abaixo.
            </span>
          </div>
        </div>

        {/* scrollable area */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            padding: "22px 28px",
            maxHeight: 320,
            overflowY: "auto",
            fontSize: "13.5px",
            color: t.textSub,
            lineHeight: 1.75
          }}
        >
          <p style={{ margin: "0 0 14px", fontWeight: 700, color: t.text, fontSize: 14 }}>
            1. Finalidade do tratamento de dados
          </p>
          <p style={{ margin: "0 0 14px" }}>
            Este sistema coleta e armazena seus dados de jornada de trabalho — horários de entrada, saídas e retornos — exclusivamente para fins de controle de frequência e cumprimento das obrigações previstas na <strong style={{ color: t.text }}>Consolidação das Leis do Trabalho (CLT)</strong> e na <strong style={{ color: t.text }}>Portaria 671/2021</strong> do Ministério do Trabalho.
          </p>

          <p style={{ margin: "0 0 14px", fontWeight: 700, color: t.text, fontSize: 14 }}>2. Dados coletados</p>
          <p style={{ margin: "0 0 14px" }}>
            São coletados: nome, matrícula, horários de ponto (entrada, saída para almoço, retorno e saída), registros de ocorrências e logs de acesso ao sistema. Nenhum dado sensível como biometria ou localização é coletada de forma automatizada e invasiva.
          </p>

          <p style={{ margin: "0 0 14px", fontWeight: 700, color: t.text, fontSize: 14 }}>
            3. Base legal (LGPD — Lei 13.709/2018)
          </p>
          <p style={{ margin: "0 0 14px" }}>
            O tratamento dos seus dados tem como base legal o cumprimento de <strong style={{ color: t.text }}>obrigação legal</strong> (Art. 7º, II da LGPD), dispensando consentimento específico para esta finalidade. Os dados serão retidos pelo prazo mínimo de <strong style={{ color: t.text }}>5 anos</strong>, conforme exigência da CLT.
          </p>

          <p style={{ margin: "0 0 14px", fontWeight: 700, color: t.text, fontSize: 14 }}>4. Seus direitos como titular</p>
          <p style={{ margin: "0 0 14px" }}>
            Você tem direito a: confirmar a existência do tratamento, acessar seus dados, solicitar correção de dados incompletos ou incorretos, e obter informações sobre com quem seus dados foram compartilhados. Para exercer seus direitos, entre em contato diretamente com o setor de Recursos Humanos.
          </p>

          <p style={{ margin: "0 0 14px", fontWeight: 700, color: t.text, fontSize: 14 }}>
            5. Registros manuais e auditoria
          </p>
          <p style={{ margin: "0 0 14px" }}>
            Inserções manuais de ponto ficam registradas com o horário exato em que foram feitas, para fins de auditoria. Qualquer alteração feita por operadores administrativos também é rastreável.
          </p>

          <p style={{ margin: "0 0 14px", fontWeight: 700, color: t.text, fontSize: 14 }}>6. Segurança</p>
          <p style={{ margin: "0 0 14px" }}>
            Seus dados são acessados apenas por administradores autorizados. O sistema mantém log imutável de todas as ações administrativas realizadas sobre seus dados, incluindo registros de acesso.
          </p>

          <p style={{ margin: "0 0 14px", fontWeight: 700, color: t.text, fontSize: 14 }}>
            7. Rastreabilidade das Marcações de Ponto
          </p>
          <p style={{ margin: "0 0 14px" }}>
            Todas as marcações de ponto realizadas neste sistema <strong style={{ color: t.text }}>são 100% rastreáveis</strong>. Para garantir a fidedignidade do registro contratual e a conformidade legal, cada marcação armazena automaticamente o horário exato de registro no servidor, as coordenadas de geolocalização e metadados de rede coletados. A manipulação ou adulteração desses dados é estritamente proibida e auditada pelo sistema.
          </p>

          <p style={{ margin: "0 0 14px", fontWeight: 700, color: t.text, fontSize: 14 }}>
            8. Encarregado de Dados (DPO) — Art. 41 LGPD
          </p>
          <p style={{ margin: 0 }}>
            O responsável pelo tratamento de dados desta organização pode ser contactado pelo setor de <strong style={{ color: t.text }}>Recursos Humanos</strong> ou pelo e-mail institucional afixado no quadro de avisos interno. Você tem o direito de encaminhar reclamações também à <strong style={{ color: t.text }}>Autoridade Nacional de Proteção de Dados (ANPD)</strong> em <strong style={{ color: t.accent }}>www.gov.br/anpd</strong>.
          </p>
        </div>

        {/* Scroll requirement indicator */}
        {!scrolled && (
          <div style={{ textAlign: "center", padding: "6px 0 2px", borderTop: `1.5px solid ${t.border}` }}>
            <span style={{ fontSize: "11.5px", color: t.textMuted }}>↓ Role até o final para continuar</span>
          </div>
        )}

        {/* Actions bar */}
        <div style={{ padding: "16px 28px 24px", borderTop: `1.5px solid ${t.border}` }}>
          <div
            style={{
              background: t.surfaceAlt,
              border: `1.5px solid ${t.border}`,
              borderRadius: 9,
              padding: "10px 14px",
              marginBottom: 14
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
              <span style={{ color: t.textSub }}>
                Colaborador(a): <strong style={{ color: t.text }}>{currentUser?.nome}</strong>
              </span>
              <span style={{ color: t.textSub }}>
                Matrícula: <strong style={{ color: t.text }}>{currentUser?.matricula}</strong>
              </span>
            </div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>Data de aceite: {hoje}</div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onRecusar}
              style={{
                flex: 1,
                background: t.surfaceAlt,
                border: `1.5px solid ${t.border}`,
                borderRadius: 10,
                padding: "11px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 600,
                fontSize: "13.5px",
                color: t.textSub
              }}
            >
              Recusar e sair
            </button>
            <button
              onClick={aceitar}
              disabled={!scrolled || loading}
              style={{
                flex: 2,
                background: scrolled && !loading ? `linear-gradient(135deg, ${t.accent}, #2040CC)` : t.surfaceAlt,
                border: "none",
                borderRadius: 10,
                padding: "11px",
                cursor: scrolled && !loading ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                fontWeight: 700,
                fontSize: "13.5px",
                color: scrolled && !loading ? "#fff" : t.textMuted,
                boxShadow: scrolled && !loading ? `0 4px 18px ${t.accentGlow}` : "none",
                transition: "all 0.2s"
              }}
            >
              {loading ? "Registrando..." : scrolled ? "✓ Li e aceito os termos" : "Leia até o final"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
