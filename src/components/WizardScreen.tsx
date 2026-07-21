import { useState } from "react";
import { Shield, Check } from "lucide-react";
import { ThemeColors } from "../types";
import { Btn, PwInput, PwChecks } from "./SharedUI";
import { validateAdminPw } from "../utils/hrHelpers";

interface WizardScreenProps {
  t: ThemeColors;
  onComplete: (nome: string, pw: string) => void;
}

export function WizardScreen({ t, onComplete }: WizardScreenProps) {
  const [step, setStep] = useState(0);
  const [nome, setNome] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [done, setDone] = useState(false);

  const pwOk = validateAdminPw(pw);
  const matchOk = pw === pw2 && pw2.length > 0;

  function finish() {
    if (!nome.trim() || !pwOk || !matchOk) return;
    setDone(true);
    setTimeout(() => onComplete(nome.trim(), pw), 1200);
  }

  const steps = ["Boas-vindas", "Seu nome", "Senha", "Confirmar"];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20
      }}
    >
      <div
        style={{
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          borderRadius: 22,
          padding: "48px 44px",
          width: "100%",
          maxWidth: 460,
          boxShadow: t.shadow
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 36 }}>
          {steps.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                flex: i < steps.length - 1 ? 1 : 0
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: i <= step ? t.accent : t.surfaceAlt,
                  border: `2px solid ${i <= step ? t.accent : t.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.3s"
                }}
              >
                {i < step ? (
                  <Check size={13} color="#fff" />
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, color: i === step ? "#fff" : t.textMuted }}>
                    {i + 1}
                  </span>
                )}
              </div>
              {i < steps.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background: i < step ? t.accent : t.border,
                    margin: "0 4px",
                    transition: "background 0.3s"
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {done ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: t.successBg,
                border: `2px solid ${t.success}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px"
              }}
            >
              <Check size={28} color={t.success} />
            </div>
            <h2 style={{ margin: "0 0 8px", color: t.text }}>Sistema configurado!</h2>
            <p style={{ color: t.textSub, fontSize: 13, margin: 0 }}>Entrando no painel...</p>
          </div>
        ) : step === 0 ? (
          <>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  background: `linear-gradient(135deg, ${t.accent}, #2040CC)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  boxShadow: `0 8px 28px ${t.accentGlow}`
                }}
              >
                <Shield size={32} color="#fff" strokeWidth={1.8} />
              </div>
              <h2 style={{ margin: "0 0 10px", color: t.text, fontSize: 22, fontWeight: 700 }}>
                Primeiro acesso detectado
              </h2>
              <p style={{ margin: 0, color: t.textSub, fontSize: 14, lineHeight: 1.6 }}>
                Configure a conta administradora <strong style={{ color: t.text }}>090909</strong> antes de continuar.
              </p>
            </div>
            <div
              style={{
                background: t.surfaceAlt,
                border: `1.5px solid ${t.border}`,
                borderRadius: 10,
                padding: "12px 16px",
                marginBottom: 24
              }}
            >
              <p style={{ margin: 0, fontSize: "12.5px", color: t.textSub, lineHeight: 1.6 }}>
                ⚠️ Após a configuração, a senha temporária será revogada. Guarde suas credenciais com segurança.
              </p>
            </div>
            <Btn onClick={() => setStep(1)} t={t} style={{ width: "100%" }}>
              Iniciar configuração →
            </Btn>
          </>
        ) : step === 1 ? (
          <>
            <h2 style={{ margin: "0 0 6px", color: t.text, fontSize: 20, fontWeight: 700 }}>
              Como devemos te chamar?
            </h2>
            <p style={{ margin: "0 0 24px", color: t.textSub, fontSize: 13 }}>
              Será exibido no painel administrativo.
            </p>
            <input
              type="text"
              placeholder="Seu nome completo"
              value={nome}
              onChange={e => setNome(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: t.inputBg,
                border: `1.5px solid ${t.border}`,
                borderRadius: 9,
                color: t.text,
                fontSize: 15,
                padding: "13px 14px",
                outline: "none",
                fontFamily: "inherit"
              }}
              onKeyDown={e => e.key === "Enter" && nome.trim() && setStep(2)}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <Btn onClick={() => setStep(0)} variant="ghost" t={t} style={{ flex: 1 }}>
                ← Voltar
              </Btn>
              <Btn onClick={() => nome.trim() && setStep(2)} t={t} style={{ flex: 2 }} disabled={!nome.trim()}>
                Continuar →
              </Btn>
            </div>
          </>
        ) : step === 2 ? (
          <>
            <h2 style={{ margin: "0 0 6px", color: t.text, fontSize: 20, fontWeight: 700 }}>
              Crie sua senha ADM-Dev
            </h2>
            <p style={{ margin: "0 0 20px", color: t.textSub, fontSize: 13 }}>Deve ser forte e exclusiva.</p>
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: t.textSub,
                  marginBottom: 6,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase"
                }}
              >
                Nova senha
              </label>
              <PwInput value={pw} onChange={setPw} placeholder="Mín. 8 • aA1@" t={t} />
              <PwChecks pw={pw} t={t} isAdmin />
            </div>
            <div style={{ marginBottom: 6 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: t.textSub,
                  marginBottom: 6,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase"
                }}
              >
                Confirmar
              </label>
              <PwInput value={pw2} onChange={setPw2} placeholder="Repita" t={t} />
              {pw2 && !matchOk && (
                <span style={{ fontSize: "11.5px", color: t.danger, marginTop: 4, display: "block" }}>
                  Senhas não coincidem
                </span>
              )}
              {pw2 && matchOk && (
                <span style={{ fontSize: "11.5px", color: t.success, marginTop: 4, display: "block" }}>
                  ✓ Coincidem
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <Btn onClick={() => setStep(1)} variant="ghost" t={t} style={{ flex: 1 }}>
                ← Voltar
              </Btn>
              <Btn onClick={() => pwOk && matchOk && setStep(3)} t={t} style={{ flex: 2 }} disabled={!pwOk || !matchOk}>
                Continuar →
              </Btn>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ margin: "0 0 6px", color: t.text, fontSize: 20, fontWeight: 700 }}>
              Confirmar configuração
            </h2>
            <p style={{ margin: "0 0 20px", color: t.textSub, fontSize: 13 }}>Verifique antes de finalizar.</p>
            <div
              style={{
                background: t.surfaceAlt,
                border: `1.5px solid ${t.border}`,
                borderRadius: 12,
                padding: "16px 18px",
                marginBottom: 20
              }}
            >
              {[
                ["Matrícula", "090909"],
                ["Nome", nome],
                ["Tipo", "Superadmin"],
                ["Senha", "••••••••"]
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "6px 0",
                    borderBottom: `1.5px solid ${t.border}`
                  }}
                >
                  <span style={{ fontSize: 13, color: t.textSub }}>{k}</span>
                  <span style={{ fontSize: 13, color: t.text, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={() => setStep(2)} variant="ghost" t={t} style={{ flex: 1 }}>
                ← Editar
              </Btn>
              <Btn onClick={finish} t={t} style={{ flex: 2 }}>
                ✓ Confirmar e Entrar
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
