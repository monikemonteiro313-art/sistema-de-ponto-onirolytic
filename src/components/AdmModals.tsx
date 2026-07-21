import { useState } from "react";
import { Shield, Key, Lock, Eye, EyeOff, Ban, Copy, Check, Trash2, Unlock } from "lucide-react";
import { ThemeColors, User } from "../types";
import { Btn, PwInput, PwChecks, Tag } from "./SharedUI";
import {
  genSenha,
  genMatricula,
  validateAdminPw,
  validateEmployeePw,
  toMin
} from "../utils/hrHelpers";
import { getJornada, SUPERADMIN_MAT } from "../data/mockData";

interface PwModalProps {
  modal: { user: User };
  setModal: (val: any) => void;
  t: ThemeColors;
  onChangePw: (userId: number, newPw: string) => void;
}

export function PwModal({ modal, setModal, t, onChangePw }: PwModalProps) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [genMode, setGenMode] = useState<"manual" | "auto">("manual");
  const [generatedPw, setGeneratedPw] = useState("");
  const [copied, setCopied] = useState(false);

  const targetIsAdm = modal.user?.tipo === "adm-dev";
  const pwOk = targetIsAdm ? validateAdminPw(pw) : validateEmployeePw(pw);
  const matchOk = pw === pw2 && pw2.length > 0;

  function handleGen() {
    const g = genSenha();
    setGeneratedPw(g);
    setPw(g);
    setPw2(g);
  }

  function copyToClipboard(text: string) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const isSuper = modal.user?.matricula === SUPERADMIN_MAT;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        padding: 20
      }}
      onClick={() => setModal(null)}
    >
      <div
        style={{
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          borderRadius: 18,
          padding: "32px 36px",
          width: "100%",
          maxWidth: 440,
          boxShadow: t.shadow
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 4px", color: t.text, fontSize: 18, fontWeight: 700 }}>Trocar senha</h3>
        <p style={{ margin: "0 0 16px", color: t.textSub, fontSize: 13 }}>
          {modal.user.nome} • {modal.user.matricula}
        </p>

        {isSuper && (
          <div
            style={{
              background: t.accentGlow,
              border: `1.5px solid ${t.borderFocus}`,
              borderRadius: 8,
              padding: "8px 13px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <Shield size={14} color={t.accent} fill={t.accent} />
            <span style={{ fontSize: 12, color: t.accent, fontWeight: 600 }}>
              Conta superadmin — apenas o próprio titular altera esta senha.
            </span>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(["manual", "auto"] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setGenMode(v);
                if (v === "auto") {
                  handleGen();
                } else {
                  setPw("");
                  setPw2("");
                  setGeneratedPw("");
                }
              }}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "12.5px",
                fontWeight: 600,
                transition: "all 0.2s",
                background: genMode === v ? t.accentGlow : t.surfaceAlt,
                border: `1.5px solid ${genMode === v ? t.accent : t.border}`,
                color: genMode === v ? t.accent : t.textSub
              }}
            >
              {v === "manual" ? "Manual" : "Gerar automaticamente"}
            </button>
          ))}
        </div>

        {genMode === "auto" ? (
          <div style={{ background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: t.textSub, fontWeight: 600 }}>Senha gerada:</span>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn onClick={handleGen} variant="ghost" t={t} small>
                  ↻ Nova
                </Btn>
                <Btn onClick={() => copyToClipboard(generatedPw)} variant={copied ? "success" : "ghost"} t={t} small>
                  <Copy size={13} color={copied ? t.success : t.textSub} />
                  {copied ? "Copt!" : "Copiar"}
                </Btn>
              </div>
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 17, fontWeight: 700, color: t.text, letterSpacing: "2px" }}>
              {generatedPw || "—"}
            </div>
            <p style={{ margin: "8px 0 0", fontSize: "11.5px", color: t.textMuted }}>
              ⚠️ Copie e repasse antes de confirmar. Não será exibida novamente.
            </p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
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
              <PwInput value={pw} onChange={setPw} placeholder={targetIsAdm ? "Mín. 8 • aA1@" : "Mín. 8 • letras + nºs"} t={t} />
              <PwChecks pw={pw} t={t} isAdmin={targetIsAdm} />
            </div>
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
                Confirmar
              </label>
              <PwInput value={pw2} onChange={setPw2} placeholder="Repita" t={t} />
              {pw2 && !matchOk && (
                <span style={{ fontSize: "11.5px", color: t.danger, marginTop: 4, display: "block" }}>
                  Senhas não coincidem
                </span>
              )}
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={() => setModal(null)} variant="ghost" t={t} style={{ flex: 1 }}>
            Cancelar
          </Btn>
          <Btn
            onClick={() => {
              const finalPw = genMode === "auto" ? generatedPw : pw;
              const ok = genMode === "auto" ? !!generatedPw : pwOk && matchOk;
              if (ok) {
                onChangePw(modal.user.id, finalPw);
              }
            }}
            t={t}
            style={{ flex: 2 }}
            disabled={genMode === "manual" ? !pwOk || !matchOk : !generatedPw}
          >
            Confirmar troca
          </Btn>
        </div>
      </div>
    </div>
  );
}

