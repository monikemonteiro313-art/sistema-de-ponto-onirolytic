import React, { useState, useEffect } from "react";
import { Shield, Lock, Sun, Moon, Clock, ShieldCheck, Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import { ThemeColors, User } from "../types";
import { Btn, PwInput } from "./SharedUI";
import { LgpdModal } from "./LgpdModal";

interface LoginScreenProps {
  mode: string;
  t: ThemeColors;
  users: User[];
  onLogin: (matricula: string) => void;
  isAdminMode: boolean;
  setIsAdminMode: React.Dispatch<React.SetStateAction<boolean>>;
  onToggleTheme: () => void;
  onAddLog?: (acao: string, alvo: string, detalhe?: string) => void;
}

export function LoginScreen({ mode, t, users, onLogin, isAdminMode, setIsAdminMode, onToggleTheme, onAddLog }: LoginScreenProps) {
  const [mat, setMat] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [shieldAnim, setShieldAnim] = useState(false);
  const [isLgpdOpen, setIsLgpdOpen] = useState(false);
  const [isHealingOpen, setIsHealingOpen] = useState(false);
  const [healingRunning, setHealingRunning] = useState(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);

  // Safe Monotonic NTP-like Clock Sync states
  const getInitialOffset = () => {
    try {
      const cached = localStorage.getItem("hr_clock_offset");
      return cached ? Number(cached) : 0;
    } catch (_) {
      return 0;
    }
  };

  const [baseRealTime, setBaseRealTime] = useState<number | null>(() => {
    return Date.now() + getInitialOffset();
  });
  const [basePerfTime, setBasePerfTime] = useState<number | null>(() => {
    return performance.now();
  });
  const [clockStatus, setClockStatus] = useState<"syncing" | "synced" | "local">("syncing");
  const [now, setNow] = useState<Date>(() => {
    return new Date(Date.now() + getInitialOffset());
  });

  const [triggerSync, setTriggerSync] = useState(0);

  const getSyncDate = () => {
    if (baseRealTime !== null && basePerfTime !== null) {
      const elapsed = performance.now() - basePerfTime;
      return new Date(baseRealTime + elapsed);
    }
    return new Date(Date.now() + getInitialOffset());
  };

  // Safe Brasilia clock sync routine using same-origin to avoid instable/blocked external domains
  useEffect(() => {
    let active = true;

    async function syncTime() {
      setClockStatus("syncing");
      const url = window.location.origin + "/?t=" + Date.now();
      let resolved = false;

      try {
        const start = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(url, { 
          method: "HEAD",
          signal: controller.signal 
        });
        clearTimeout(timeoutId);

        if (res.ok && active) {
          const dateHeader = res.headers.get("date");
          if (dateHeader) {
            const apiEpoch = new Date(dateHeader).getTime();
            const rtt = performance.now() - start;
            const realEpoch = apiEpoch + rtt / 2;
            const offset = realEpoch - Date.now();
            
            try {
              localStorage.setItem("hr_clock_offset", String(offset));
            } catch (_) {}

            setBaseRealTime(realEpoch);
            setBasePerfTime(performance.now());
            setClockStatus("synced");
            setNow(new Date(realEpoch));
            resolved = true;
            console.log(`[Login Clock Sync] Sincronizado com o servidor. Offset: ${offset.toFixed(0)}ms. RTT: ${rtt.toFixed(1)}ms.`);

            // Audit log if offset is abnormally high (more than 3 minutes, indicating local clock manipulation)
            if (Math.abs(offset) > 3 * 60 * 1000) {
              const offsetMinutes = Math.round(offset / 60000);
              console.warn(`[Audit] Grande desvio de relógio detectado no login: ${offsetMinutes} min.`);
              if (onAddLog) {
                onAddLog(
                  "Suspeita de Manipulação de Horário",
                  "Sistema / Login",
                  `Relógio do dispositivo desviado em ${offsetMinutes} min em relação ao servidor.`
                );
              }
            }
          }
        }
      } catch (e) {
        console.warn("[Login Clock Sync] Falha ao sincronizar com servidor, tentando local com cache.", e);
      }

      if (active && !resolved) {
        const cachedOffset = getInitialOffset();
        const localSynced = Date.now() + cachedOffset;
        setBaseRealTime(localSynced);
        setBasePerfTime(performance.now());
        setClockStatus("local");
        setNow(new Date(localSynced));
      }
    }

    syncTime();

    return () => {
      active = false;
    };
  }, [triggerSync]);

  // Periodic re-sync of clock offset (every 1 hour) to cover long active sessions and prevent drift
  useEffect(() => {
    const interval = setInterval(() => {
      setTriggerSync(prev => prev + 1);
    }, 3600000); // 1 hour
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(getSyncDate());
    }, 1000);
    return () => clearInterval(timer);
  }, [baseRealTime, basePerfTime]);

  const executeBrowserHealing = async () => {
    if (healingRunning) return;
    setHealingRunning(true);
    const logs: string[] = [];
    logs.push("⚙️ Iniciando varredura e diagnóstico do cache local...");
    setDiagnosticLogs([...logs]);
    await new Promise(r => setTimeout(r, 600));

    logs.push("🔍 Analisando chaves de armazenamento local (localStorage)...");
    setDiagnosticLogs([...logs]);
    await new Promise(r => setTimeout(r, 600));

    let totalKeys = 0;
    let corruptedKeysFound = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("hr_")) {
          totalKeys++;
          try {
            const val = localStorage.getItem(key);
            if (val && val !== "undefined") {
              JSON.parse(val);
            }
          } catch (e) {
            corruptedKeysFound++;
            logs.push(`⚠️ Chave com JSON corrompido detectada: ${key}. Removendo...`);
            localStorage.removeItem(key);
          }
        }
      }
    } catch (_) {}

    logs.push(`📊 Varredura concluída: ${totalKeys} chaves analisadas. ${corruptedKeysFound} chaves inválidas limpas.`);
    setDiagnosticLogs([...logs]);
    await new Promise(r => setTimeout(r, 600));

    logs.push("🗑️ Expurgando caches temporários e relatórios desatualizados para evitar tela branca...");
    try {
      localStorage.removeItem("hr_cached_users");
      localStorage.removeItem("hr_cached_pontos");
      localStorage.removeItem("hr_cached_audit_logs");
      localStorage.removeItem("hr_cached_feriados");
      localStorage.removeItem("hr_cached_wizard_done");
    } catch (e) {
      console.warn("Could not clean up some localStorage keys:", e);
    }
    setDiagnosticLogs([...logs]);
    await new Promise(r => setTimeout(r, 800));

    logs.push("✅ Diagnóstico e Autocura concluídos com sucesso! Reiniciando o aplicativo de forma limpa...");
    setDiagnosticLogs([...logs]);
    await new Promise(r => setTimeout(r, 800));
    
    window.location.reload();
  };

  function handleShield() {
    setShieldAnim(true);
    setTimeout(() => {
      setIsAdminMode(v => !v);
      setMat("");
      setPw("");
      setError("");
      setShieldAnim(false);
    }, 220);
  }

  function submit() {
    setError("");
    const matOk = mat.trim().length >= 4;
    if (!matOk) {
      setError("Matrícula inválida (mín. 4 caracteres).");
      return;
    }
    if (!pw) {
      setError("Informe a senha.");
      return;
    }

    // Find user
    const user = users.find(u => u.matricula === mat.trim() && !u.desativado);
    if (!user) {
      setError("Matrícula não cadastrada.");
      return;
    }
    if (user.senha !== pw) {
      setError("Senha incorreta.");
      return;
    }
    if (user.bloqueado) {
      setError("Acesso bloqueado. Contate o administrador.");
      return;
    }
    if (isAdminMode && user.tipo !== "adm-dev") {
      setError("Esta conta não possui credenciais de Administrador.");
      return;
    }
    if (!isAdminMode && user.tipo === "adm-dev") {
      setError("Administradores devem entrar pelo painel ADM (tópico superior esquerdo).");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin(user.matricula);
    }, 900);
  }

  const inputSt = (f: string): React.CSSProperties => ({
    width: "100%",
    boxSizing: "border-box",
    background: t.inputBg,
    border: `1.5px solid ${focused === f ? t.borderFocus : t.border}`,
    borderRadius: 9,
    color: t.text,
    fontSize: "14.5px",
    padding: "12px 14px",
    outline: "none",
    fontFamily: "inherit",
    boxShadow: focused === f ? `0 0 0 3px ${t.accentGlow}` : "none",
    transition: "border 0.2s, box-shadow 0.2s"
  });

  const dateStr = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", weekday: "short" });
  const timeStr = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Decorative gradients */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: `radial-gradient(ellipse at 15% 15%, ${t.accentGlow} 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, rgba(80,30,180,0.05) 0%, transparent 55%)`
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: mode === "dark" ? 0.03 : 0.015,
          backgroundImage: `linear-gradient(${t.text} 1px,transparent 1px),linear-gradient(90deg,${t.text} 1px,transparent 1px)`,
          backgroundSize: "36px 36px"
        }}
      />

      {/* Admin Mode Toggle and LGPD Button */}
      <div
        style={{
          position: "absolute",
          top: 18,
          left: 18,
          display: "flex",
          alignItems: "center",
          gap: 10,
          opacity: shieldAnim ? 0 : 1,
          transition: "all 0.22s"
        }}
      >
        <button
          onClick={handleShield}
          title={isAdminMode ? "Voltar ao login colaborador" : "Acesso ADM-Dev"}
          style={{
            background: isAdminMode ? t.accent : t.surfaceAlt,
            border: `1.5px solid ${isAdminMode ? t.accent : t.border}`,
            borderRadius: 11,
            padding: "8px 11px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 7,
            boxShadow: isAdminMode ? `0 0 20px ${t.accentGlow}` : "none",
            transition: "all 0.22s"
          }}
        >
          <Shield size={20} color={isAdminMode ? "#fff" : t.accent} fill={isAdminMode ? t.accent : "none"} />
          {isAdminMode && (
            <span style={{ color: "#fff", fontSize: "11.5px", fontWeight: 700, letterSpacing: "0.8px" }}>
              ADM-DEV
            </span>
          )}
        </button>

        <button
          onClick={() => setIsLgpdOpen(true)}
          title="Ver conformidade com a LGPD"
          style={{
            background: t.surfaceAlt,
            border: `1.5px solid ${t.border}`,
            borderRadius: 11,
            padding: "8px 11px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.22s"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.accent; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}
        >
          <ShieldCheck size={18} color="#22c55e" />
          <span style={{ fontSize: "11.5px", fontWeight: 600, color: t.textSub }}>LGPD</span>
        </button>
      </div>

      {/* Theme Toggle */}
      <button
        onClick={onToggleTheme}
        style={{
          position: "absolute",
          top: 18,
          right: 18,
          background: t.surfaceAlt,
          border: `1.5px solid ${t.border}`,
          borderRadius: 9,
          padding: "8px 11px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: t.textSub,
          fontSize: "12.5px",
          fontFamily: "inherit"
        }}
      >
        {mode === "dark" ? <Sun size={15} color={t.textSub} /> : <Moon size={15} color={t.textSub} />}
        {mode === "dark" ? "Claro" : "Escuro"}
      </button>

      {/* Mini Relógio Sincronizado Brasília */}
      <div
        onClick={() => setTriggerSync(prev => prev + 1)}
        title="Clique para sincronizar o horário novamente"
        style={{
          position: "absolute",
          top: 66,
          right: 18,
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          borderRadius: 12,
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 2,
          boxShadow: t.shadow,
          zIndex: 10,
          minWidth: 140,
          textAlign: "right",
          cursor: "pointer",
          userSelect: "none",
          transition: "all 0.2s ease-in-out"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.03)";
          e.currentTarget.style.borderColor = t.accent;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.borderColor = t.border;
        }}
      >
        <span style={{ fontSize: "10px", color: t.textSub, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
          <Clock size={11} color={t.accent} /> Brasília
        </span>
        <span style={{ fontSize: "20px", fontWeight: 800, color: t.text, fontFamily: "monospace", letterSpacing: "-0.5px", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
          {timeStr}
        </span>
        <span style={{ fontSize: "10.5px", color: t.textMuted, fontWeight: 500 }}>
          {dateStr}
        </span>
        
        {/* Status Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
          <span style={{ position: "relative", display: "flex", height: 6, width: 6 }}>
            {clockStatus === "synced" && (
              <span className="animate-ping" style={{ position: "absolute", inlineSize: "100%", blockSize: "100%", borderRadius: "50%", background: "#4ade80", opacity: 0.75 }}></span>
            )}
            <span style={{ position: "relative", inlineSize: 6, blockSize: 6, borderRadius: "50%", background: clockStatus === "synced" ? "#22c55e" : clockStatus === "syncing" ? "#3b82f6" : "#f59e0b" }}></span>
          </span>
          <span style={{ fontSize: "9px", fontWeight: 600, color: clockStatus === "synced" ? "#16a34a" : clockStatus === "syncing" ? "#2563eb" : "#d97706" }}>
            {clockStatus === "synced" ? "Hora Segura" : clockStatus === "syncing" ? "Sincronizando" : "⚠️ Gravado Offline (Aguardando Rede)"}
          </span>
        </div>
      </div>

      <div
        style={{
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          borderRadius: 20,
          padding: "44px 40px",
          width: "100%",
          maxWidth: 400,
          boxShadow: t.shadow,
          zIndex: 1
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 16,
              background: isAdminMode ? `linear-gradient(135deg, ${t.accent}, #2040CC)` : t.surfaceAlt,
              border: `1.5px solid ${isAdminMode ? "transparent" : t.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
              boxShadow: isAdminMode ? `0 8px 28px ${t.accentGlow}` : "none"
            }}
          >
            {isAdminMode ? (
              <Shield size={28} color="#fff" fill="none" />
            ) : (
              <Lock size={26} color={t.accent} />
            )}
          </div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: t.text, letterSpacing: "-0.3px" }}>
            {isAdminMode ? "Acesso ADM-Dev" : "Controle de Ponto"}
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: t.textSub }}>
            {isAdminMode ? "Painel restrito — credenciais administrativas" : "Entre com sua matrícula e senha"}
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
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
            Matrícula
          </label>
          <input
            type="text"
            placeholder={isAdminMode ? "Ex: ADM001" : "Ex: 100100 ou 200100"}
            value={mat}
            onChange={e => {
              setMat(e.target.value);
              setError("");
            }}
            onFocus={() => setFocused("mat")}
            onBlur={() => setFocused(null)}
            style={inputSt("mat")}
            onKeyDown={e => e.key === "Enter" && submit()}
          />
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
            Senha
          </label>
          <PwInput value={pw} onChange={setPw} placeholder={isAdminMode ? "Senha ADM-Dev" : "Senha"} t={t} />
        </div>

        {error && (
          <div
            style={{
              background: t.dangerBg,
              border: `1.5px solid ${t.dangerBorder}`,
              borderRadius: 8,
              padding: "9px 13px",
              marginBottom: 14,
              color: t.danger,
              fontSize: 13,
              marginTop: 10
            }}
          >
            {error}
          </div>
        )}

        <Btn onClick={submit} t={t} disabled={loading} style={{ width: "100%", marginTop: 14 }}>
          {loading ? "Verificando..." : isAdminMode ? "Entrar como ADM-Dev" : "Entrar"}
        </Btn>

        <div style={{ marginTop: 24, paddingTop: 18, borderTop: `1.5px solid ${t.border}`, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>
            Problemas de acesso? Fale com o <span style={{ color: t.accent, cursor: "pointer" }}>administrador</span>
          </p>
        </div>
        <div 
          onClick={() => setIsLgpdOpen(true)}
          title="Clique para ver a conformidade com a LGPD"
          style={{ 
            marginTop: 12, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            gap: 6,
            cursor: "pointer",
            opacity: 0.85,
            transition: "opacity 0.2s"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.85"; }}
        >
          <Shield size={11} color="#22c55e" />
          <span style={{ fontSize: 11, color: t.textSub, textDecoration: "underline", textDecorationStyle: "dotted" }}>
            Dados protegidos conforme LGPD
          </span>
        </div>

        <div 
          onClick={() => setIsHealingOpen(true)}
          title="Abrir ferramentas de autocura e diagnóstico de conexão"
          style={{ 
            marginTop: 14, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            gap: 6,
            cursor: "pointer",
            opacity: 0.65,
            transition: "opacity 0.2s"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.65"; }}
        >
          <Sparkles size={11} color={t.accent} />
          <span style={{ fontSize: 11, color: t.textSub, textDecoration: "underline", textDecorationStyle: "dotted" }}>
            Suporte & Autocura de Conexão
          </span>
        </div>
      </div>

      <LgpdModal isOpen={isLgpdOpen} onClose={() => setIsLgpdOpen(false)} t={t} />

      {isHealingOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16
          }}
        >
          <div
            style={{
              background: t.surface,
              border: `1.5px solid ${t.border}`,
              borderRadius: 16,
              maxWidth: 480,
              width: "100%",
              padding: 28,
              boxShadow: t.shadow,
              boxSizing: "border-box"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ background: t.accentGlow, padding: 8, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={18} color={t.accent} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>Autocura de Navegador</h3>
                <span style={{ fontSize: 11, color: t.textMuted }}>Diagnóstico e Correção de Conectividade</span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: t.textSub, lineHeight: "1.5", margin: "0 0 20px" }}>
              Esta ferramenta realiza um diagnóstico do seu navegador corporativo e limpa arquivos de cache temporários conflitantes para garantir estabilidade e corrigir o problema da tela branca.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: t.surfaceAlt, padding: "10px 14px", borderRadius: 8, border: `1px solid ${t.border}` }}>
                <span style={{ fontSize: 12, color: t.textSub }}>Status do Armazenamento Local:</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.success }}>🟢 Saudável</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: t.surfaceAlt, padding: "10px 14px", borderRadius: 8, border: `1px solid ${t.border}` }}>
                <span style={{ fontSize: 12, color: t.textSub }}>Conexão com Banco Firebase:</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.success }}>🟢 Online</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: t.surfaceAlt, padding: "10px 14px", borderRadius: 8, border: `1px solid ${t.border}` }}>
                <span style={{ fontSize: 12, color: t.textSub }}>Sincronização de Relógio de Brasília:</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: clockStatus === "synced" ? t.success : t.warning }}>
                  {clockStatus === "synced" ? "🟢 Sincronizado" : "🟡 Relógio Local"}
                </span>
              </div>
            </div>

            {diagnosticLogs.length > 0 && (
              <div
                style={{
                  background: "#080A10",
                  border: "1px solid #1E2235",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 20,
                  fontFamily: "monospace",
                  fontSize: 11,
                  maxHeight: 120,
                  overflowY: "auto",
                  color: t.textSub
                }}
              >
                {diagnosticLogs.map((log, lidx) => (
                  <div key={lidx} style={{ marginBottom: 4, borderBottom: lidx < diagnosticLogs.length - 1 ? "1px solid #151824" : "none", paddingBottom: 2 }}>
                    {log}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  if (!healingRunning) setIsHealingOpen(false);
                }}
                disabled={healingRunning}
                style={{
                  background: "transparent",
                  border: `1.5px solid ${t.border}`,
                  borderRadius: 10,
                  color: t.textSub,
                  padding: "10px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: healingRunning ? "not-allowed" : "pointer",
                  transition: "all 0.15s"
                }}
              >
                Fechar
              </button>

              <button
                onClick={executeBrowserHealing}
                disabled={healingRunning}
                style={{
                  background: t.accent,
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  padding: "10px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: healingRunning ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "background 0.15s"
                }}
                onMouseEnter={(e) => {
                  if (!healingRunning) e.currentTarget.style.background = t.accentHover;
                }}
                onMouseLeave={(e) => {
                  if (!healingRunning) e.currentTarget.style.background = t.accent;
                }}
              >
                {healingRunning ? (
                  <>
                    <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                    Executando Autocura...
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    Corrigir Cache & Reiniciar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