interface CreateModalProps {
  setModal: (val: any) => void;
  t: ThemeColors;
  users: User[];
  tab: string;
  onCreate: (data: any) => void;
}

export function CreateModal({ setModal, t, users, tab, onCreate }: CreateModalProps) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"colaborador" | "adm-dev">(tab === "adm" ? "adm-dev" : "colaborador");
  const [genMode, setGenMode] = useState<"manual" | "auto">("manual");
  const [generatedPw, setGeneratedPw] = useState("");
  const [copied, setCopied] = useState(false);
  const [createdUser, setCreatedUser] = useState<any | null>(null);
  const [copiedMat, setCopiedMat] = useState<string | boolean>(false);

  const [matricula, setMatricula] = useState(() => genMatricula(users));
  const [matError, setMatError] = useState("");

  const targetIsAdm = tipo === "adm-dev";
  const pwOk = targetIsAdm ? validateAdminPw(pw) : validateEmployeePw(pw);
  const matchOk = pw === pw2 && pw2.length > 0;

  function handleGen() {
    const g = genSenha();
    setGeneratedPw(g);
    setPw(g);
    setPw2(g);
  }

  if (createdUser) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 500,
          padding: 20
        }}
      >
        <div
          style={{
            background: t.surface,
            border: `1.5px solid ${t.border}`,
            borderRadius: 18,
            padding: "36px",
            width: "100%",
            maxWidth: 400,
            boxShadow: t.shadow
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: t.successBg,
                border: `2px solid ${t.successBorder}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px"
              }}
            >
              <Check size={24} color={t.success} />
            </div>
            <h3 style={{ margin: "0 0 6px", color: t.text, fontSize: 18, fontWeight: 700 }}>Usuário criado!</h3>
            <p style={{ margin: 0, color: t.textSub, fontSize: 13 }}>Anote as credenciais antes de fechar.</p>
          </div>
          <div style={{ background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}>
            {[
              ["Nome", createdUser.nome],
              ["Matrícula (login)", createdUser.matricula],
              ["Senha", createdUser.senha]
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "7px 0",
                  borderBottom: `1px solid ${t.border}`
                }}
              >
                <span style={{ fontSize: "12.5px", color: t.textSub }}>{k}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 13,
                      color: t.text,
                      fontWeight: 700,
                      fontFamily: k !== "Nome" ? "monospace" : "inherit",
                      letterSpacing: k !== "Nome" ? "1px" : "0"
                    }}
                  >
                    {v}
                  </span>
                  {k !== "Nome" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(v);
                          setCopiedMat(k);
                          setTimeout(() => setCopiedMat(false), 2000);
                        }
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
                    >
                      <Copy size={13} color={copiedMat === k ? t.success : t.textMuted} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: t.warningBg, border: `1.5px solid ${t.warningBorder}`, borderRadius: 8, padding: "9px 13px", marginBottom: 18 }}>
            <span style={{ fontSize: 12, color: t.warning }}>
              ⚠️ Esta é a única vez que a senha será exibida. Repasse ao colaborador agora.
            </span>
          </div>
          <Btn onClick={() => setModal(null)} t={t} style={{ width: "100%" }}>
            Fechar
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        padding: 20
      }}
      onClick={() => setModal(null)}
    >
      <div
        style={{
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          borderRadius: 18,
          padding: "32px 36px",
          width: "100%",
          maxWidth: 440,
          boxShadow: t.shadow,
          maxHeight: "90vh",
          overflowY: "auto"
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 20px", color: t.text, fontSize: 18, fontWeight: 700 }}>
          Novo {tipo === "adm-dev" ? "ADM" : "Colaborador"}
        </h3>

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
            Nome completo
          </label>
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Nome do usuário"
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: t.inputBg,
              border: `1.5px solid ${t.border}`,
              borderRadius: 9,
              color: t.text,
              fontSize: 14,
              padding: "11px 13px",
              outline: "none",
              fontFamily: "inherit"
            }}
          />
        </div>

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
            Número da Matrícula (Login)
          </label>
          <input
            value={matricula}
            onChange={e => {
              setMatricula(e.target.value.trim());
              setMatError("");
            }}
            placeholder="Ex: 123456"
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: t.inputBg,
              border: `1.5px solid ${matError ? t.danger : t.border}`,
              borderRadius: 9,
              color: t.text,
              fontSize: 14,
              padding: "11px 13px",
              outline: "none",
              fontFamily: "monospace",
              letterSpacing: "1px"
            }}
          />
          {matError && (
            <span style={{ fontSize: "11.5px", color: t.danger, marginTop: 4, display: "block", fontWeight: 600 }}>
              ⚠️ {matError}
            </span>
          )}
          <span style={{ fontSize: "11px", color: t.textMuted, marginTop: 4, display: "block" }}>
            Digite a matrícula se quiser uma personalizada (ex: 123456), ou deixe o valor gerado.
          </span>
        </div>

        <div style={{ marginBottom: 18 }}>
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
            Tipo de acesso
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["colaborador", "adm-dev"] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setTipo(v)}
                style={{
                  flex: 1,
                  padding: "9px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  transition: "all 0.2s",
                  background: tipo === v ? t.accent : t.surfaceAlt,
                  border: `1.5px solid ${tipo === v ? t.accent : t.border}`,
                  color: tipo === v ? "#fff" : t.textSub
                }}
              >
                {v === "colaborador" ? "Colaborador" : "ADM-Dev"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: "block",
              fontSize: "11.5px",
              fontWeight: 700,
              color: t.textSub,
              marginBottom: 8,
              letterSpacing: "0.5px",
              textTransform: "uppercase"
            }}
          >
            Método de senha
          </label>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {(["manual", "auto"] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setGenMode(v);
                  if (v === "auto") {
                    handleGen();
                  } else {
                    setPw("");
                    setPw2("");
                    setGeneratedPw("");
                  }
                }}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  transition: "all 0.2s",
                  background: genMode === v ? t.accentGlow : t.surfaceAlt,
                  border: `1.5px solid ${genMode === v ? t.accent : t.border}`,
                  color: genMode === v ? t.accent : t.textSub
                }}
              >
                {v === "manual" ? "Definir manualmente" : "Gerar automaticamente"}
              </button>
            ))}
          </div>

          {genMode === "auto" ? (
            <div style={{ background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: t.textSub, fontWeight: 600 }}>Senha gerada:</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn onClick={handleGen} variant="ghost" t={t} small>
                    ↻ Nova
                  </Btn>
                  <Btn
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(generatedPw);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    variant={copied ? "success" : "ghost"}
                    t={t}
                    small
                  >
                    <Copy size={13} color={copied ? t.success : t.textSub} />
                    {copied ? "Copiado!" : "Copiar"}
                  </Btn>
                </div>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: t.text, letterSpacing: "2px" }}>
                {generatedPw || "—"}
              </div>
              <p style={{ margin: "8px 0 0", fontSize: "11.5px", color: t.textMuted }}>
                ⚠️ Copie e repasse. Não será exibida novamente.
              </p>
            </div>
          ) : (
            <>
              <PwInput value={pw} onChange={setPw} placeholder={targetIsAdm ? "Mín. 8 • aA1@" : "Mín. 8 • letras + nºs"} t={t} />
              <PwChecks pw={pw} t={t} isAdmin={targetIsAdm} />
              <div style={{ marginTop: 10 }}>
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
                  Confirmar senha
                </label>
                <PwInput value={pw2} onChange={setPw2} placeholder="Repita" t={t} />
                {pw2 && pw !== pw2 && (
                  <span style={{ fontSize: "11.5px", color: t.danger, marginTop: 4, display: "block" }}>
                    Senhas não coincidem
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={() => setModal(null)} variant="ghost" t={t} style={{ flex: 1 }}>
            Cancelar
          </Btn>
          <Btn
            onClick={() => {
              const cleanMat = matricula.trim();
              if (!cleanMat) {
                setMatError("A matrícula é obrigatória.");
                return;
              }
              const exists = users.some(u => u.matricula === cleanMat);
              if (exists) {
                setMatError("Esta matrícula já está em uso por outro usuário.");
                return;
              }

              const finalPw = genMode === "auto" ? generatedPw : pw;
              const ok = genMode === "auto" ? !!generatedPw : pwOk && matchOk;
              if (nome.trim() && ok) {
                setCreatedUser({ nome: nome.trim(), matricula: cleanMat, senha: finalPw });
                onCreate({ nome: nome.trim(), tipo, senha: finalPw, matricula: cleanMat });
              }
            }}
            t={t}
            style={{ flex: 2 }}
            disabled={!nome.trim() || !matricula.trim() || (genMode === "manual" ? !pwOk || !matchOk : !generatedPw)}
          >
            Criar
          </Btn>
        </div>
      </div>
    </div>
  );
}

interface DeleteModalProps {
  modal: { user: User };
  setModal: (val: any) => void;
  t: ThemeColors;
  onDelete: (userId: number) => void;
}

export function DeleteModal({ modal, setModal, t, onDelete }: DeleteModalProps) {
  const isSuper = modal.user?.matricula === SUPERADMIN_MAT;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        padding: 20
      }}
      onClick={() => setModal(null)}
    >
      <div
        style={{
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          borderRadius: 18,
          padding: "32px 36px",
          width: "100%",
          maxWidth: 400,
          boxShadow: t.shadow
        }}
        onClick={e => e.stopPropagation()}
      >
        {isSuper ? (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: t.accentGlow,
                border: `2px solid ${t.accent}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px"
              }}
            >
              <Shield size={24} color={t.accent} />
            </div>
            <h3 style={{ margin: "0 0 10px", color: t.text, fontSize: 17, fontWeight: 700 }}>Ação não permitida</h3>
            <p style={{ margin: "0 0 20px", color: t.textSub, fontSize: 13, lineHeight: 1.6 }}>
              A conta <strong style={{ color: t.accent }}>090909 (superadmin)</strong> é protegida e não pode ser desativada.
            </p>
            <Btn onClick={() => setModal(null)} variant="ghost" t={t} style={{ width: "100%" }}>
              Fechar
            </Btn>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: t.warningBg,
                  border: `2px solid ${t.warningBorder}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px"
                }}
              >
                <Trash2 size={22} color={t.warning} />
              </div>
              <h3 style={{ margin: "0 0 6px", color: t.text, fontSize: 18, fontWeight: 700 }}>Desativar usuário?</h3>
              <p style={{ margin: 0, color: t.textSub, fontSize: 13 }}>
                <strong style={{ color: t.text }}>{modal.user.nome}</strong> ({modal.user.matricula})
              </p>
            </div>

            {/* Recommended Option: Deactivate */}
            <div style={{ background: t.successBg, border: `1.5px solid ${t.successBorder}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: t.success,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 1
                  }}
                >
                  <Check size={15} color="#fff" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.success, marginBottom: 3 }}>
                    Desativar (recomendado)
                  </div>
                  <div style={{ fontSize: "12.5px", color: t.textSub, lineHeight: 1.5 }}>
                    O acesso é bloqueado, mas os registros de ponto são <strong style={{ color: t.text }}>preservados</strong>. Pode ser reativado depois. Exigido pela CLT (5 anos) e LGPD.
                  </div>
                </div>
              </div>
              <Btn onClick={() => onDelete(modal.user.id)} variant="success" t={t} style={{ width: "100%", marginTop: 12 }}>
                Desativar e preservar dados
              </Btn>
            </div>

            {/* Legal compliance notice */}
            <div style={{ background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 8, padding: "9px 12px", marginBottom: 14 }}>
              <span style={{ fontSize: "11.5px", color: t.textMuted, lineHeight: 1.5 }}>
                ⚖️ A CLT exige retenção de registros de jornada por <strong style={{ color: t.text }}>5 anos</strong>. Excluir permanentemente pode gerar passivo trabalhista.
              </span>
            </div>

            <Btn onClick={() => setModal(null)} variant="ghost" t={t} style={{ width: "100%" }}>
              Cancelar
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}

interface EditMatriculaModalProps {
  modal: { user: User };
  setModal: (val: any) => void;
  t: ThemeColors;
  users: User[];
  onChangeMatricula: (userId: number, newMat: string) => void;
}

export function EditMatriculaModal({ modal, setModal, t, users, onChangeMatricula }: EditMatriculaModalProps) {
  const [matricula, setMatricula] = useState(modal.user.matricula);
  const [error, setError] = useState("");

  const isSuper = modal.user?.matricula === SUPERADMIN_MAT;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        padding: 20
      }}
      onClick={() => setModal(null)}
    >
      <div
        style={{
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          borderRadius: 18,
          padding: "32px 36px",
          width: "100%",
          maxWidth: 400,
          boxShadow: t.shadow
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 4px", color: t.text, fontSize: 18, fontWeight: 700 }}>Alterar Matrícula</h3>
        <p style={{ margin: "0 0 16px", color: t.textSub, fontSize: 13 }}>
          {modal.user.nome} • Matrícula atual: {modal.user.matricula}
        </p>

        {isSuper && (
          <div
            style={{
              background: t.accentGlow,
              border: `1.5px solid ${t.borderFocus}`,
              borderRadius: 8,
              padding: "8px 13px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <Shield size={14} color={t.accent} fill={t.accent} />
            <span style={{ fontSize: 12, color: t.accent, fontWeight: 600 }}>
              Conta superadmin — matrícula de sistema protegida.
            </span>
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
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
            Nova Matrícula (Login)
          </label>
          <input
            value={matricula}
            onChange={e => {
              setMatricula(e.target.value.trim());
              setError("");
            }}
            disabled={isSuper}
            placeholder="Ex: 123456"
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: t.inputBg,
              border: `1.5px solid ${error ? t.danger : t.border}`,
              borderRadius: 9,
              color: t.text,
              fontSize: 14,
              padding: "11px 13px",
              outline: "none",
              fontFamily: "monospace",
              letterSpacing: "1px"
            }}
          />
          {error && (
            <span style={{ fontSize: "11.5px", color: t.danger, marginTop: 4, display: "block", fontWeight: 600 }}>
              ⚠️ {error}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={() => setModal(null)} variant="ghost" t={t} style={{ flex: 1 }}>
            Cancelar
          </Btn>
          <Btn
            onClick={() => {
              const cleanMat = matricula.trim();
              if (isSuper) {
                setModal(null);
                return;
              }
              if (!cleanMat) {
                setError("A matrícula não pode ficar em branco.");
                return;
              }
              if (cleanMat === modal.user.matricula) {
                setModal(null);
                return;
              }
              const exists = users.some(u => u.matricula === cleanMat && u.id !== modal.user.id);
              if (exists) {
                setError("Esta matrícula já está em uso por outro usuário.");
                return;
              }
              onChangeMatricula(modal.user.id, cleanMat);
            }}
            t={t}
            disabled={isSuper || !matricula.trim()}
            style={{ flex: 2 }}
          >
            Salvar
          </Btn>
        </div>
      </div>
    </div>
  );
}
