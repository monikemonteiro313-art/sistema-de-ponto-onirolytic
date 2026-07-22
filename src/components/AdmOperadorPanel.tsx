import React, { useState, useMemo } from "react";
import { ThemeColors, User, PontosGlobal, Jornada, EmpresaConfig, PeriodoFerias, DiaPontos, PrePonto } from "../types";
import { Btn, Tag } from "./SharedUI";
import { ModalJornada } from "./ModalJornada";
import {
  calcularHorasDia,
  calcularDia,
  resumoMesCalculado,
  toMin,
  getRegularNightIntersection
} from "../utils/hrHelpers";
import { getJornada, JORNADAS_PREDEFINIDAS, SUPERADMIN_MAT } from "../data/mockData";

// --- CHILD COMPONENTS ---
interface ResumoMesBadgesProps {
  r: { faltas: number; completos: number; parciais: number; atestados: number };
  COR_STATUS: any;
}

function ResumoMesBadges({ r, COR_STATUS }: ResumoMesBadgesProps) {
  const items = [
    ["✓ " + r.completos, "completo"],
    r.parciais > 0 ? ["~ " + r.parciais, "parcial"] : null,
    r.faltas > 0 ? ["✗ " + r.faltas, "falta"] : null,
    r.atestados > 0 ? ["A " + r.atestados, "atestado"] : null
  ].filter(Boolean) as [string, string][];

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {items.map(([label, st]) => (
        <span
          key={st}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: COR_STATUS[st].text,
            background: COR_STATUS[st].bg,
            border: `1.5px solid ${COR_STATUS[st].border}`,
            borderRadius: 7,
            padding: "4px 10px"
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

interface GradeCalProps {
  ano: number;
  mes: number;
  userId: number;
  jornada: Jornada | null;
  statusDia: (uid: number, key: string, j: Jornada | null) => string;
  COR_STATUS: any;
  t: ThemeColors;
  onDayClick: (key: string) => void;
}

function GradeCal({ ano, mes, userId, jornada, statusDia, COR_STATUS, t, onDayClick }: GradeCalProps) {
  const hojeKey = new Date().toISOString().slice(0, 10);
  const total = new Date(ano, mes + 1, 0).getDate();
  const dias = [];

  for (let d = 1; d <= total; d++) {
    const date = new Date(ano, mes, d);
    dias.push({ date, key: date.toISOString().slice(0, 10), diaSemana: date.getDay() });
  }

  const primeiroOffset = dias[0].diaSemana;
  const empties = Array.from({ length: primeiroOffset }, (_, i) => <div key={"e" + i} />);

  const cells = dias.map(({ date, key }) => {
    const st = statusDia(userId, key, jornada);
    const isHoje = key === hojeKey;
    const cor = COR_STATUS[st] || { bg: "transparent", border: "transparent", text: t.textMuted };
    const isFolga = st === "folga";
    const isFuturo = st === "futuro";

    const SIM: Record<string, string> = { completo: "✓", parcial: "~", falta: "✗", atestado: "A", afastamento: "AF" };

    return (
      <div
        key={key}
        onClick={() => !isFuturo && !isFolga && onDayClick && onDayClick(key)}
        style={{
          background: isHoje ? t.accentGlow : isFolga || isFuturo ? "transparent" : cor.bg,
          border: `1.5px solid ${isHoje ? t.accent : isFolga || isFuturo ? t.border : cor.border}`,
          borderRadius: 9,
          padding: "6px 4px",
          textAlign: "center",
          cursor: isFuturo || isFolga ? "default" : "pointer",
          transition: "all 0.15s",
          opacity: isFuturo ? 0.3 : 1,
          minHeight: 44,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: isHoje ? 800 : 600,
            color: isHoje ? t.accent : isFolga || isFuturo ? t.textMuted : cor.text || t.textMuted
          }}
        >
          {date.getDate()}
        </div>
        {!isFolga && !isFuturo && SIM[st] && (
          <div style={{ fontSize: 9, marginTop: 2, color: cor.text || t.textMuted, fontWeight: 700 }}>
            {SIM[st]}
          </div>
        )}
      </div>
    );
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
      {empties}
      {cells}
    </div>
  );
}

interface CardColaboradorProps {
  key?: React.Key;
  u: User;
  t: ThemeColors;
  temJornada: boolean;
  jLabel: string | null;
  st: string;
  r: any;
  onClick: () => void;
}

function CardColaborador({ u, t, temJornada, jLabel, st, r, onClick }: CardColaboradorProps) {
  const borderCol = !temJornada ? t.warningBorder : st === "falta" ? t.dangerBorder : st === "parcial" ? t.warningBorder : t.border;
  return (
    <div
      style={{
        background: t.surface,
        border: `1.5px solid ${borderCol}`,
        borderRadius: 14,
        padding: "18px 20px",
        cursor: "pointer",
        transition: "all 0.18s"
      }}
      onClick={onClick}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: temJornada ? t.accentGlow : t.warningBg,
            border: `1.5px solid ${temJornada ? t.borderFocus : t.warningBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}
        >
          <span style={{ fontSize: 15, fontWeight: "bold", color: temJornada ? t.accent : t.warning }}>👤</span>
        </div>
        {temJornada ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: st === "falta" ? t.danger : st === "parcial" ? t.warning : t.success,
              background: st === "falta" ? t.dangerBg : st === "parcial" ? t.warningBg : t.successBg,
              border: `1.5px solid ${st === "falta" ? t.dangerBorder : st === "parcial" ? t.warningBorder : t.successBorder}`,
              borderRadius: 6,
              padding: "2px 8px",
              textTransform: "uppercase",
              letterSpacing: "0.4px"
            }}
          >
            {st === "falta" ? "⚠ Faltas" : st === "parcial" ? "~ Incompleto" : "✓ Ok"}
          </span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 700, color: t.warning, background: t.warningBg, border: `1.5px solid ${t.warningBorder}`, borderRadius: 6, padding: "2px 8px", textTransform: "uppercase" }}>
            Sem jornada
          </span>
        )}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 2 }}>{u.nome}</div>
      <div style={{ fontSize: "11.5px", color: t.textMuted, fontFamily: "monospace", marginBottom: 10 }}>Mat. {u.matricula}</div>
      {temJornada && r ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {[
              [r.diasFalta > 0, `✗ ${r.diasFalta} falta${r.diasFalta > 1 ? "s" : ""}`, t.danger, t.dangerBg],
              [r.minutosAtraso > 0, `~ atraso`, t.warning, t.warningBg],
              [r.minutosAntecipacao > 0, `← antecip.`, t.warning, t.warningBg],
              [r.horasExtra > 0, `+ ${r.horasExtra.toFixed(1)}h extra`, t.success, t.successBg]
            ].map(([cond, label, color, bg], idx) => {
              if (!cond) return null;
              return (
                <div key={idx} style={{ background: bg as string, borderRadius: 6, padding: "2px 7px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: color as string }}>{label}</span>
                </div>
              );
            })}
            {r.diasFalta === 0 && r.minutosAtraso === 0 && r.minutosAntecipacao === 0 && (
              <div style={{ background: t.successBg, borderRadius: 6, padding: "2px 7px" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.success }}>✓ ok</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: r.diasCartao > 0 ? t.success : t.danger,
                background: r.diasCartao > 0 ? t.successBg : t.dangerBg,
                border: `1.5px solid ${r.diasCartao > 0 ? t.successBorder : t.dangerBorder}`,
                borderRadius: 5,
                padding: "1px 6px"
              }}
            >
              🎴 {r.diasCartao > 0 ? "Cartão ok" : "Sem cartão"}
            </span>
            <span style={{ fontSize: 11, color: t.textMuted }}>{r.horasTrabalhadas.toFixed(1)}h</span>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: t.warning }}>⚠️ Definir jornada</div>
      )}
    </div>
  );
}

interface ModalEmpresaProps {
  t: ThemeColors;
  config: EmpresaConfig;
  onSalvar: (c: EmpresaConfig) => void;
  onFechar: () => void;
}

function ModalEmpresa({ t, config, onSalvar, onFechar }: ModalEmpresaProps) {
  const [nome, setNome] = useState(config.nome || "");
  const [cnpj, setCnpj] = useState(config.cnpj || "");

  function fmtCnpj(v: string) {
    return v
      .replace(/\D/g, "")
      .slice(0, 14)
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
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
        zIndex: 700,
        padding: 20
      }}
      onClick={onFechar}
    >
      <div
        style={{
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          borderRadius: 18,
          padding: "28px 32px",
          width: "100%",
          maxWidth: 400,
          boxShadow: t.shadow
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 4px", color: t.text, fontSize: 17, fontWeight: 700 }}>Dados da Empresa</h3>
        <p style={{ margin: "0 0 20px", color: t.textSub, fontSize: 13 }}>Aparecerão no cabeçalho dos relatórios exportados.</p>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: t.textSub, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Nome da empresa
          </label>
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex: Empresa ABC Ltda"
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: t.inputBg,
              border: `1.5px solid ${t.border}`,
              borderRadius: 9,
              color: t.text,
              fontSize: 14,
              padding: "10px 13px",
              outline: "none",
              fontFamily: "inherit"
            }}
          />
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: t.textSub, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            CNPJ <span style={{ fontWeight: 400, color: t.textMuted }}>(opcional)</span>
          </label>
          <input
            value={cnpj}
            onChange={e => setCnpj(fmtCnpj(e.target.value))}
            placeholder="00.000.000/0000-00"
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: t.inputBg,
              border: `1.5px solid ${t.border}`,
              borderRadius: 9,
              color: t.text,
              fontSize: 14,
              padding: "10px 13px",
              outline: "none",
              fontFamily: "monospace"
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onFechar}
            style={{
              flex: 1,
              background: t.surfaceAlt,
              border: `1.5px solid ${t.border}`,
              borderRadius: 10,
              padding: "11px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 600,
              fontSize: 14,
              color: t.textSub
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => nome.trim() && onSalvar({ nome: nome.trim(), cnpj })}
            disabled={!nome.trim()}
            style={{
              flex: 2,
              background: nome.trim() ? "linear-gradient(135deg,#10B981,#059669)" : t.surfaceAlt,
              border: "none",
              borderRadius: 10,
              padding: "11px",
              cursor: nome.trim() ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              fontWeight: 700,
              fontSize: 14,
              color: nome.trim() ? "#fff" : t.textMuted,
              boxShadow: nome.trim() ? "0 4px 16px rgba(16,185,129,0.3)" : "none",
              transition: "all 0.2s"
            }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

interface PainelTotaisProps {
  t: ThemeColors;
  resumo: any;
  minimoHorasDia: number;
  mes: string;
}

function PainelTotais({ t, resumo, minimoHorasDia, mes }: PainelTotaisProps) {
  if (!resumo) return null;

  function fmtH(h: number) {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${hh}h${mm > 0 ? ` ${String(mm).padStart(2, "0")}min` : ""}`;
  }

  function fmtMin(min: number) {
    if (min === 0) return "0";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
  }

  const saldo = resumo.horasTrabalhadas - resumo.horasEsperadas;
  const saldoPositivo = saldo >= 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Meal voucher eligibility */}
      <div style={{ background: "rgba(34,197,94,0.10)", border: "1.5px solid rgba(34,197,94,0.35)", borderRadius: 14, padding: "16px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
          🎴 Cartão Alimentação — {mes}
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#22C55E" }}>
          {resumo.diasCartao} dia{resumo.diasCartao !== 1 ? "s" : ""}
        </div>
        <div style={{ fontSize: 12, color: "rgba(34,197,94,0.8)", marginTop: 4 }}>
          com direito ao benefício · mín. {minimoHorasDia}h trabalhadas no dia
        </div>
      </div>

      {/* Hourly totals summary */}
      <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, padding: "14px 16px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
          Horas — {mes}
        </div>
        {[
          ["Trabalhadas", fmtH(resumo.horasTrabalhadas), t.text],
          ["Esperadas", fmtH(resumo.horasEsperadas), t.textSub],
          ["Saldo", (saldoPositivo ? "+" : "") + fmtH(Math.abs(saldo)), saldoPositivo ? "#22C55E" : "#EF4444"],
          ["Extras", resumo.horasExtra > 0 ? fmtH(resumo.horasExtra) : "—", "#22C55E"],
          ["Adic. Noturno", resumo.horasAdicionalNoturno > 0 ? fmtH(resumo.horasAdicionalNoturno) : "—", "#D97706"]
        ].map(([label, val, color], idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "5px 0",
              borderBottom: `1px solid ${t.border}`
            }}
          >
            <span style={{ fontSize: "12.5px", color: t.textSub }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: color as string, fontFamily: "monospace" }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Irregularities / delays */}
      <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, padding: "14px 16px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
          Ocorrências
        </div>
        {[
          ["Faltas", resumo.diasFalta, "#EF4444", resumo.diasFalta > 0],
          ["Atrasos", fmtMin(resumo.minutosAtraso), "#F59E0B", resumo.minutosAtraso > 0],
          ["Saídas antec.", fmtMin(resumo.minutosAntecipacao), "#F59E0B", resumo.minutosAntecipacao > 0],
          ["Atestados", resumo.diasAtestado, "#3B82F6", false],
          ["Afastamentos", resumo.diasAfastamento, "#A855F7", false],
          ["Adic. Noturno", resumo.diasAdicionalNoturno, "#D97706", resumo.diasAdicionalNoturno > 0]
        ].map(([label, val, color, alert], idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "5px 0",
              borderBottom: `1px solid ${t.border}`
            }}
          >
            <span style={{ fontSize: "12.5px", color: alert ? (color as string) : t.textSub }}>{label as string}</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: val === 0 || val === "0" ? t.textMuted : alert ? (color as string) : t.text,
                fontFamily: "monospace"
              }}
            >
              {typeof val === "number"
                ? val === 0
                  ? "—"
                  : val + (label === "Faltas" || label === "Atestados" || label === "Afastamentos" || label === "Adic. Noturno" ? " dia(s)" : "")
                : val === "0"
                  ? "—"
                  : val}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- MAIN OPERATOR DASHBOARD COMPONENT ---
interface AdmOperadorPanelProps {
  t: ThemeColors;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User;
  onLogout: () => void;
  onGoAdm: () => void;
  pontosGlobal: PontosGlobal;
  setPontosGlobal: React.Dispatch<React.SetStateAction<PontosGlobal>>;
  onAddLog: (action: string, actor: string, details: string) => void;
  minimoHorasDia: number;
  setMinimoHorasDia: (val: number) => void;
  empresaConfig: EmpresaConfig;
  setEmpresaConfig: (val: EmpresaConfig) => void;
  feriados?: string[];
  prePontos?: PrePonto[];
}

export function AdmOperadorPanel({
  t,
  users,
  setUsers,
  currentUser,
  onLogout,
  onGoAdm,
  pontosGlobal,
  setPontosGlobal,
  onAddLog,
  minimoHorasDia,
  setMinimoHorasDia,
  empresaConfig,
  setEmpresaConfig,
  feriados = [],
  prePontos = []
}: AdmOperadorPanelProps) {
  const [busca, setBusca] = useState("");
  const [guiaAtiva, setGuiaAtiva] = useState<"frequencia" | "alimentacao" | "atestados" | "pre_pontos">("frequencia");
  const [preFilter, setPreFilter] = useState<"todos" | "sucesso" | "fantasma" | "cancelado" | "ativo">("todos");
  const [atestadoAmpliado, setAtestadoAmpliado] = useState<{ userName: string; dayKey: string; cid: string; foto: string } | null>(null);
  const [valorDiarioAlimentacao, setValorDiarioAlimentacao] = useState<number>(() => {
    try {
      const cached = localStorage.getItem("hr_valor_diario_alimentacao");
      return cached ? Number(cached) : 26;
    } catch (e) {
      console.warn("localStorage read error:", e);
      return 26;
    }
  });

  function alterarValorDiarioAlimentacao(valor: number) {
    setValorDiarioAlimentacao(valor);
    try {
      localStorage.setItem("hr_valor_diario_alimentacao", String(valor));
    } catch (e) {
      console.warn("localStorage write error:", e);
    }
  }

  const [limiteMaximoAlimentacao, setLimiteMaximoAlimentacao] = useState<number>(() => {
    try {
      const cached = localStorage.getItem("hr_limite_maximo_alimentacao");
      return cached ? Number(cached) : 520;
    } catch (e) {
      console.warn("localStorage read error:", e);
      return 520;
    }
  });

  function alterarLimiteMaximoAlimentacao(valor: number) {
    setLimiteMaximoAlimentacao(valor);
    try {
      localStorage.setItem("hr_limite_maximo_alimentacao", String(valor));
    } catch (e) {
      console.warn("localStorage write error:", e);
    }
  }
  const [filtroJornada, setFiltroJornada] = useState("todas");
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState<User | null>(null);
  const [modalJornada, setModalJornada] = useState<number | null>(null);
  const [modalLancamento, setModalLancamento] = useState<{ userId: number; dayKey: string } | null>(null);
  const [modalEmpresa, setModalEmpresa] = useState(false);
  const [modalSpreadsheet, setModalSpreadsheet] = useState(false);
  const [jornadaId, setJornadaId] = useState("");
  const [jornadaCustom, setJornadaCustom] = useState<Jornada>({ id: "personalizada", nome: "Personalizada", entrada: "08:00", saidaAlmoco: "12:00", retornoAlmoco: "13:00", saida: "17:00", horasDia: 8, diasSemana: [1, 2, 3, 4, 5], descricao: "" });
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });

  function showToast(msg: string, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function checkCalendarPermission() {
    if (currentUser.matricula === SUPERADMIN_MAT) return true;
    if (currentUser.perm_editar_calendario === true) return true;
    showToast("Você não possui permissão delegada para editar o calendário.", "warning");
    return false;
  }

  function salvarLancamento(userId: number, dayKey: string, batidas: any, resumo: string) {
    if (!checkCalendarPermission()) return;
    setPontosGlobal(prev => ({
      ...prev,
      [userId]: { ...(prev[userId] || {}), [dayKey]: batidas }
    }));

    const u = users.find(x => x.id === userId);
    if (!u) return;
    const dataFmt = new Date(dayKey + "T12:00:00").toLocaleDateString("pt-BR");
    onAddLog("Lançou ponto", `${u.nome} (${u.matricula})`, `Data: ${dataFmt} · ${resumo} · Por: ${currentUser.nome}`);
    setModalLancamento(null);
    showToast(`Ponto lançado para ${u.nome} em ${dataFmt}`);
  }

  const MESES_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  function fmtHPdf(h: number) {
    if (!h && h !== 0) return "—";
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${hh}h${mm > 0 ? String(mm).padStart(2, "0") + "min" : ""}`;
  }

  function fmtMinPdf(min: number) {
    if (!min || min === 0) return "—";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h${String(m).padStart(2, "0")}min` : `${m}min`;
  }

  function gerarEspelhoHTML(userId: number) {
    const u = users.find(x => x.id === userId);
    if (!u) return;
    const J = u.jornadaId === "personalizada" ? u.jornadaCustom : getJornada(u.jornadaId || "");
    const resumo = resumoMesCalculado(userId, mesAtual.ano, mesAtual.mes, users, pontosGlobal, minimoHorasDia, feriados);
    const dias = [];
    const total = new Date(mesAtual.ano, mesAtual.mes + 1, 0).getDate();

    for (let d = 1; d <= total; d++) {
      const date = new Date(mesAtual.ano, mesAtual.mes, d);
      const key = date.toISOString().slice(0, 10);
      const batidas = pontosGlobal[userId]?.[key] || [null, null, null, null];
      const calc = calcularDia(userId, key, users, pontosGlobal, feriados);
      const diaSem = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][date.getDay()];

      const fmtB = (b: any) => {
        if (!b) return "—";
        if (b.ocorrencia) {
          return b.ocorrencia === "atestado" ? (b.parcial ? "Atestado Parcial" : "Atestado") : b.ocorrencia === "afastamento" ? "Afastamento" : b.ocorrencia === "falta" ? "Falta" : b.ocorrencia;
        }
        let timeStr = new Date(b.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        if (b.suspeitoHoraModificada) {
          timeStr += " ⚠️ Suspeito";
        }
        return b.latitude && b.longitude ? `${timeStr} 📍` : timeStr;
      };

      dias.push({ d, diaSem, key, batidas, calc, fmtB });
    }

    const corStatus: Record<string, string> = { completo: "#16a34a", parcial: "#d97706", falta: "#dc2626", atestado: "#2563eb", afastamento: "#7c3aed", folga: "#9ca3af", futuro: "#9ca3af", ferias: "#7c3aed", feriado: "#df2222" };
    const nomesStatus: Record<string, string> = { completo: "Completo", parcial: "Parcial", falta: "Falta", atestado: "Atestado", afastamento: "Afastamento", folga: "Folga", futuro: "A planejar", ferias: "Férias", feriado: "Feriado" };

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Espelho de Ponto — ${u.nome}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11.5px; color: #111; background: #fff; padding: 20px; }
  .header { border-bottom: 2px solid #1e40af; padding-bottom: 12px; margin-bottom: 16px; }
  .empresa { font-size: 16px; font-weight: bold; color: #1e40af; }
  .cnpj { font-size: 11px; color: #555; margin-top: 2px; }
  .titulo { font-size: 13px; font-weight: bold; text-align: center; margin: 8px 0 4px; text-transform: uppercase; letter-spacing: 1px; }
  .colaborador { display: flex; gap: 40px; background: #f0f4ff; padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; font-size: 11px; }
  .colaborador strong { display: block; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10.5px; }
  th { background: #1e40af; color: white; padding: 5px 6px; text-align: center; font-size: 10px; text-transform: uppercase; }
  td { padding: 4px 6px; text-align: center; border-bottom: 1px solid #e5e7eb; }
  tr.fim-semana td { background: #f9fafb; color: #9ca3af; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: bold; }
  .resumo { display: grid; grid-template-columns: repeat(5,1fr); gap: 8px; margin-bottom: 14px; }
  .card { border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px 10px; }
  .card-val { font-size: 16px; font-weight: bold; }
  .card-label { font-size: 9px; color: #6b7280; text-transform: uppercase; margin-top: 2px; }
  .cartao { text-align: center; padding: 10px; border-radius: 4px; font-weight: bold; font-size: 13px; margin-bottom: 14px; }
  .cartao.ok { background: #dcfce7; color: #16a34a; border: 1px solid #86efac; }
  .assinaturas { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 10px; }
  .ass-linha { width: 200px; border-top: 1px solid #111; text-align: center; padding-top: 4px; font-size: 10px; color: #555; }
</style></head><body>
<div class="header">
  <div class="empresa">${empresaConfig.nome}</div>
  ${empresaConfig.cnpj ? `<div class="cnpj">CNPJ: ${empresaConfig.cnpj}</div>` : ""}
  <div class="titulo">Espelho de Ponto — ${MESES_FULL[mesAtual.mes]} ${mesAtual.ano}</div>
</div>
<div class="colaborador">
  <div><strong>${u.nome}</strong>Colaborador(a)</div>
  <div><strong>${u.matricula}</strong>Matrícula</div>
  <div><strong>${J ? J.nome : "—"}</strong>Jornada</div>
  <div><strong>${J?.entrada || "—"} às ${J?.saida || "—"}</strong>Horário</div>
  <div><strong>${u.insalubridade ? `${u.insalubridade}%` : "Não possui"}</strong>Insalubridade</div>
</div>
<div class="resumo">
  <div class="card"><div class="card-val">${fmtHPdf(resumo.horasTrabalhadas)}</div><div class="card-label">Horas trabalhadas</div></div>
  <div class="card"><div class="card-val" style="color:${resumo.horasTrabalhadas - resumo.horasEsperadas >= 0 ? "#16a34a" : "#dc2626"}">${resumo.horasTrabalhadas - resumo.horasEsperadas >= 0 ? "+" : ""}${fmtHPdf(Math.abs(resumo.horasTrabalhadas - resumo.horasEsperadas))}</div><div class="card-label">Saldo de horas</div></div>
  <div class="card"><div class="card-val" style="color:${resumo.diasFalta > 0 ? "#dc2626" : "#16a34a"}">${resumo.diasFalta}</div><div class="card-label">Faltas</div></div>
  <div class="card"><div class="card-val">${fmtHPdf(resumo.horasExtra)}</div><div class="card-label">Horas extras</div></div>
  <div class="card" style="background:#fefce8; border-color:#fef08a; text-align:center;"><div class="card-val" style="color:#b45309;">${resumo.diasAdicionalNoturno} dias <span style="font-size:10px;font-weight:normal;">(${fmtHPdf(resumo.horasAdicionalNoturno)})</span></div><div class="card-label" style="color:#b45309;">Adicional Noturno</div></div>
</div>
<div class="cartao ok">
  🎴 Cartão Alimentação: ${resumo.diasCartao} dias concedidos (mínimo ${minimoHorasDia}h/dia)
</div>
<table>
  <tr><th>Dia</th><th>Data</th><th>Entrada</th><th>S. Almoço</th><th>Retorno</th><th>Saída</th><th>H. Trab.</th><th>Adic. Noturno</th><th>Ocorrência</th></tr>
  ${dias
    .map(({ d, diaSem, key, batidas, calc, fmtB }) => {
      const isFds = [0, 6].includes(new Date(key + "T12:00:00").getDay());
      const ocTag = calc?.status && calc.status !== "completo" && calc.status !== "futuro" ? `<span class="badge" style="background:${corStatus[calc.status]}22;color:${corStatus[calc.status]}">${nomesStatus[calc.status] || calc.status}</span>` : "";
      const adicStr = calc?.adicNoturnoHoras > 0 ? `<span style="font-weight: 600; color:#b45309; font-size: 9.5px;">${calc.adicNoturnoTexto} (${fmtHPdf(calc.adicNoturnoHoras)})</span>` : "—";
      return `<tr class="${isFds ? "fim-semana" : ""}">
      <td>${diaSem}</td>
      <td>${String(d).padStart(2, "0")}/${String(mesAtual.mes + 1).padStart(2, "0")}</td>
      <td>${fmtB(batidas[0])}</td><td>${fmtB(batidas[1])}</td>
      <td>${fmtB(batidas[2])}</td><td>${fmtB(batidas[3])}</td>
      <td>${calc?.horasTrabalhadas > 0 ? fmtHPdf(calc.horasTrabalhadas) : "—"}</td>
      <td>${adicStr}</td>
      <td>${ocTag}</td>
    </tr>`;
    })
    .join("")}
</table>
<div class="assinaturas">
  <div class="ass-linha">Assinatura do Colaborador</div>
  <div class="ass-linha">Assinatura do Responsável</div>
</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `espelho_${u.matricula}.html`;
      a.click();
    }
  }

  function gerarConsolidadoHTML() {
    const totalDays = new Date(mesAtual.ano, mesAtual.mes + 1, 0).getDate();
    const mesNome = MESES_FULL[mesAtual.mes];
    const ano = mesAtual.ano;

    let html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Planilha Geral de Ponto — ${mesNome} ${ano}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; padding: 30px; }
  .title-company { font-size: 14px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
  .title-date { font-size: 12px; font-weight: bold; margin-bottom: 20px; color: #333; }
  table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-family: Arial, sans-serif; font-size: 11px; margin-top: 5px; }
  th, td { border: 1px solid #000; padding: 6px 8px; vertical-align: middle; line-height: 1.3; }
  th { font-weight: bold; background-color: #f9fafb; text-align: left; }
  td { text-align: left; }
  .center { text-align: center; }
  .nowrap { white-space: nowrap; }
</style></head><body>
<div class="title-company">${empresaConfig.nome || "ELLP"}</div>
<div class="title-date">${mesNome}/${ano}</div>
<table>
  <thead>
    <tr>
      <th style="width: 25%;">Colaboradores</th>
      <th class="center" style="width: 7%;">Dias</th>
      <th class="center" style="width: 10%;">turno</th>
      <th class="center" style="width: 10%;">Insalub.</th>
      <th style="width: 38%;">Obs</th>
      <th class="center" style="width: 10%;">Alimentação</th>
    </tr>
  </thead>
  <tbody>`;

    colaboradores.forEach(u => {
      const r = resumosMes[u.id];
      
      const isNoturno = u.jornadaId === "clt_noturno" || (u.jornadaId === "personalizada" && u.jornadaCustom?.entrada && (parseInt(u.jornadaCustom.entrada.split(":")[0]) >= 18 || parseInt(u.jornadaCustom.entrada.split(":")[0]) < 6));
      let turnoStr = isNoturno ? "Noturno" : "Diurno";
      if (u.trocaJornadaDia && u.trocaJornadaIdAnterior) {
        turnoStr = "Misto";
      }
      
      let insStr = u.insalubridade ? `${u.insalubridade}%` : "";
      if (u.trocaInsalubridadeDia && u.trocaInsalubridadeAnterior !== undefined && u.trocaInsalubridadeAnterior !== null) {
        insStr = `${u.trocaInsalubridadeAnterior}% / ${u.insalubridade || 0}%`;
      }

      if (!r) {
        html += `<tr>
          <td style="font-weight: bold;">${u.nome}</td>
          <td class="center"></td>
          <td class="center">${turnoStr}</td>
          <td class="center">${insStr}</td>
          <td>—</td>
          <td class="center"></td>
        </tr>`;
        return;
      }

      const isAfastada = r.diasAfastamento > 0 && r.diasCartao === 0;
      const diasValue = r.diasCartao > 0 ? String(r.diasCartao).padStart(2, "0") : "";

      // 1. Faltas listing
      const diasFaltasArr = [];
      for (let day = 1; day <= totalDays; day++) {
        const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
        if (rDia && rDia.status === "falta") {
          diasFaltasArr.push(day);
        }
      }

      let faltasObs = "";
      if (diasFaltasArr.length > 0 && !u.apenasSomarHoras) {
        if (diasFaltasArr.length === 1) {
          faltasObs = `Falta dia ${String(diasFaltasArr[0]).padStart(2, "0")}`;
        } else if (diasFaltasArr.length === 2) {
          faltasObs = `Falta dias ${String(diasFaltasArr[0]).padStart(2, "0")} e ${String(diasFaltasArr[1]).padStart(2, "0")}`;
        } else {
          const firstParts = diasFaltasArr.slice(0, -1).map(d => String(d).padStart(2, "0")).join(", ");
          const lastPart = String(diasFaltasArr[diasFaltasArr.length - 1]).padStart(2, "0");
          faltasObs = `Falta dias: ${firstParts} e ${lastPart}`;
        }
      }

      // 2. Night hours grouping
      let adicObs = "";
      let totalAdicNoturno = 0;
      for (let day = 1; day <= totalDays; day++) {
        const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
        if (rDia && rDia.adicNoturnoHoras > 0) {
          totalAdicNoturno += rDia.adicNoturnoHoras;
        }
      }
      if (totalAdicNoturno > 0) {
        const adicFmt = String(Math.round(totalAdicNoturno * 10) / 10).replace(".", ",");
        adicObs = `${adicFmt}h de adicional noturno`;
      }

      // 3. Vacations (Férias)
      let feriasObs = "";
      if (u.ferias && u.ferias.length > 0) {
        const currentMonthStart = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-01`;
        const currentMonthEnd = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}`;
        const f = u.ferias.find(fv => fv.inicio <= currentMonthEnd && fv.fim >= currentMonthStart);
        if (f) {
          const fmtDate = (dStr: string) => {
            const parts = dStr.split("-");
            return `${parts[2]}/${parts[1]}`;
          };
          feriasObs = `Férias de ${fmtDate(f.inicio)} a ${fmtDate(f.fim)}`;
        }
      }

      // 4. Leaders mark
      const liderObs = u.lider ? "Líder (138,00)" : "";

      // 5. Volus recommendation
      const wantsVolus = (r.diasCartao > 0 && r.diasCartao <= 5) || !!u.forcarVolus;
      const volusObs = wantsVolus ? "Solicitar Cartão Volus" : "";

      // 6. Insalubridade transition description
      let insalubridadeObs = "";
      if (u.trocaInsalubridadeDia && u.trocaInsalubridadeAnterior !== undefined && u.trocaInsalubridadeAnterior !== null) {
        const diaTroca = u.trocaInsalubridadeDia;
        const ant = u.trocaInsalubridadeAnterior;
        const atual = u.insalubridade || 0;
        
        let diasPrimeiroPeriodo = 0;
        for (let day = 1; day < diaTroca; day++) {
          const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
          if (rDia && (rDia.horasTrabalhadas > 0 || rDia.status === "atestado")) {
            diasPrimeiroPeriodo++;
          }
        }
        
        let diasSegundoPeriodo = 0;
        for (let day = diaTroca; day <= totalDays; day++) {
          const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
          if (rDia && (rDia.horasTrabalhadas > 0 || rDia.status === "atestado")) {
            diasSegundoPeriodo++;
          }
        }

        if (diasPrimeiroPeriodo > 0 && diasSegundoPeriodo > 0) {
          insalubridadeObs = `${ant}% referente a ${String(diasPrimeiroPeriodo).padStart(2, "0")} dias, restante do mês ${atual}%`;
        } else if (diasPrimeiroPeriodo > 0) {
          insalubridadeObs = `${ant}% referente a ${String(diasPrimeiroPeriodo).padStart(2, "0")} dias`;
        } else {
          insalubridadeObs = `${atual}% referente a ${String(diasSegundoPeriodo).padStart(2, "0")} dias`;
        }
      }

      // 7. Horas Extras
      let horasExtrasObs = "";
      if (r.horasExtra > 0) {
        const hrExtraFmt = String(Math.round(r.horasExtra * 10) / 10).replace(".", ",");
        horasExtrasObs = `${hrExtraFmt} horas extras 50%`;
      }

      const obsParts = [];
      if (isAfastada) {
        obsParts.push("Afastada");
      } else if (u.apenasSomarHoras) {
        obsParts.push(`${String(Math.round(r.horasTrabalhadas * 10) / 10).replace(".", ",")} horas trabalhadas`);
      } else {
        if (feriasObs) obsParts.push(feriasObs);
        if (faltasObs) obsParts.push(faltasObs);
        if (adicObs) obsParts.push(adicObs);
        if (insalubridadeObs) obsParts.push(insalubridadeObs);
        if (liderObs) obsParts.push(liderObs);
        if (horasExtrasObs) obsParts.push(horasExtrasObs);
        if (volusObs) obsParts.push(volusObs);
      }
      const obsString = obsParts.join(" / ") || "";

      let alimentacaoStr = "";
      if (isAfastada) {
        alimentacaoStr = "--------------";
      } else if (isNoturno || u.apenasSomarHoras) {
        alimentacaoStr = "";
      } else {
        alimentacaoStr = diasValue;
      }

      const cellDias = isAfastada || u.apenasSomarHoras ? "" : diasValue;
      const cellInsalub = isAfastada ? "" : insStr;

      html += `<tr>
        <td style="font-weight: bold;">${u.nome}</td>
        <td class="center">${cellDias}</td>
        <td class="center">${isAfastada ? "" : turnoStr}</td>
        <td class="center">${cellInsalub}</td>
        <td>${obsString}</td>
        <td class="center">${alimentacaoStr}</td>
      </tr>`;
    });

    html += `</tbody></table></body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `planilha_geral_ponto_${mesNome.toLowerCase()}_${ano}.html`;
      a.click();
    }
  }

  const [buscaSpreadsheet, setBuscaSpreadsheet] = useState("");

  function exportToXLS() {
    const totalDays = new Date(mesAtual.ano, mesAtual.mes + 1, 0).getDate();
    const mesNome = MESES_FULL[mesAtual.mes];
    const ano = mesAtual.ano;
    
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-type" content="text/html;charset=utf-8" />
      <style>
        table { border-collapse: collapse; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        th { background-color: #B2C3E2; color: #1E293B; border: 1px solid #94A3B8; font-weight: bold; padding: 8px; text-align: left; }
        th.center { text-align: center; }
        td { border: 1px solid #CBD5E1; padding: 6px 8px; font-size: 11pt; color: #334155; }
        td.center { text-align: center; }
        .bold-name { font-weight: bold; color: #0F172A; }
      </style>
    </head>
    <body>
      <h3>Planilha Geral de Ponto — ${mesNome} / ${ano}</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 250px;">Colaboradores</th>
            <th class="center" style="width: 60px;">Dias</th>
            <th class="center" style="width: 100px;">turno</th>
            <th class="center" style="width: 80px;">Insalub.</th>
            <th style="width: 450px;">Obs</th>
            <th class="center" style="width: 100px;">Alimentação</th>
          </tr>
        </thead>
        <tbody>`;

    colaboradores.forEach(u => {
      const r = resumosMes[u.id];
      
      const isNoturno = u.jornadaId === "clt_noturno" || (u.jornadaId === "personalizada" && u.jornadaCustom?.entrada && (parseInt(u.jornadaCustom.entrada.split(":")[0]) >= 18 || parseInt(u.jornadaCustom.entrada.split(":")[0]) < 6));
      let turnoStr = isNoturno ? "Noturno" : "Diurno";
      if (u.trocaJornadaDia && u.trocaJornadaIdAnterior) {
        turnoStr = "Misto";
      }
      
      let insStr = u.insalubridade ? `${u.insalubridade}%` : "";
      if (u.trocaInsalubridadeDia && u.trocaInsalubridadeAnterior !== undefined && u.trocaInsalubridadeAnterior !== null) {
        insStr = `${u.trocaInsalubridadeAnterior}% / ${u.insalubridade || 0}%`;
      }

      if (!r) {
        html += `<tr>
          <td class="bold-name">${u.nome}</td>
          <td class="center"></td>
          <td class="center">${turnoStr}</td>
          <td class="center">${insStr}</td>
          <td>—</td>
          <td class="center"></td>
        </tr>`;
        return;
      }

      const isAfastada = r.diasAfastamento > 0 && r.diasCartao === 0;
      const diasValue = r.diasCartao > 0 ? String(r.diasCartao).padStart(2, "0") : "";

      // 1. Faltas listing
      const diasFaltasArr = [];
      for (let day = 1; day <= totalDays; day++) {
        const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
        if (rDia && rDia.status === "falta") {
          diasFaltasArr.push(day);
        }
      }

      let faltasObs = "";
      if (diasFaltasArr.length > 0 && !u.apenasSomarHoras) {
        if (diasFaltasArr.length === 1) {
          faltasObs = `Falta dia ${String(diasFaltasArr[0]).padStart(2, "0")}`;
        } else if (diasFaltasArr.length === 2) {
          faltasObs = `Falta dias ${String(diasFaltasArr[0]).padStart(2, "0")} e ${String(diasFaltasArr[1]).padStart(2, "0")}`;
        } else {
          const firstParts = diasFaltasArr.slice(0, -1).map(d => String(d).padStart(2, "0")).join(", ");
          const lastPart = String(diasFaltasArr[diasFaltasArr.length - 1]).padStart(2, "0");
          faltasObs = `Falta dias: ${firstParts} e ${lastPart}`;
        }
      }

      // 2. Night hours grouping
      let adicObs = "";
      let totalAdicNoturno = 0;
      for (let day = 1; day <= totalDays; day++) {
        const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
        if (rDia && rDia.adicNoturnoHoras > 0) {
          totalAdicNoturno += rDia.adicNoturnoHoras;
        }
      }
      if (totalAdicNoturno > 0) {
        const adicFmt = String(Math.round(totalAdicNoturno * 10) / 10).replace(".", ",");
        adicObs = `${adicFmt}h de adicional noturno`;
      }

      // 3. Vacations (Férias)
      let feriasObs = "";
      if (u.ferias && u.ferias.length > 0) {
        const currentMonthStart = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-01`;
        const currentMonthEnd = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}`;
        const f = u.ferias.find(fv => fv.inicio <= currentMonthEnd && fv.fim >= currentMonthStart);
        if (f) {
          const fmtDate = (dStr: string) => {
            const parts = dStr.split("-");
            return `${parts[2]}/${parts[1]}`;
          };
          feriasObs = `Férias de ${fmtDate(f.inicio)} a ${fmtDate(f.fim)}`;
        }
      }

      // 4. Leaders mark
      const liderObs = u.lider ? "Líder (138,00)" : "";

      // 5. Volus recommendation
      const wantsVolus = (r.diasCartao > 0 && r.diasCartao <= 5) || !!u.forcarVolus;
      const volusObs = wantsVolus ? "Solicitar Cartão Volus" : "";

      // 6. Insalubridade transition description
      let insalubridadeObs = "";
      if (u.trocaInsalubridadeDia && u.trocaInsalubridadeAnterior !== undefined && u.trocaInsalubridadeAnterior !== null) {
        const diaTroca = u.trocaInsalubridadeDia;
        const ant = u.trocaInsalubridadeAnterior;
        const atual = u.insalubridade || 0;
        
        let diasPrimeiroPeriodo = 0;
        for (let day = 1; day < diaTroca; day++) {
          const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
          if (rDia && (rDia.horasTrabalhadas > 0 || rDia.status === "atestado")) {
            diasPrimeiroPeriodo++;
          }
        }
        
        let diasSegundoPeriodo = 0;
        for (let day = diaTroca; day <= totalDays; day++) {
          const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
          if (rDia && (rDia.horasTrabalhadas > 0 || rDia.status === "atestado")) {
            diasSegundoPeriodo++;
          }
        }

        if (diasPrimeiroPeriodo > 0 && diasSegundoPeriodo > 0) {
          insalubridadeObs = `${ant}% referente a ${String(diasPrimeiroPeriodo).padStart(2, "0")} dias, restante do mês ${atual}%`;
        } else if (diasPrimeiroPeriodo > 0) {
          insalubridadeObs = `${ant}% referente a ${String(diasPrimeiroPeriodo).padStart(2, "0")} dias`;
        } else {
          insalubridadeObs = `${atual}% referente a ${String(diasSegundoPeriodo).padStart(2, "0")} dias`;
        }
      }

      // 7. Horas Extras
      let horasExtrasObs = "";
      if (r.horasExtra > 0) {
        const hrExtraFmt = String(Math.round(r.horasExtra * 10) / 10).replace(".", ",");
        horasExtrasObs = `${hrExtraFmt} horas extras 50%`;
      }

      const obsParts = [];
      if (isAfastada) {
        obsParts.push("Afastada");
      } else if (u.apenasSomarHoras) {
        obsParts.push(`${String(Math.round(r.horasTrabalhadas * 10) / 10).replace(".", ",")} horas trabalhadas`);
      } else {
        if (feriasObs) obsParts.push(feriasObs);
        if (faltasObs) obsParts.push(faltasObs);
        if (adicObs) obsParts.push(adicObs);
        if (insalubridadeObs) obsParts.push(insalubridadeObs);
        if (liderObs) obsParts.push(liderObs);
        if (horasExtrasObs) obsParts.push(horasExtrasObs);
        if (volusObs) obsParts.push(volusObs);
      }
      const obsString = obsParts.join(" / ") || "";

      let alimentacaoStr = "";
      if (isAfastada) {
        alimentacaoStr = "--------------";
      } else if (isNoturno || u.apenasSomarHoras) {
        alimentacaoStr = "";
      } else {
        alimentacaoStr = diasValue;
      }

      const cellDias = isAfastada || u.apenasSomarHoras ? "" : diasValue;
      const cellInsalub = isAfastada ? "" : insStr;

      html += `<tr>
        <td class="bold-name">${u.nome}</td>
        <td class="center">${cellDias}</td>
        <td class="center">${isAfastada ? "" : turnoStr}</td>
        <td class="center">${cellInsalub}</td>
        <td>${obsString}</td>
        <td class="center">${alimentacaoStr}</td>
      </tr>`;
    });

    html += `</tbody></table></body></html>`;

    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planilha_geral_ponto_${mesNome.toLowerCase()}_${ano}.xls`;
    a.click();
    showToast("Planilha Excel (.xls) gerada com sucesso!");
  }

  function exportToCSV() {
    const totalDays = new Date(mesAtual.ano, mesAtual.mes + 1, 0).getDate();
    const mesNome = MESES_FULL[mesAtual.mes];
    const ano = mesAtual.ano;

    const headers = ["Colaboradores", "Dias", "turno", "Insalub.", "Obs", "Alimentação"];
    const rows = [headers.join(";")];

    colaboradores.forEach(u => {
      const r = resumosMes[u.id];
      
      const isNoturno = u.jornadaId === "clt_noturno" || (u.jornadaId === "personalizada" && u.jornadaCustom?.entrada && (parseInt(u.jornadaCustom.entrada.split(":")[0]) >= 18 || parseInt(u.jornadaCustom.entrada.split(":")[0]) < 6));
      let turnoStr = isNoturno ? "Noturno" : "Diurno";
      if (u.trocaJornadaDia && u.trocaJornadaIdAnterior) {
        turnoStr = "Misto";
      }
      
      let insStr = u.insalubridade ? `${u.insalubridade}%` : "";
      if (u.trocaInsalubridadeDia && u.trocaInsalubridadeAnterior !== undefined && u.trocaInsalubridadeAnterior !== null) {
        insStr = `${u.trocaInsalubridadeAnterior}% / ${u.insalubridade || 0}%`;
      }

      if (!r) {
        rows.push([u.nome, "", turnoStr, insStr, "—", ""].join(";"));
        return;
      }

      const isAfastada = r.diasAfastamento > 0 && r.diasCartao === 0;
      const diasValue = r.diasCartao > 0 ? String(r.diasCartao).padStart(2, "0") : "";

      // 1. Faltas listing
      const diasFaltasArr = [];
      for (let day = 1; day <= totalDays; day++) {
        const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
        if (rDia && rDia.status === "falta") {
          diasFaltasArr.push(day);
        }
      }

      let faltasObs = "";
      if (diasFaltasArr.length > 0 && !u.apenasSomarHoras) {
        if (diasFaltasArr.length === 1) {
          faltasObs = `Falta dia ${String(diasFaltasArr[0]).padStart(2, "0")}`;
        } else if (diasFaltasArr.length === 2) {
          faltasObs = `Falta dias ${String(diasFaltasArr[0]).padStart(2, "0")} e ${String(diasFaltasArr[1]).padStart(2, "0")}`;
        } else {
          const firstParts = diasFaltasArr.slice(0, -1).map(d => String(d).padStart(2, "0")).join(", ");
          const lastPart = String(diasFaltasArr[diasFaltasArr.length - 1]).padStart(2, "0");
          faltasObs = `Falta dias: ${firstParts} e ${lastPart}`;
        }
      }

      // 2. Night hours grouping
      let adicObs = "";
      let totalAdicNoturno = 0;
      for (let day = 1; day <= totalDays; day++) {
        const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
        if (rDia && rDia.adicNoturnoHoras > 0) {
          totalAdicNoturno += rDia.adicNoturnoHoras;
        }
      }
      if (totalAdicNoturno > 0) {
        const adicFmt = String(Math.round(totalAdicNoturno * 10) / 10).replace(".", ",");
        adicObs = `${adicFmt}h de adicional noturno`;
      }

      // 3. Vacations
      let feriasObs = "";
      if (u.ferias && u.ferias.length > 0) {
        const currentMonthStart = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-01`;
        const currentMonthEnd = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}`;
        const f = u.ferias.find(fv => fv.inicio <= currentMonthEnd && fv.fim >= currentMonthStart);
        if (f) {
          const fmtDate = (dStr: string) => {
            const parts = dStr.split("-");
            return `${parts[2]}/${parts[1]}`;
          };
          feriasObs = `Férias de ${fmtDate(f.inicio)} a ${fmtDate(f.fim)}`;
        }
      }

      const liderObs = u.lider ? "Líder (138,00)" : "";
      const wantsVolus = (r.diasCartao > 0 && r.diasCartao <= 5) || !!u.forcarVolus;
      const volusObs = wantsVolus ? "Solicitar Cartão Volus" : "";

      let insalubridadeObs = "";
      if (u.trocaInsalubridadeDia && u.trocaInsalubridadeAnterior !== undefined && u.trocaInsalubridadeAnterior !== null) {
        const diaTroca = u.trocaInsalubridadeDia;
        const ant = u.trocaInsalubridadeAnterior;
        const atual = u.insalubridade || 0;
        
        let diasPrimeiroPeriodo = 0;
        for (let day = 1; day < diaTroca; day++) {
          const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
          if (rDia && (rDia.horasTrabalhadas > 0 || rDia.status === "atestado")) {
            diasPrimeiroPeriodo++;
          }
        }
        
        let diasSegundoPeriodo = 0;
        for (let day = diaTroca; day <= totalDays; day++) {
          const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
          if (rDia && (rDia.horasTrabalhadas > 0 || rDia.status === "atestado")) {
            diasSegundoPeriodo++;
          }
        }

        if (diasPrimeiroPeriodo > 0 && diasSegundoPeriodo > 0) {
          insalubridadeObs = `${ant}% referente a ${String(diasPrimeiroPeriodo).padStart(2, "0")} dias, restante do mês ${atual}%`;
        } else if (diasPrimeiroPeriodo > 0) {
          insalubridadeObs = `${ant}% referente a ${String(diasPrimeiroPeriodo).padStart(2, "0")} dias`;
        } else {
          insalubridadeObs = `${atual}% referente a ${String(diasSegundoPeriodo).padStart(2, "0")} dias`;
        }
      }

      let horasExtrasObs = "";
      if (r.horasExtra > 0) {
        const hrExtraFmt = String(Math.round(r.horasExtra * 10) / 10).replace(".", ",");
        horasExtrasObs = `${hrExtraFmt} horas extras 50%`;
      }

      const obsParts = [];
      if (isAfastada) {
        obsParts.push("Afastada");
      } else if (u.apenasSomarHoras) {
        obsParts.push(`${String(Math.round(r.horasTrabalhadas * 10) / 10).replace(".", ",")} horas trabalhadas`);
      } else {
        if (feriasObs) obsParts.push(feriasObs);
        if (faltasObs) obsParts.push(faltasObs);
        if (adicObs) obsParts.push(adicObs);
        if (insalubridadeObs) obsParts.push(insalubridadeObs);
        if (liderObs) obsParts.push(liderObs);
        if (horasExtrasObs) obsParts.push(horasExtrasObs);
        if (volusObs) obsParts.push(volusObs);
      }
      const obsString = obsParts.join(" / ") || "";

      let alimentacaoStr = "";
      if (isAfastada) {
        alimentacaoStr = "--------------";
      } else if (isNoturno || u.apenasSomarHoras) {
        alimentacaoStr = "";
      } else {
        alimentacaoStr = diasValue;
      }

      const cellDias = isAfastada || u.apenasSomarHoras ? "" : diasValue;
      const cellInsalub = isAfastada ? "" : insStr;

      rows.push([
        u.nome,
        cellDias,
        isAfastada ? "" : turnoStr,
        cellInsalub,
        obsString,
        alimentacaoStr
      ].join(";"));
    });

    const csvContent = rows.join("\n");
    const blob = new Blob(["\ufeff", csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planilha_geral_ponto_${mesNome.toLowerCase()}_${ano}.csv`;
    a.click();
    showToast("Planilha CSV (.csv) gerada com sucesso!");
  }

  function copyToClipboard() {
    const totalDays = new Date(mesAtual.ano, mesAtual.mes + 1, 0).getDate();
    let text = "Colaboradores\tDias\tturno\tInsalub.\tObs\tAlimentação\n";

    colaboradores.forEach(u => {
      const r = resumosMes[u.id];
      const isNoturno = u.jornadaId === "clt_noturno" || (u.jornadaId === "personalizada" && u.jornadaCustom?.entrada && (parseInt(u.jornadaCustom.entrada.split(":")[0]) >= 18 || parseInt(u.jornadaCustom.entrada.split(":")[0]) < 6));
      let turnoStr = isNoturno ? "Noturno" : "Diurno";
      if (u.trocaJornadaDia && u.trocaJornadaIdAnterior) {
        turnoStr = "Misto";
      }
      
      let insStr = u.insalubridade ? `${u.insalubridade}%` : "";
      if (u.trocaInsalubridadeDia && u.trocaInsalubridadeAnterior !== undefined && u.trocaInsalubridadeAnterior !== null) {
        insStr = `${u.trocaInsalubridadeAnterior}% / ${u.insalubridade || 0}%`;
      }

      if (!r) {
        text += `${u.nome}\t\t${turnoStr}\t${insStr}\t—\t\n`;
        return;
      }

      const isAfastada = r.diasAfastamento > 0 && r.diasCartao === 0;
      const diasValue = r.diasCartao > 0 ? String(r.diasCartao).padStart(2, "0") : "";

      // 1. Faltas listing
      const diasFaltasArr = [];
      for (let day = 1; day <= totalDays; day++) {
        const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
        if (rDia && rDia.status === "falta") {
          diasFaltasArr.push(day);
        }
      }

      let faltasObs = "";
      if (diasFaltasArr.length > 0 && !u.apenasSomarHoras) {
        if (diasFaltasArr.length === 1) {
          faltasObs = `Falta dia ${String(diasFaltasArr[0]).padStart(2, "0")}`;
        } else if (diasFaltasArr.length === 2) {
          faltasObs = `Falta dias ${String(diasFaltasArr[0]).padStart(2, "0")} e ${String(diasFaltasArr[1]).padStart(2, "0")}`;
        } else {
          const firstParts = diasFaltasArr.slice(0, -1).map(d => String(d).padStart(2, "0")).join(", ");
          const lastPart = String(diasFaltasArr[diasFaltasArr.length - 1]).padStart(2, "0");
          faltasObs = `Falta dias: ${firstParts} e ${lastPart}`;
        }
      }

      // 2. Night hours grouping
      let adicObs = "";
      let totalAdicNoturno = 0;
      for (let day = 1; day <= totalDays; day++) {
        const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
        if (rDia && rDia.adicNoturnoHoras > 0) {
          totalAdicNoturno += rDia.adicNoturnoHoras;
        }
      }
      if (totalAdicNoturno > 0) {
        const adicFmt = String(Math.round(totalAdicNoturno * 10) / 10).replace(".", ",");
        adicObs = `${adicFmt}h de adicional noturno`;
      }

      // 3. Vacations
      let feriasObs = "";
      if (u.ferias && u.ferias.length > 0) {
        const currentMonthStart = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-01`;
        const currentMonthEnd = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}`;
        const f = u.ferias.find(fv => fv.inicio <= currentMonthEnd && fv.fim >= currentMonthStart);
        if (f) {
          const fmtDate = (dStr: string) => {
            const parts = dStr.split("-");
            return `${parts[2]}/${parts[1]}`;
          };
          feriasObs = `Férias de ${fmtDate(f.inicio)} a ${fmtDate(f.fim)}`;
        }
      }

      const liderObs = u.lider ? "Líder (138,00)" : "";
      const wantsVolus = (r.diasCartao > 0 && r.diasCartao <= 5) || !!u.forcarVolus;
      const volusObs = wantsVolus ? "Solicitar Cartão Volus" : "";

      let insalubridadeObs = "";
      if (u.trocaInsalubridadeDia && u.trocaInsalubridadeAnterior !== undefined && u.trocaInsalubridadeAnterior !== null) {
        const diaTroca = u.trocaInsalubridadeDia;
        const ant = u.trocaInsalubridadeAnterior;
        const atual = u.insalubridade || 0;
        
        let diasPrimeiroPeriodo = 0;
        for (let day = 1; day < diaTroca; day++) {
          const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
          if (rDia && (rDia.horasTrabalhadas > 0 || rDia.status === "atestado")) {
            diasPrimeiroPeriodo++;
          }
        }
        
        let diasSegundoPeriodo = 0;
        for (let day = diaTroca; day <= totalDays; day++) {
          const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
          if (rDia && (rDia.horasTrabalhadas > 0 || rDia.status === "atestado")) {
            diasSegundoPeriodo++;
          }
        }

        if (diasPrimeiroPeriodo > 0 && diasSegundoPeriodo > 0) {
          insalubridadeObs = `${ant}% referente a ${String(diasPrimeiroPeriodo).padStart(2, "0")} dias, restante do mês ${atual}%`;
        } else if (diasPrimeiroPeriodo > 0) {
          insalubridadeObs = `${ant}% referente a ${String(diasPrimeiroPeriodo).padStart(2, "0")} dias`;
        } else {
          insalubridadeObs = `${atual}% referente a ${String(diasSegundoPeriodo).padStart(2, "0")} dias`;
        }
      }

      let horasExtrasObs = "";
      if (r.horasExtra > 0) {
        const hrExtraFmt = String(Math.round(r.horasExtra * 10) / 10).replace(".", ",");
        horasExtrasObs = `${hrExtraFmt} horas extras 50%`;
      }

      const obsParts = [];
      if (isAfastada) {
        obsParts.push("Afastada");
      } else if (u.apenasSomarHoras) {
        obsParts.push(`${String(Math.round(r.horasTrabalhadas * 10) / 10).replace(".", ",")} horas trabalhadas`);
      } else {
        if (feriasObs) obsParts.push(feriasObs);
        if (faltasObs) obsParts.push(faltasObs);
        if (adicObs) obsParts.push(adicObs);
        if (insalubridadeObs) obsParts.push(insalubridadeObs);
        if (liderObs) obsParts.push(liderObs);
        if (horasExtrasObs) obsParts.push(horasExtrasObs);
        if (volusObs) obsParts.push(volusObs);
      }
      const obsString = obsParts.join(" / ") || "";

      let alimentacaoStr = "";
      if (isAfastada) {
        alimentacaoStr = "--------------";
      } else if (isNoturno || u.apenasSomarHoras) {
        alimentacaoStr = "";
      } else {
        alimentacaoStr = diasValue;
      }

      const cellDias = isAfastada || u.apenasSomarHoras ? "" : diasValue;
      const cellInsalub = isAfastada ? "" : insStr;

      text += `${u.nome}\t${cellDias}\t${isAfastada ? "" : turnoStr}\t${cellInsalub}\t${obsString}\t${alimentacaoStr}\n`;
    });

    navigator.clipboard.writeText(text);
    showToast("Dados copiados em formato de tabela! Pode colar direto no Excel ou Google Sheets.");
  }

  const colaboradores = useMemo(() => users.filter(u => u.tipo !== "adm-dev" && !u.desativado), [users]);

  const computedPrePontos = useMemo(() => {
    return prePontos.map(pre => {
      // Cross-reference with real points
      const userRegs = pontosGlobal[pre.userId];
      const realBatida = userRegs?.[pre.dayKey]?.[pre.idx];
      
      // Check timing
      const elapsedMinutes = (Date.now() - new Date(pre.quando).getTime()) / 60000;
      
      let calcStatus: "sucesso" | "cancelado" | "fantasma" | "ativo" = "ativo";
      if (realBatida) {
        calcStatus = "sucesso";
      } else if (pre.status === "cancelado") {
        calcStatus = "cancelado";
      } else if (pre.status === "sucesso" && !realBatida) {
        calcStatus = "fantasma"; // clicked confirm but did not reach database!
      } else if (pre.status === "pendente" && elapsedMinutes > 2) {
        calcStatus = "fantasma"; // pending for more than 2 minutes -> ghost click/dropped!
      } else {
        calcStatus = "ativo"; // pending but fresh click (< 2 min)
      }

      return {
        ...pre,
        calcStatus,
        realBatida
      };
    }).sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime());
  }, [prePontos, pontosGlobal]);

  function seed100Colaboradores() {
    if (!window.confirm("Deseja gerar 100 novos colaboradores com diferentes jornadas (todas as categorias) e pontos diversificados (sem marcação britânica, com faltas, atestados e férias) para o mês de " + MESES_FULL[mesAtual.mes] + "? Isso substituirá os registros de ponto e colaboradores existentes.")) {
      return;
    }

    const firstNames = ["José", "Maria", "Ana", "João", "Francisco", "Antônio", "Carlos", "Paulo", "Pedro", "Lucas", "Luiz", "Marcos", "Gabriel", "Rafael", "Daniel", "Mateus", "Rodrigo", "Juliana", "Camila", "Fernanda", "Amanda", "Letícia", "Larissa", "Paula", "Bruno", "Thiago", "Beatriz", "Mariana", "Aline", "Patrícia", "Gabriela", "Felipe", "Gustavo", "Diego", "Fábio", "Renato", "Cláudia", "Renata", "Marcela", "Carla", "Vanessa", "Sandra", "Tatiane"];
    const lastNames = ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Rocha", "Almeida", "Lopes", "Soares", "Moreira", "Barbosa", "Vieira", "Teixeira", "Machado", "Nunes", "Cardoso", "Mendes", "Araújo", "Freitas", "Pinto", "Batista", "Pires", "Cabral", "Duarte", "Mesquita"];

    const categoriasJornadas = [
      "clt_8h", "clt_6h", "clt_12x36", "clt_noturno", "clt_tarde",
      "clt_meio", "clt_meio_t", "comercial", "sabado", "escala_5x1",
      "escala_5x2", "escala_6x1", "home_flex"
    ];

    const novosUsuarios: User[] = [
      ...users.filter(u => u.tipo === "adm-dev")
    ];

    const novosPontos: PontosGlobal = {};

    let currentUserId = 200;
    const totalDays = new Date(mesAtual.ano, mesAtual.mes + 1, 0).getDate();

    for (let i = 1; i <= 100; i++) {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln1 = lastNames[Math.floor(Math.random() * lastNames.length)];
      const ln2 = lastNames[Math.floor(Math.random() * lastNames.length)];
      const nomeCompleto = `${fn} ${ln1} ${ln2}`;
      const matricula = String(100100 + i);

      const jId = categoriasJornadas[(i - 1) % categoriasJornadas.length];

      const ins: 0 | 20 | 40 = i % 3 === 0 ? 20 : i % 5 === 0 ? 40 : 0;

      const feriasPeriod: PeriodoFerias[] | undefined = (i === 5 || i === 9) ? [
        {
          inicio: `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-05`,
          fim: `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-20`
        }
      ] : undefined;

      const newUser: User = {
        id: currentUserId,
        matricula,
        nome: nomeCompleto,
        tipo: "colaborador",
        senha: `Senha@${matricula}`,
        primeiroAcesso: false,
        bloqueado: false,
        desativado: false,
        perm_trocar_senha_adm: false,
        perm_trocar_senha: false,
        perm_bloquear: false,
        perm_excluir: false,
        perm_editar_calendario: false,
        perm_gestao_folhas: false,
        termoAceito: true,
        termoAceitoEm: new Date().toISOString(),
        jornadaId: jId,
        jornadaCustom: null,
        insalubridade: ins === 0 ? undefined : ins,
        ferias: feriasPeriod,
        criadoEm: new Date().toISOString()
      };

      novosUsuarios.push(newUser);

      const userPontos: Record<string, DiaPontos> = {};

      const buildIsoStr = (dayKey: string, timeStr: string, devMin: number, crossDayNext: boolean) => {
        const d = new Date(dayKey + "T00:00:00");
        if (crossDayNext) {
          d.setDate(d.getDate() + 1);
        }
        const [hhStr, mmStr] = timeStr.split(":");
        let totalMin = parseInt(hhStr, 10) * 60 + parseInt(mmStr, 10) + devMin;
        const finalH = Math.floor(totalMin / 60) % 24;
        const finalM = Math.max(0, Math.min(59, totalMin % 60));
        d.setHours(finalH, finalM, 0, 0);
        return d.toISOString();
      };

      const j = getJornada(jId);

      for (let dNum = 1; dNum <= totalDays; dNum++) {
        const dStr = String(dNum).padStart(2, "0");
        const mStr = String(mesAtual.mes + 1).padStart(2, "0");
        const dayKey = `${mesAtual.ano}-${mStr}-${dStr}`;

        if (feriasPeriod && dayKey >= feriasPeriod[0].inicio && dayKey <= feriasPeriod[0].fim) {
          continue;
        }

        const dateObj = new Date(mesAtual.ano, mesAtual.mes, dNum);
        const diaSem = dateObj.getDay();
        const diasUteis = j?.diasSemana || [1, 2, 3, 4, 5];

        if (!diasUteis.includes(diaSem)) {
          continue;
        }

        const rng = Math.random();

        if (rng < 0.04) {
          userPontos[dayKey] = [
            { ocorrencia: "falta", tipo: "manual" },
            null, null, null
          ];
        } else if (rng < 0.07) {
          userPontos[dayKey] = [
            { ocorrencia: "atestado", parcial: false, tipo: "manual" },
            null, null, null
          ];
        } else if (rng < 0.09) {
          userPontos[dayKey] = [
            { ocorrencia: "afastamento", tipo: "manual" },
            null, null, null
          ];
        } else if (rng < 0.12) {
          const entTime = j?.entrada || "08:00";
          const dEnt = buildIsoStr(dayKey, entTime, Math.floor(Math.random() * 15) - 7, false);
          userPontos[dayKey] = [
            { hora: dEnt, tipo: "auto", registradoEm: dEnt },
            null, null, null
          ];
        } else {
          const entTime = j?.entrada || "08:00";
          const sAlmTime = j?.saidaAlmoco;
          const rAlmTime = j?.retornoAlmoco;
          const sTime = j?.saida || "17:00";

          const devEnt = Math.floor(Math.random() * 21) - 10;
          const devSaidaAlm = Math.floor(Math.random() * 17) - 8;
          const devRetornoAlm = Math.floor(Math.random() * 17) - 8;
          const devSaida = Math.floor(Math.random() * 25) - 12;

          const hEnt = buildIsoStr(dayKey, entTime, devEnt, false);
          
          if (sAlmTime && rAlmTime) {
            const hSaidaAlm = buildIsoStr(dayKey, sAlmTime, devSaidaAlm, false);
            const hRetornoAlm = buildIsoStr(dayKey, rAlmTime, devRetornoAlm, false);
            const crossS = jId === "clt_noturno" && parseInt(sTime.split(":")[0]) < parseInt(entTime.split(":")[0]);
            const hSaida = buildIsoStr(dayKey, sTime, devSaida, crossS);

            userPontos[dayKey] = [
              { hora: hEnt, tipo: "auto", registradoEm: hEnt },
              { hora: hSaidaAlm, tipo: "auto", registradoEm: hSaidaAlm },
              { hora: hRetornoAlm, tipo: "auto", registradoEm: hRetornoAlm },
              { hora: hSaida, tipo: "auto", registradoEm: hSaida }
            ];
          } else {
            const crossS = jId === "clt_noturno" && parseInt(sTime.split(":")[0]) < parseInt(entTime.split(":")[0]);
            const hSaida = buildIsoStr(dayKey, sTime, devSaida, crossS);

            userPontos[dayKey] = [
              { hora: hEnt, tipo: "auto", registradoEm: hEnt },
              null,
              null,
              { hora: hSaida, tipo: "auto", registradoEm: hSaida }
            ];
          }
        }
      }

      novosPontos[currentUserId] = userPontos;
      currentUserId++;
    }

    setUsers(novosUsuarios);
    setPontosGlobal(novosPontos);
    showToast("100 colaboradores de teste gerados com sucesso!", "success");
    onAddLog("Gerou carga inicial", "Sistema", "Gerados 100 colaboradores com todos os tipos de jornadas e marcações de ponto diversificadas (sem marcação britânica).");
  }

  // Memoizing complex month calculation over all employees to prevent performance lag!
  const resumosMes = useMemo(() => {
    const acc: Record<number, any> = {};
    colaboradores.forEach(u => {
      acc[u.id] = u.jornadaId ? resumoMesCalculado(u.id, mesAtual.ano, mesAtual.mes, users, pontosGlobal, minimoHorasDia, feriados) : null;
    });
    return acc;
  }, [colaboradores, mesAtual.ano, mesAtual.mes, users, pontosGlobal, minimoHorasDia, feriados]);

  const semJornada = useMemo(() => colaboradores.filter(u => !u.jornadaId).length, [colaboradores]);
  
  const totalElegiveisAlimentacao = useMemo(() => colaboradores.filter(u => u.direitoAlimentacao !== false).length, [colaboradores]);
  const totalDiasAlimentacao = useMemo(() => colaboradores.reduce((acc, u) => acc + (u.direitoAlimentacao !== false && resumosMes[u.id] ? resumosMes[u.id].diasCartao : 0), 0), [colaboradores, resumosMes]);
  const mediaDiasAlimentacao = useMemo(() => totalElegiveisAlimentacao > 0 ? (totalDiasAlimentacao / totalElegiveisAlimentacao).toFixed(1) : "0", [totalElegiveisAlimentacao, totalDiasAlimentacao]);

  const totalEstimadoAlimentacaoPagar = useMemo(() => {
    return colaboradores.reduce((acc, u) => {
      if (u.direitoAlimentacao === false) return acc;
      const r = resumosMes[u.id];
      const dias = r ? r.diasCartao : 0;
      const valorCalculado = dias * valorDiarioAlimentacao;
      const valorFinal = Math.min(valorCalculado, limiteMaximoAlimentacao);
      return acc + valorFinal;
    }, 0);
  }, [colaboradores, resumosMes, valorDiarioAlimentacao, limiteMaximoAlimentacao]);
  
  function exportarTabelaAlimentacao() {
    const mesNome = MESES[mesAtual.mes];
    const ano = mesAtual.ano;
    
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-type" content="text/html;charset=utf-8" />
      <style>
        table { border-collapse: collapse; font-family: sans-serif; }
        th { background-color: #0F172A; color: #FFFFFF; border: 1px solid #334155; font-weight: bold; padding: 10px; text-align: left; }
        td { border: 1px solid #E2E8F0; padding: 8px 10px; font-size: 11pt; color: #334155; }
        .center { text-align: center; }
        .bold-name { font-weight: bold; color: #0F172A; }
      </style>
    </head>
    <body>
      <h3>Relatório de Cartão Alimentação — Competência: ${mesNome} / ${ano}</h3>
      <p>Mínimo diário configurado: ${minimoHorasDia} horas · Valor por dia: R$ ${valorDiarioAlimentacao.toFixed(2).replace('.', ',')} · Teto Máximo: R$ ${limiteMaximoAlimentacao.toFixed(2).replace('.', ',')}</p>
      <table>
        <thead>
          <tr>
            <th>Colaborador</th>
            <th>Matrícula</th>
            <th>Jornada</th>
            <th class="center">Tem Direito ao Benefício</th>
            <th class="center">Dias de Direito Calculados</th>
            <th class="center">Valor por Dia (R$)</th>
            <th class="center">Valor Total a Receber (R$)</th>
          </tr>
        </thead>
        <tbody>`;

    colaboradores.forEach(u => {
      const r = resumosMes[u.id];
      const elegivel = u.direitoAlimentacao !== false ? "SIM" : "NÃO";
      const dias = u.direitoAlimentacao !== false && r ? r.diasCartao : 0;
      const jLabel = Jlabel(u) || "Sem Jornada";
      const totalAReceber = Math.min(dias * valorDiarioAlimentacao, limiteMaximoAlimentacao);
      
      html += `<tr>
        <td class="bold-name">${u.nome}</td>
        <td>'${u.matricula}</td>
        <td>${jLabel}</td>
        <td class="center">${elegivel}</td>
        <td class="center" style="font-weight: bold; color: ${dias > 0 ? '#10B981' : '#EF4444'}">${dias}</td>
        <td class="center">R$ ${valorDiarioAlimentacao.toFixed(2).replace('.', ',')}</td>
        <td class="center" style="font-weight: bold; color: #10B981">R$ ${totalAReceber.toFixed(2).replace('.', ',')}</td>
      </tr>`;
    });

    html += `</tbody></table></body></html>`;

    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cartao_alimentacao_${mesNome.toLowerCase()}_${ano}.xls`;
    a.click();
    showToast("Planilha de Alimentação (.xls) exportada com sucesso!", "success");
    onAddLog("Exportou Vale-Alimentação XLS", "Sistema", `Planilha exportada para competência ${mesNome}/${ano}.`);
  }

  function copiarTabelaAlimentacao() {
    const mesNome = MESES[mesAtual.mes];
    let text = `Relatório de Cartão Alimentação — Competência: ${mesNome}/${mesAtual.ano}\n`;
    text += "Colaborador\tMatrícula\tJornada\tElegível\tDias de Direito\tValor Diário (R$)\tTotal a Receber (R$)\n";

    colaboradores.forEach(u => {
      const r = resumosMes[u.id];
      const elegivel = u.direitoAlimentacao !== false ? "Sim" : "Não";
      const dias = u.direitoAlimentacao !== false && r ? r.diasCartao : 0;
      const jLabel = Jlabel(u) || "Sem Jornada";
      const totalAReceber = Math.min(dias * valorDiarioAlimentacao, limiteMaximoAlimentacao);
      
      text += `${u.nome}\t${u.matricula}\t${jLabel}\t${elegivel}\t${dias}\tR$ ${valorDiarioAlimentacao.toFixed(2).replace('.', ',')}\tR$ ${totalAReceber.toFixed(2).replace('.', ',')}\n`;
    });

    navigator.clipboard.writeText(text);
    showToast("Dados copiados para a área de transferência!", "success");
  }

  const totalFaltas = useMemo(() => colaboradores.reduce((acc, u) => acc + (resumosMes[u.id]?.diasFalta || 0), 0), [colaboradores, resumosMes]);
  const totalParciais = useMemo(() => colaboradores.reduce((acc, u) => acc + (resumosMes[u.id]?.minutosAtraso > 0 || resumosMes[u.id]?.minutosAntecipacao > 0 ? 1 : 0), 0), [colaboradores, resumosMes]);
  const naoElegiveis = useMemo(() => colaboradores.filter(u => resumosMes[u.id] && resumosMes[u.id].diasCartao === 0 && u.jornadaId).length, [colaboradores, resumosMes]);

  function navMes(delta: number) {
    setMesAtual(prev => {
      let m = prev.mes + delta;
      let a = prev.ano;
      if (m > 11) {
        m = 0;
        a++;
      }
      if (m < 0) {
        m = 11;
        a--;
      }
      return { ano: a, mes: m };
    });
  }

  const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const COR_STATUS = {
    completo: { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.4)", text: "#22C55E" },
    parcial: { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.4)", text: "#F59E0B" },
    falta: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.4)", text: "#EF4444" },
    atestado: { bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.4)", text: "#3B82F6" },
    afastamento: { bg: "rgba(168,85,247,0.15)", border: "rgba(168,85,247,0.4)", text: "#A855F7" },
    folga: { bg: "transparent", border: "transparent", text: "" },
    futuro: { bg: "transparent", border: "transparent", text: "" }
  };

  const filtrados = useMemo(() => {
    let list = colaboradores.filter(u => u.nome.toLowerCase().includes(busca.toLowerCase()) || u.matricula.toLowerCase().includes(busca.toLowerCase()));
    if (filtroJornada !== "todas") {
      list = list.filter(u => u.jornadaId === filtroJornada);
    }
    return list;
  }, [colaboradores, busca, filtroJornada]);

  const todosAtestados = useMemo(() => {
    const list: {
      userId: number;
      userName: string;
      userMatricula: string;
      dayKey: string;
      cid: string;
      fotoAtestado?: string;
      obs?: string;
      registradoEm?: string;
      parcial?: boolean;
    }[] = [];

    users.forEach(u => {
      const userDays = pontosGlobal[u.id];
      if (!userDays) return;

      Object.keys(userDays).forEach(dayKey => {
        const dayArray = userDays[dayKey];
        if (!dayArray) return;

        dayArray.forEach(b => {
          if (b && b.ocorrencia === "atestado") {
            const alreadyAdded = list.some(item => item.userId === u.id && item.dayKey === dayKey);
            if (!alreadyAdded) {
              list.push({
                userId: u.id,
                userName: u.nome,
                userMatricula: u.matricula,
                dayKey,
                cid: b.cid || "N/A",
                fotoAtestado: b.fotoAtestado,
                obs: b.obs,
                registradoEm: b.registradoEm,
                parcial: b.parcial
              });
            }
          }
        });
      });
    });

    return list.sort((a, b) => b.dayKey.localeCompare(a.dayKey));
  }, [users, pontosGlobal]);

  const filtradosAtestados = useMemo(() => {
    if (!busca.trim()) return todosAtestados;
    const term = busca.toLowerCase();
    return todosAtestados.filter(
      a =>
        a.userName.toLowerCase().includes(term) ||
        a.userMatricula.toLowerCase().includes(term) ||
        a.cid.toLowerCase().includes(term) ||
        a.dayKey.includes(term)
    );
  }, [todosAtestados, busca]);

  function salvarJornada(userId: number) {
    if (!checkCalendarPermission()) return;
    const u = users.find(x => x.id === userId);
    if (!u) return;
    setUsers(prev =>
      prev.map(x =>
        x.id === userId
          ? {
              ...x,
              jornadaId: jornadaId,
              jornadaCustom: jornadaId === "personalizada" ? jornadaCustom : null
            }
          : x
      )
    );
    showToast(`Jornada de ${u.nome} atualizada`);
    setModalJornada(null);
  }

  function alterarInsalubridade(userId: number, valor: 0 | 20 | 40) {
    if (!checkCalendarPermission()) return;
    const u = users.find(x => x.id === userId);
    if (!u) return;

    const valorAnterior = u.insalubridade !== undefined ? u.insalubridade : 0;
    if (valorAnterior === valor) return;

    setUsers(prev =>
      prev.map(x =>
        x.id === userId
          ? {
              ...x,
              insalubridade: valor === 0 ? undefined : valor
            }
          : x
      )
    );

    const txtAnterior = valorAnterior === 0 ? "Não possui (0%)" : `${valorAnterior}%`;
    const txtNovo = valor === 0 ? "Não possui (0%)" : `${valor}%`;

    onAddLog(
      "Alterou Adicional de Insalubridade",
      `${u.nome} (${u.matricula})`,
      `Adicional de insalubridade do colaborador alterado de ${txtAnterior} para ${txtNovo}. Responsável: ${currentUser.nome}`
    );

    showToast(`Insalubridade de ${u.nome} updated para ${txtNovo}`);
  }

  function alternarLider(userId: number, liderStatus: boolean) {
    if (!checkCalendarPermission()) return;
    const u = users.find(x => x.id === userId);
    setUsers(prev =>
      prev.map(x =>
        x.id === userId
          ? { ...x, lider: liderStatus }
          : x
      )
    );
    if (u) {
      onAddLog(
        "Alterou Status de Líder",
        `${u.nome} (${u.matricula})`,
        `Colaborador definido como Líder: ${liderStatus ? "Sim" : "Não"}. Responsável: ${currentUser.nome}`
      );
    }
    showToast(liderStatus ? "Colaborador definido como Líder" : "Líder removido");
  }

  function alternarForcarVolus(userId: number, volusStatus: boolean) {
    if (!checkCalendarPermission()) return;
    const u = users.find(x => x.id === userId);
    setUsers(prev =>
      prev.map(x =>
        x.id === userId
          ? { ...x, forcarVolus: volusStatus }
          : x
      )
    );
    if (u) {
      onAddLog(
        "Alterou Solicitação de Cartão",
        `${u.nome} (${u.matricula})`,
        `Solicitação de Cartão Volus forçada: ${volusStatus ? "Sim" : "Não"}. Responsável: ${currentUser.nome}`
      );
    }
    showToast(volusStatus ? "Solicitação de Cartão Volus forçada" : "Forçar Cartão Volus removido");
  }


  function alternarDireitoAlimentacao(userId: number, status: boolean) {
    if (!checkCalendarPermission()) return;
    const u = users.find(x => x.id === userId);
    setUsers(prev =>
      prev.map(x =>
        x.id === userId
          ? { ...x, direitoAlimentacao: status }
          : x
      )
    );
    if (u) {
      onAddLog(
        "Alterou Direito Alimentação",
        `${u.nome} (${u.matricula})`,
        `Direito a vale-alimentação alterado para: ${status ? "Sim" : "Não"}. Responsável: ${currentUser.nome}`
      );
    }
    showToast(status ? "Direito ao vale-alimentação habilitado" : "Direito ao vale-alimentação desabilitado");
  }

  function salvarTrocaJornada(userId: number, dia: number | null, jIdAnterior: string | null) {
    if (!checkCalendarPermission()) return;
    const u = users.find(x => x.id === userId);
    setUsers(prev =>
      prev.map(x =>
        x.id === userId
          ? { ...x, trocaJornadaDia: dia, trocaJornadaIdAnterior: jIdAnterior }
          : x
      )
    );
    if (u) {
      onAddLog(
        "Configurou Troca de Jornada",
        `${u.nome} (${u.matricula})`,
        dia
          ? `Troca de jornada em meio de mês configurada para o dia ${dia} com jornada anterior ID: ${jIdAnterior}. Responsável: ${currentUser.nome}`
          : `Removida configuração de troca de jornada em meio de mês. Responsável: ${currentUser.nome}`
      );
    }
  }

  function salvarTrocaInsalubridade(userId: number, dia: number | null, antInsalubridade: 0 | 20 | 40 | null) {
    if (!checkCalendarPermission()) return;
    const u = users.find(x => x.id === userId);
    setUsers(prev =>
      prev.map(x =>
        x.id === userId
          ? { ...x, trocaInsalubridadeDia: dia, trocaInsalubridadeAnterior: antInsalubridade }
          : x
      )
    );
    if (u) {
      onAddLog(
        "Configurou Troca de Insalubridade",
        `${u.nome} (${u.matricula})`,
        dia
          ? `Troca de insalubridade em meio de mês configurada para o dia ${dia} com percentual anterior: ${antInsalubridade}%. Responsável: ${currentUser.nome}`
          : `Removida configuração de troca de insalubridade em meio de mês. Responsável: ${currentUser.nome}`
      );
    }
  }

  function abrirJornada(u: User) {
    setJornadaId(u.jornadaId || "");
    setJornadaCustom(u.jornadaCustom || { id: "personalizada", nome: "Personalizada", entrada: "08:00", saidaAlmoco: "12:00", retornoAlmoco: "13:00", saida: "17:00", horasDia: 8, diasSemana: [1, 2, 3, 4, 5], descricao: "" });
    setModalJornada(u.id);
  }

  const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  function statusDia(userId: number, dayKey: string, J: Jornada | null) {
    const calc = calcularDia(userId, dayKey, users, pontosGlobal, feriados);
    if (calc) return calc.status;

    const batidas = pontosGlobal[userId]?.[dayKey];
    const date = new Date(dayKey + "T12:00:00");
    const diaSem = date.getDay();
    const hojeStr = new Date().toISOString().slice(0, 10);
    const diasUteis = J?.diasSemana || [1, 2, 3, 4, 5];
    if (!diasUteis.includes(diaSem)) return "folga";
    if (dayKey > hojeStr) return "futuro";
    if (!batidas) return "falta";

    const ocorrencia = batidas.find(b => b && b.ocorrencia);
    if (ocorrencia) {
      const tipo = ocorrencia.ocorrencia;
      if (tipo === "atestado") return "atestado";
      if (tipo === "afastamento") return "afastamento";
      if (tipo === "falta") return "falta";
      return "parcial";
    }

    const filled = batidas.filter(b => b && !b.ocorrencia).length;
    const precisam = J?.saidaAlmoco ? 4 : 2;
    if (filled >= precisam) return "completo";
    if (filled > 0) return "parcial";
    return "falta";
  }

  function statusColaborador(userId: number) {
    const r = resumoMes(userId);
    if (r.faltas > 0) return "falta";
    if (r.parciais > 0) return "parcial";
    return "completo";
  }

  function resumoMes(userId: number) {
    const J = (() => {
      const u = users.find(x => x.id === userId);
      if (!u?.jornadaId) return null;
      return u.jornadaId === "personalizada" ? u.jornadaCustom : getJornada(u.jornadaId);
    })();
    const totalDays = new Date(mesAtual.ano, mesAtual.mes + 1, 0).getDate();
    const dias = [];
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(mesAtual.ano, mesAtual.mes, d);
      dias.push({ date, key: date.toISOString().slice(0, 10) });
    }
    const hojeStr = new Date().toISOString().slice(0, 10);
    let faltas = 0, completos = 0, parciais = 0, atestados = 0;
    dias.forEach(({ key }) => {
      if (key > hojeStr) return;
      const st = statusDia(userId, key, J);
      if (st === "falta") faltas++;
      else if (st === "completo") completos++;
      else if (st === "parcial") parciais++;
      else if (st === "atestado") atestados++;
    });
    return { faltas, completos, parciais, atestados };
  }

  function Jlabel(u: User): string | null {
    if (!u.jornadaId) return null;
    return u.jornadaId === "personalizada" ? u.jornadaCustom?.nome || "Personalizada" : getJornada(u.jornadaId)?.nome || "—";
  }

  const activeUser = colaboradorSelecionado ? (users.find(x => x.id === colaboradorSelecionado.id) || colaboradorSelecionado) : null;
  const selectedUserJornada = activeUser ? (activeUser.jornadaId === "personalizada" ? activeUser.jornadaCustom : (activeUser.jornadaId ? getJornada(activeUser.jornadaId) : null)) : null;

  if (colaboradorSelecionado && activeUser) {
    return (
      <div style={{ minHeight: "100vh", background: t.bg }}>
        {/* Header */}
        <div style={{ background: t.surface, borderBottom: `1px solid ${t.border}`, padding: "0 28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => setColaboradorSelecionado(null)}
                style={{
                  background: t.surfaceAlt,
                  border: `1.5px solid ${t.border}`,
                  borderRadius: 8,
                  padding: "6px 12px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  color: t.textSub,
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                ← Voltar
              </button>
              <div style={{ width: 1, height: 24, background: t.border }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{activeUser.nome}</div>
                <div style={{ fontSize: 11.5, color: t.textMuted }}>Mat. {activeUser.matricula}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => abrirJornada(activeUser)}
                style={{
                  background: t.accentGlow,
                  border: `1.5px solid ${t.borderFocus}`,
                  borderRadius: 9,
                  padding: "7px 14px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  color: t.accent,
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                Definir Jornada
              </button>
              <button
                onClick={() => gerarEspelhoHTML(activeUser.id)}
                style={{
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  borderRadius: 9,
                  padding: "7px 14px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "#10B981",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                Espelho PDF
              </button>
              <button onClick={onLogout} style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 13px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: t.textSub, fontFamily: "inherit" }}>
                Sair
              </button>
            </div>
          </div>
        </div>

        {/* Selected Collaborator layout */}
        <div style={{ padding: "24px 28px", maxWidth: 960, margin: "0 auto" }}>
          {/* Journey detail Box */}
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: selectedUserJornada ? 14 : 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: selectedUserJornada ? t.accentGlow : t.surfaceAlt, border: `1.5px solid ${selectedUserJornada ? t.borderFocus : t.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span>📅</span>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                  {selectedUserJornada ? Jlabel(activeUser) : "Jornada não definida"}
                </div>
                <div style={{ fontSize: 11.5, color: t.textSub }}>{selectedUserJornada?.descricao || "Clique em 'Definir Jornada' para configurar"}</div>
              </div>
            </div>
            {selectedUserJornada && selectedUserJornada.entrada && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {[
                  ["Entrada", selectedUserJornada.entrada],
                  selectedUserJornada.saidaAlmoco ? ["Saída Almoço", selectedUserJornada.saidaAlmoco] : null,
                  selectedUserJornada.retornoAlmoco ? ["Retorno", selectedUserJornada.retornoAlmoco] : null,
                  ["Saída", selectedUserJornada.saida]
                ]
                  .filter(Boolean)
                  .map(([label, val]) => (
                    <div key={label as string} style={{ background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: t.textMuted, textTransform: "uppercase" }}>{label as string}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "monospace" }}>{val as string}</div>
                    </div>
                  ))}
                <div style={{ background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 8, padding: "6px 12px" }}>
                  <div style={{ fontSize: 11, color: t.textMuted, textTransform: "uppercase" }}>Carga diária</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: t.accent, fontFamily: "monospace" }}>
                    {calcularHorasDia(activeUser.jornadaId, activeUser.jornadaCustom).toFixed(1)}h
                  </div>
                </div>
              </div>
            )}

            {/* Divider if journey is present or as a gap */}
            <div style={{ height: 1, background: t.border, margin: "16px 0" }} />

            {/* Adicional de Insalubridade row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: activeUser.insalubridade ? "rgba(245,158,11,0.12)" : t.surfaceAlt, border: `1px solid ${activeUser.insalubridade ? "#F59E0B" : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                  🛡️
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>Adicional de Insalubridade</div>
                  <div style={{ fontSize: 11, color: t.textSub }}>Define o percentual de insalubridade para cálculos de remuneração</div>
                </div>
              </div>

              {/* Selection segment controls */}
              <div style={{ display: "flex", background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: 3, gap: 3 }}>
                {[
                  { value: 0, label: "Não possui" },
                  { value: 20, label: "Grau Médio (20%)" },
                  { value: 40, label: "Grau Máximo (40%)" }
                ].map((opt) => {
                  const isSelected = (activeUser.insalubridade || 0) === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => alterarInsalubridade(activeUser.id, opt.value as 0 | 20 | 40)}
                      style={{
                        background: isSelected ? t.surface : "transparent",
                        border: isSelected ? `1px solid ${t.border}` : "1px solid transparent",
                        boxShadow: isSelected ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                        borderRadius: 8,
                        padding: "6px 14px",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? (opt.value > 0 ? "#F59E0B" : t.text) : t.textSub,
                        fontFamily: "inherit",
                        transition: "all 0.15s"
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: t.border, margin: "16px 0" }} />

            {/* Atribuições Especiais (Líder / Cartão Volus / Horas Extras / Apenas Somar Horas) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 16 }}>
              {/* Lider checkbox block */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: t.surfaceAlt, border: `1.5px solid ${activeUser.lider ? t.accent : t.border}`, borderRadius: 10, cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={!!activeUser.lider}
                  onChange={e => alternarLider(activeUser.id, e.target.checked)}
                  style={{ width: 17, height: 17, cursor: "pointer" }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>👑 Definir como Líder</div>
                  <div style={{ fontSize: 11, color: t.textSub }}>Inclui "adicional lider 138,00" na descrição do relatório</div>
                </div>
              </label>

              {/* Volus checkbox block */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: t.surfaceAlt, border: `1.5px solid ${activeUser.forcarVolus ? t.accent : t.border}`, borderRadius: 10, cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={!!activeUser.forcarVolus}
                  onChange={e => alternarForcarVolus(activeUser.id, e.target.checked)}
                  style={{ width: 17, height: 17, cursor: "pointer" }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>💳 Solicitar Cartão Volus</div>
                  <div style={{ fontSize: 11, color: t.textSub }}>Força "Solicitar Cartão Volus" na descrição do relatório</div>
                </div>
              </label>

              {/* Direito ao Cartão Alimentação block */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: t.surfaceAlt, border: `1.5px solid ${activeUser.direitoAlimentacao !== false ? t.accent : t.border}`, borderRadius: 10, cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={activeUser.direitoAlimentacao !== false}
                  onChange={e => alternarDireitoAlimentacao(activeUser.id, e.target.checked)}
                  style={{ width: 17, height: 17, cursor: "pointer" }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>🎴 Vale-Alimentação</div>
                  <div style={{ fontSize: 11, color: t.textSub }}>Habilita direito e cálculo dos dias de direito ao benefício</div>
                </div>
              </label>
            </div>

            {/* Transições de Meio de Mês */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {/* Troca de Jornada */}
              <div style={{ background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  🔄 Troca de Jornada no Mês
                </div>
                <div style={{ fontSize: 11, color: t.textSub, marginBottom: 12 }}>
                  Calcule uma jornada diferente de trabalho para dias anteriores à troca.
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <input
                    type="checkbox"
                    id="hasTrocaJor"
                    checked={activeUser.trocaJornadaDia !== undefined && activeUser.trocaJornadaDia !== null}
                    onChange={e => {
                      if (e.target.checked) {
                        salvarTrocaJornada(activeUser.id, 15, JORNADAS_PREDEFINIDAS[0].id);
                      } else {
                        salvarTrocaJornada(activeUser.id, null, null);
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  />
                  <label htmlFor="hasTrocaJor" style={{ fontSize: 12, fontWeight: 600, color: t.text, cursor: "pointer" }}>
                    Ativar troca de jornada no meio do mês
                  </label>
                </div>

                {activeUser.trocaJornadaDia !== undefined && activeUser.trocaJornadaDia !== null && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 3 }}>
                        Dia de início da nova jornada:
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={activeUser.trocaJornadaDia || 15}
                        onChange={e => salvarTrocaJornada(activeUser.id, parseInt(e.target.value) || 15, activeUser.trocaJornadaIdAnterior || JORNADAS_PREDEFINIDAS[0].id)}
                        style={{ width: "100%", background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 6, padding: "5px 8px", color: t.text, fontSize: 12 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 3 }}>
                        Jornada antes desse dia (anterior):
                      </label>
                      <select
                        value={activeUser.trocaJornadaIdAnterior || JORNADAS_PREDEFINIDAS[0].id}
                        onChange={e => salvarTrocaJornada(activeUser.id, activeUser.trocaJornadaDia, e.target.value)}
                        style={{ width: "100%", background: t.surface, border: `1px solid ${t.border}`, borderRadius: 6, padding: "5px 8px", color: t.text, fontSize: 12 }}
                      >
                        {JORNADAS_PREDEFINIDAS.map(j => (
                          <option key={j.id} value={j.id}>{j.nome} ({j.entrada || "—"} às {j.saida || "—"})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Troca de Insalubridade */}
              <div style={{ background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  🛡️ Troca de Função / Insalubridade
                </div>
                <div style={{ fontSize: 11, color: t.textSub, marginBottom: 12 }}>
                  Se o colaborador mudou de grau de insalubridade no meio do mês.
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <input
                    type="checkbox"
                    id="hasTrocaIns"
                    checked={activeUser.trocaInsalubridadeDia !== undefined && activeUser.trocaInsalubridadeDia !== null}
                    onChange={e => {
                      if (e.target.checked) {
                        salvarTrocaInsalubridade(activeUser.id, 15, 20);
                      } else {
                        salvarTrocaInsalubridade(activeUser.id, null, null);
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  />
                  <label htmlFor="hasTrocaIns" style={{ fontSize: 12, fontWeight: 600, color: t.text, cursor: "pointer" }}>
                    Ativar alteração de insalubridade no mês
                  </label>
                </div>

                {activeUser.trocaInsalubridadeDia !== undefined && activeUser.trocaInsalubridadeDia !== null && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 3 }}>
                        Dia de início do novo adicional:
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={activeUser.trocaInsalubridadeDia || 15}
                        onChange={e => salvarTrocaInsalubridade(activeUser.id, parseInt(e.target.value) || 15, activeUser.trocaInsalubridadeAnterior !== undefined ? activeUser.trocaInsalubridadeAnterior : 0)}
                        style={{ width: "100%", background: t.surface, border: `1px solid ${t.border}`, borderRadius: 6, padding: "5px 8px", color: t.text, fontSize: 12 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 3 }}>
                        Percentual antes desse dia (anterior):
                      </label>
                      <select
                        value={activeUser.trocaInsalubridadeAnterior !== undefined ? String(activeUser.trocaInsalubridadeAnterior) : "0"}
                        onChange={e => salvarTrocaInsalubridade(activeUser.id, activeUser.trocaInsalubridadeDia, parseInt(e.target.value) as 0 | 20 | 40)}
                        style={{ width: "100%", background: t.surface, border: `1px solid ${t.border}`, borderRadius: 6, padding: "5px 8px", color: t.text, fontSize: 12 }}
                      >
                        <option value="0">Não possui (0%)</option>
                        <option value="20">Grau Médio (20%)</option>
                        <option value="40">Grau Máximo (40%)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, alignItems: "start" }}>
            <div>
              {/* Nav mes */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={() => navMes(-1)} style={{ background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13, color: t.textSub, fontWeight: 600 }}>
                    ←
                  </button>
                  <span style={{ fontSize: 15, fontWeight: 700, color: t.text, minWidth: 160, textAlign: "center" }}>
                    {MESES[mesAtual.mes]} {mesAtual.ano}
                  </span>
                  <button
                    onClick={() => navMes(1)}
                    disabled={mesAtual.ano === hoje.getFullYear() && mesAtual.mes === hoje.getMonth()}
                    style={{
                      background: t.surfaceAlt,
                      border: `1.5px solid ${t.border}`,
                      borderRadius: 8,
                      padding: "6px 12px",
                      cursor: "pointer",
                      fontSize: 13,
                      color: t.textSub,
                      fontWeight: 600,
                      opacity: mesAtual.ano === hoje.getFullYear() && mesAtual.mes === hoje.getMonth() ? 0.3 : 1
                    }}
                  >
                    →
                  </button>
                </div>
                <ResumoMesBadges r={resumoMes(activeUser.id)} COR_STATUS={COR_STATUS} />
              </div>

              {/* Monthly calendar render */}
              <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, padding: "18px", marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 8 }}>
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(dayName => (
                    <div key={dayName} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: t.textMuted }}>
                      {dayName}
                    </div>
                  ))}
                </div>
                <GradeCal
                  ano={mesAtual.ano}
                  mes={mesAtual.mes}
                  userId={activeUser.id}
                  jornada={selectedUserJornada}
                  statusDia={statusDia}
                  COR_STATUS={COR_STATUS}
                  t={t}
                  onDayClick={dayKey => {
                    if (currentUser.matricula !== SUPERADMIN_MAT && !currentUser.perm_editar_calendario) {
                      showToast("Você não possui permissão delegada para editar o calendário.", "warning");
                      return;
                    }
                    setModalLancamento({ userId: activeUser.id, dayKey });
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                {[
                  ["✓ Completo", "completo"],
                  ["~ Parcial", "parcial"],
                  ["✗ Falta", "falta"],
                  ["A Atestado", "atestado"],
                  ["AF Afastamento", "afastamento"]
                ].map(([lbl, val], idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: COR_STATUS[val as keyof typeof COR_STATUS].bg, border: `1.5px solid ${COR_STATUS[val as keyof typeof COR_STATUS].border}` }} />
                    <span style={{ fontSize: "11.5px", color: t.textSub }}>{lbl}</span>
                  </div>
                ))}
              </div>
            </div>

            <PainelTotais t={t} resumo={resumosMes[activeUser.id]} minimoHorasDia={minimoHorasDia} mes={MESES[mesAtual.mes]} />
          </div>
        </div>

        {/* Modal rendering */}
        {modalJornada && <ModalJornada t={t} userId={modalJornada} users={users} jornadaId={jornadaId} setJornadaId={setJornadaId} jornadaCustom={jornadaCustom} setJornadaCustom={setJornadaCustom} onSalvar={salvarJornada} onFechar={() => setModalJornada(null)} DIAS={DIAS} />}
        {modalLancamento && (
          <ModalLancamento
            t={t}
            userId={modalLancamento.userId}
            dayKey={modalLancamento.dayKey}
            users={users}
            pontosGlobal={pontosGlobal}
            jornada={selectedUserJornada}
            onSalvar={salvarLancamento}
            onFechar={() => setModalLancamento(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: t.bg }}>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 1000, background: t.successBg, border: `1.5px solid ${t.successBorder}`, color: t.success, borderRadius: 10, padding: "11px 18px", fontSize: "13.5px", fontWeight: 600 }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: t.surface, borderBottom: `1.5px solid ${t.border}`, padding: "0 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${t.accent}, #2040CC)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span>📑</span>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Painel de Frequência</div>
              <div style={{ fontSize: 11, color: t.textSub }}>Operador: {currentUser.nome}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setModalEmpresa(true)} title="Configurar empresa" style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <span>⚙️</span>
            </button>
            <button
              onClick={() => setModalSpreadsheet(true)}
              style={{
                background: "rgba(16,185,129,0.12)",
                border: "1px solid rgba(16,185,129,0.3)",
                borderRadius: 9,
                padding: "7px 13px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "12.5px",
                fontWeight: 600,
                color: "#10B981",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              📊 Planilha Geral
            </button>
            <button
              onClick={onGoAdm}
              style={{
                background: t.accentGlow,
                border: `1px solid ${t.borderFocus}`,
                borderRadius: 9,
                padding: "7px 13px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "12.5px",
                fontWeight: 600,
                color: t.accent,
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              Painel ADM
            </button>
            <button onClick={onLogout} style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 13px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: t.textSub, fontFamily: "inherit" }}>
              Sair
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 960, margin: "0 auto" }}>
        {/* Universal Top Bar: Month selector, minimum daily, active employee count */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => navMes(-1)} style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13, color: t.textSub, fontWeight: 600 }}>
              ←
            </button>
            <span style={{ fontSize: 15, fontWeight: 700, color: t.text, minWidth: 160, textAlign: "center" }}>
              {MESES[mesAtual.mes]} {mesAtual.ano}
            </span>
            <button
              onClick={() => navMes(1)}
              disabled={mesAtual.ano === hoje.getFullYear() && mesAtual.mes === hoje.getMonth()}
              style={{
                background: t.surfaceAlt,
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: 13,
                color: t.textSub,
                fontWeight: 600,
                opacity: mesAtual.ano === hoje.getFullYear() && mesAtual.mes === hoje.getMonth() ? 0.3 : 1
              }}
            >
              →
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }} title="Carga horária mínima trabalhada recomendada para concessão do vale-alimentação diário">
              <span style={{ fontSize: 12, color: t.textSub, fontWeight: "500" }}>Mín. Diário (Alimentação):</span>
              <input
                type="text"
                value={minimoHorasDia === 0 ? "" : String(minimoHorasDia)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  const valor = digits ? parseInt(digits, 10) : 0;
                  setMinimoHorasDia(valor);
                }}
                style={{
                  width: "32px",
                  background: t.surfaceAlt,
                  border: `1.5px solid ${t.border}`,
                  borderRadius: 6,
                  color: t.text,
                  textAlign: "center",
                  fontSize: "12px",
                  fontWeight: 700,
                  outline: "none",
                  padding: "4px 0",
                  fontFamily: "inherit"
                }}
              />
              <span style={{ fontSize: 11.5, color: t.textMuted, fontWeight: "500" }}>h</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }} title="Valor pago por dia com direito a vale-alimentação">
              <span style={{ fontSize: 12, color: t.textSub, fontWeight: "500" }}>Valor Diário:</span>
              <span style={{ fontSize: 11.5, color: t.textMuted, fontWeight: "500" }}>R$</span>
              <input
                type="text"
                value={valorDiarioAlimentacao === 0 ? "" : String(valorDiarioAlimentacao)}
                onChange={(e) => {
                  // Keep only digits and a single decimal point
                  const valStr = e.target.value.replace(/[^0-9.]/g, "");
                  const valor = valStr ? parseFloat(valStr) : 0;
                  alterarValorDiarioAlimentacao(valor);
                }}
                style={{
                  width: "48px",
                  background: t.surfaceAlt,
                  border: `1.5px solid ${t.border}`,
                  borderRadius: 6,
                  color: t.text,
                  textAlign: "center",
                  fontSize: "12px",
                  fontWeight: 700,
                  outline: "none",
                  padding: "4px 0",
                  fontFamily: "inherit"
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }} title="Valor máximo que o cartão alimentação paga por funcionário no mês">
              <span style={{ fontSize: 12, color: t.textSub, fontWeight: "500" }}>Teto Máximo:</span>
              <span style={{ fontSize: 11.5, color: t.textMuted, fontWeight: "500" }}>R$</span>
              <input
                type="text"
                value={limiteMaximoAlimentacao === 0 ? "" : String(limiteMaximoAlimentacao)}
                onChange={(e) => {
                  const valStr = e.target.value.replace(/[^0-9.]/g, "");
                  const valor = valStr ? parseFloat(valStr) : 0;
                  alterarLimiteMaximoAlimentacao(valor);
                }}
                style={{
                  width: "52px",
                  background: t.surfaceAlt,
                  border: `1.5px solid ${t.border}`,
                  borderRadius: 6,
                  color: t.text,
                  textAlign: "center",
                  fontSize: "12px",
                  fontWeight: 700,
                  outline: "none",
                  padding: "4px 0",
                  fontFamily: "inherit"
                }}
              />
            </div>

            <span style={{ fontSize: 12, color: t.textMuted }}>{colaboradores.length} colaboradores ativos</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: 8, borderBottom: `1.5px solid ${t.border}`, paddingBottom: 12, marginBottom: 20 }}>
          <button
            onClick={() => setGuiaAtiva("frequencia")}
            style={{
              background: guiaAtiva === "frequencia" ? t.accentGlow : "transparent",
              border: `1.5px solid ${guiaAtiva === "frequencia" ? t.borderFocus : "transparent"}`,
              color: guiaAtiva === "frequencia" ? t.accent : t.textSub,
              fontSize: "13px",
              fontWeight: 700,
              padding: "7px 14px",
              borderRadius: 8,
              cursor: "pointer",
              transition: "all 0.15s"
            }}
          >
            📊 Controle de Frequência
          </button>
          <button
            onClick={() => setGuiaAtiva("alimentacao")}
            style={{
              background: guiaAtiva === "alimentacao" ? t.accentGlow : "transparent",
              border: `1.5px solid ${guiaAtiva === "alimentacao" ? t.borderFocus : "transparent"}`,
              color: guiaAtiva === "alimentacao" ? t.accent : t.textSub,
              fontSize: "13px",
              fontWeight: 700,
              padding: "7px 14px",
              borderRadius: 8,
              cursor: "pointer",
              transition: "all 0.15s"
            }}
          >
            🎴 Gestão de Cartão Alimentação
          </button>
          <button
            onClick={() => setGuiaAtiva("atestados")}
            style={{
              background: guiaAtiva === "atestados" ? t.accentGlow : "transparent",
              border: `1.5px solid ${guiaAtiva === "atestados" ? t.borderFocus : "transparent"}`,
              color: guiaAtiva === "atestados" ? t.accent : t.textSub,
              fontSize: "13px",
              fontWeight: 700,
              padding: "7px 14px",
              borderRadius: 8,
              cursor: "pointer",
              transition: "all 0.15s"
            }}
          >
            📋 Gestão de Atestados
          </button>
          <button
            onClick={() => setGuiaAtiva("pre_pontos")}
            style={{
              background: guiaAtiva === "pre_pontos" ? t.accentGlow : "transparent",
              border: `1.5px solid ${guiaAtiva === "pre_pontos" ? t.borderFocus : "transparent"}`,
              color: guiaAtiva === "pre_pontos" ? t.accent : t.textSub,
              fontSize: "13px",
              fontWeight: 700,
              padding: "7px 14px",
              borderRadius: 8,
              cursor: "pointer",
              transition: "all 0.15s"
            }}
          >
            🛡️ Validação de Cliques (Pré-Pontos)
          </button>
        </div>

        {guiaAtiva === "frequencia" ? (
          <>
            {/* Highlight Alert widgets on top */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 22 }}>
              {[
                ["Faltas no mês", totalFaltas, totalFaltas > 0 ? t.danger : t.success, totalFaltas > 0 ? t.dangerBg : t.successBg, totalFaltas > 0 ? t.dangerBorder : t.successBorder],
                ["Atrasos/Parciais", totalParciais, totalParciais > 0 ? t.warning : t.success, totalParciais > 0 ? t.warningBg : t.successBg, totalParciais > 0 ? t.warningBorder : t.successBorder],
                ["Sem cartão", naoElegiveis, naoElegiveis > 0 ? t.danger : t.success, naoElegiveis > 0 ? t.dangerBg : t.successBg, naoElegiveis > 0 ? t.dangerBorder : t.successBorder],
                ["Sem jornada", semJornada, semJornada > 0 ? t.warning : t.success, semJornada > 0 ? t.warningBg : t.successBg, semJornada > 0 ? t.warningBorder : t.successBorder]
              ].map(([label, val, color, bg, border], idx) => (
                <div key={idx} style={{ background: t.surface, border: `1.5px solid ${border}`, borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: color as string, fontVariantNumeric: "tabular-nums" }}>{val}</div>
                  <div style={{ fontSize: 12, color: t.textSub, marginTop: 3 }}>{label as string}</div>
                </div>
              ))}
            </div>

            {/* Search and Filter Row */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <input
                placeholder="Buscar colaborador por nome ou matrícula..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                style={{ flex: 1, minWidth: "240px", boxSizing: "border-box", background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 10, color: t.text, fontSize: 14, padding: "10px 16px", outline: "none", fontFamily: "inherit" }}
              />
              <select
                value={filtroJornada}
                onChange={e => setFiltroJornada(e.target.value)}
                style={{ minWidth: "220px", background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 10, color: t.text, fontSize: 14, padding: "10px 16px", outline: "none", fontFamily: "inherit", cursor: "pointer" }}
              >
                <option value="todas">Filtrar por Jornada (Todas)</option>
                {JORNADAS_PREDEFINIDAS.map(j => (
                  <option key={j.id} value={j.id}>{j.nome}</option>
                ))}
                <option value="personalizada">Horários Personalizados (Custom)</option>
              </select>
            </div>

            {/* Collaborative listing */}
            {filtrados.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px", color: t.textMuted, fontSize: 14 }}>Nenhum colaborador encontrado.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {filtrados.map(colab => {
                  const temJornada = !!colab.jornadaId;
                  const jLabel = Jlabel(colab);
                  return <CardColaborador key={colab.id} u={colab} t={t} temJornada={temJornada} jLabel={jLabel} st={temJornada ? statusColaborador(colab.id) : "sem_jornada"} r={temJornada ? resumosMes[colab.id] : null} onClick={() => setColaboradorSelecionado(colab)} />;
                })}
              </div>
            )}
          </>
        ) : guiaAtiva === "alimentacao" ? (
          <>
            {/* VALE-ALIMENTAÇÃO TAB CONTENT */}
            {/* Highlight Alert widgets for Food Card */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 22 }}>
              {[
                ["Colaboradores Elegíveis", totalElegiveisAlimentacao, t.accent, t.accentGlow, t.borderFocus],
                ["Total de Dias de Direito", totalDiasAlimentacao, "#10B981", "rgba(16,185,129,0.1)", "rgba(16,185,129,0.3)"],
                ["Média de Dias / Colaborador", `${mediaDiasAlimentacao} dias`, "#F59E0B", "rgba(245,158,11,0.1)", "rgba(245,158,11,0.3)"],
                ["Total Estimado a Pagar", totalEstimadoAlimentacaoPagar.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "#3b82f6", "rgba(59,130,246,0.1)", "rgba(59,130,246,0.3)"]
              ].map(([label, val, color, bg, border], idx) => (
                <div key={idx} style={{ background: t.surface, border: `1.5px solid ${border}`, borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: color as string, fontVariantNumeric: "tabular-nums" }}>{val}</div>
                  <div style={{ fontSize: 12, color: t.textSub, marginTop: 3 }}>{label as string}</div>
                </div>
              ))}
            </div>

            {/* Explanatory Notice Block */}
            <div style={{ background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 18 }}>💡</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Sobre o Cálculo do Vale-Alimentação</div>
                  <div style={{ fontSize: 12, color: t.textSub, lineHeight: "1.5" }}>
                    Os dias de direito ao vale-alimentação correspondem apenas aos dias úteis em que o funcionário trabalhou no mínimo <strong>{minimoHorasDia} horas</strong> (configurado no topo). Dias de falta, férias, feriados, afastamentos ou atestados de dia completo não contabilizam dias de direito ao benefício. O pagamento é limitado ao teto máximo de <strong>R$ {limiteMaximoAlimentacao}</strong> (configurado no topo) por funcionário. O direito ao benefício pode ser ativado ou desativado individualmente para cada funcionário na tabela abaixo ou na tela de detalhes do colaborador.
                  </div>
                </div>
              </div>
            </div>

            {/* Filter and Export Row for Alimentacao */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "260px" }}>
                <input
                  placeholder="Buscar funcionário na gestão de alimentação..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 10, color: t.text, fontSize: 14, padding: "10px 16px", outline: "none", fontFamily: "inherit" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={copiarTabelaAlimentacao}
                  style={{
                    background: t.surfaceAlt,
                    border: `1.5px solid ${t.border}`,
                    borderRadius: 10,
                    padding: "9px 16px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: t.textSub,
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.15s"
                  }}
                >
                  📋 Copiar Dados
                </button>
                <button
                  onClick={exportarTabelaAlimentacao}
                  style={{
                    background: "rgba(16,185,129,0.12)",
                    border: "1px solid rgba(16,185,129,0.3)",
                    borderRadius: 10,
                    padding: "9px 16px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#10B981",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.15s"
                  }}
                >
                  📥 Exportar XLS
                </button>
              </div>
            </div>

            {/* Food Card Table listing */}
            {filtrados.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px", color: t.textMuted, fontSize: 14 }}>Nenhum funcionário encontrado.</div>
            ) : (
              <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }} className="no-scrollbar">
                  <table style={{ minWidth: 680, width: "100%", borderCollapse: "collapse", textAlign: "left", fontFamily: "inherit" }}>
                  <thead>
                    <tr style={{ background: t.surfaceAlt, borderBottom: `1.5px solid ${t.border}` }}>
                      <th style={{ padding: "14px 18px", fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>Nome / Matrícula</th>
                      <th style={{ padding: "14px 18px", fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>Jornada</th>
                      <th style={{ padding: "14px 18px", fontSize: "12.5px", fontWeight: 700, color: t.textSub, textAlign: "center" }}>Elegível</th>
                      <th style={{ padding: "14px 18px", fontSize: "12.5px", fontWeight: 700, color: t.textSub, textAlign: "center" }}>Dias com Direito ({MESES[mesAtual.mes]})</th>
                      <th style={{ padding: "14px 18px", fontSize: "12.5px", fontWeight: 700, color: t.textSub, textAlign: "right" }}>Valor a Receber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map(colab => {
                      const temDireito = colab.direitoAlimentacao !== false;
                      const r = resumosMes[colab.id];
                      const diasValue = temDireito && r ? r.diasCartao : 0;
                      const jLabel = Jlabel(colab) || "Sem jornada";

                      return (
                        <tr key={colab.id} style={{ borderBottom: `1px solid ${t.border}`, transition: "background 0.15s" }}>
                          {/* Colaborador Info */}
                          <td style={{ padding: "14px 18px" }}>
                            <div style={{ fontSize: "14px", fontWeight: 700, color: t.text }}>{colab.nome}</div>
                            <div style={{ fontSize: "11px", color: t.textMuted }}>Mat. {colab.matricula}</div>
                          </td>
                          {/* Jornada */}
                          <td style={{ padding: "14px 18px" }}>
                            <span style={{ fontSize: "12.5px", color: t.textSub, fontWeight: 500 }}>{jLabel}</span>
                          </td>
                          {/* Elegivel switch button */}
                          <td style={{ padding: "14px 18px", textAlign: "center" }}>
                            <button
                              onClick={() => alternarDireitoAlimentacao(colab.id, !temDireito)}
                              style={{
                                border: "none",
                                borderRadius: 20,
                                background: temDireito ? "rgba(16,185,129,0.15)" : t.surfaceAlt,
                                color: temDireito ? "#10B981" : t.textMuted,
                                fontSize: "11px",
                                fontWeight: 700,
                                padding: "5px 12px",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                borderStyle: "solid",
                                borderWidth: "1px",
                                borderColor: temDireito ? "rgba(16,185,129,0.3)" : t.border,
                                transition: "all 0.15s"
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: temDireito ? "#10B981" : t.textMuted }} />
                              {temDireito ? "Elegível" : "Não Elegível"}
                            </button>
                          </td>
                          {/* Calculated Days */}
                          <td style={{ padding: "14px 18px", textAlign: "center" }}>
                            <div style={{ fontSize: "16px", fontWeight: 800, color: diasValue > 0 ? "#10B981" : t.textMuted, fontVariantNumeric: "tabular-nums" }}>
                              {diasValue} {diasValue === 1 ? "dia" : "dias"}
                            </div>
                          </td>
                          {/* Calculated Value to Receive */}
                          <td style={{ padding: "14px 18px", textAlign: "right" }}>
                            {(() => {
                              const valorCalculado = diasValue * valorDiarioAlimentacao;
                              const valorFinal = Math.min(valorCalculado, limiteMaximoAlimentacao);
                              const atingiuTeto = valorCalculado > limiteMaximoAlimentacao;
                              
                              return (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                  <div style={{ fontSize: "15px", fontWeight: 800, color: diasValue > 0 ? "#10B981" : t.textMuted, fontVariantNumeric: "tabular-nums" }}>
                                    {valorFinal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                  </div>
                                  {atingiuTeto && (
                                    <div style={{ fontSize: "10.5px", color: "#EF4444", fontWeight: "600", marginTop: 2 }}>
                                      Teto atingido
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </>
        ) : guiaAtiva === "atestados" ? (
          <>
            {/* ATESTADOS TAB CONTENT */}
            {/* Metric widgets for Atestados */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 22 }}>
              {[
                ["Total de Atestados Lançados", todosAtestados.length, t.accent, t.accentGlow, t.borderFocus],
                ["Atestados Filtrados", filtradosAtestados.length, "#3b82f6", "rgba(59,130,246,0.1)", "rgba(59,130,246,0.3)"],
                ["Atestados Parciais (Horas)", todosAtestados.filter(x => x.parcial).length, "#F59E0B", "rgba(245,158,11,0.1)", "rgba(245,158,11,0.3)"],
                ["Colaboradores Afetados", new Set(todosAtestados.map(x => x.userId)).size, "#10B981", "rgba(16,185,129,0.1)", "rgba(16,185,129,0.3)"]
              ].map(([label, val, color, bg, border], idx) => (
                <div key={idx} style={{ background: t.surface, border: `1.5px solid ${border}`, borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: color as string, fontVariantNumeric: "tabular-nums" }}>{val}</div>
                  <div style={{ fontSize: 12, color: t.textSub, marginTop: 3 }}>{label as string}</div>
                </div>
              ))}
            </div>

            {/* Filter Row for Atestados */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "260px" }}>
                <input
                  placeholder="Buscar por colaborador, CID ou data..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 10, color: t.text, fontSize: 14, padding: "10px 16px", outline: "none", fontFamily: "inherit" }}
                />
              </div>
            </div>

            {filtradosAtestados.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px", background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 16, color: t.textMuted, fontSize: 14 }}>
                Nenhum atestado médico registrado ou encontrado para a busca.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                {filtradosAtestados.map((atest, index) => (
                  <div
                    key={`${atest.userId}-${atest.dayKey}-${index}`}
                    style={{
                      background: t.surface,
                      border: `1.5px solid ${t.border}`,
                      borderRadius: 16,
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
                    }}
                  >
                    {/* Header: User Info */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{atest.userName}</div>
                        <div style={{ fontSize: 11, color: t.textMuted }}>Mat. {atest.userMatricula}</div>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: atest.parcial ? "rgba(245,158,11,0.12)" : "rgba(59,130,246,0.12)",
                          color: atest.parcial ? "#D97706" : "#2563EB"
                        }}
                      >
                        {atest.parcial ? "Parcial (Horas)" : "Dia Completo"}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 12, alignItems: "center", background: t.surfaceAlt, padding: "8px 12px", borderRadius: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: t.textMuted }}>Data do Atestado</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                          {(() => {
                            try {
                              const [year, month, day] = atest.dayKey.split("-");
                              return `${day}/${month}/${year}`;
                            } catch {
                              return atest.dayKey;
                            }
                          })()}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: t.textMuted }}>Código CID-10</div>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            fontFamily: "monospace",
                            background: t.accentGlow,
                            color: t.accent,
                            padding: "2px 6px",
                            borderRadius: 4,
                            border: `1px solid ${t.borderFocus}`
                          }}
                        >
                          {atest.cid}
                        </span>
                      </div>
                    </div>

                    {/* Obs / Justificativa */}
                    {atest.obs && (
                      <div style={{ fontSize: 12, color: t.textSub, fontStyle: "italic", lineHeight: "1.4", background: "rgba(0,0,0,0.02)", padding: "8px 10px", borderRadius: 8, borderLeft: `3px solid ${t.border}` }}>
                        "{atest.obs}"
                      </div>
                    )}

                    {/* Foto do Atestado Thumbnail */}
                    {atest.fotoAtestado ? (
                      <div style={{ position: "relative", width: "100%", height: 140, borderRadius: 8, overflow: "hidden", cursor: "pointer", border: `1px solid ${t.border}`, background: "#111" }} onClick={() => setAtestadoAmpliado({ userName: atest.userName, dayKey: atest.dayKey, cid: atest.cid, foto: atest.fotoAtestado! })}>
                        <img
                          src={atest.fotoAtestado}
                          alt="Foto do Atestado"
                          referrerPolicy="no-referrer"
                          style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.2s" }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                        />
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "4px 8px", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span>🔍 Clique para ampliar</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ height: 140, borderRadius: 8, background: t.surfaceAlt, border: `1px dashed ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted, fontSize: 11 }}>
                        Nenhuma foto enviada
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* PRÉ-PONTOS / VALIDAÇÃO DE CLIQUES TAB CONTENT */}
            <div style={{ background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 16, padding: "20px", marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 6px 0", color: t.text, fontSize: "16px", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                🛡️ Monitoramento de Cliques de Intenção (Pré-Pontos)
              </h3>
              <p style={{ margin: 0, color: t.textSub, fontSize: "13px", lineHeight: "1.5" }}>
                Para evitar <strong>marcações fantasmas</strong> e diagnosticar falhas de rede, cada clique no botão de bater ponto é registrado instantaneamente como um "Pré-Ponto" (Intenção). 
                Abaixo, nosso motor de conciliação cruza as intenções de clique com as batidas de ponto reais gravadas na folha de frequência. 
                Se houver um clique registrado mas a batida correspondente não chegou, o sistema aponta uma anomalia de comunicação.
              </p>
            </div>

            {/* Metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 22 }}>
              <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: "16px 20px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Intenções Totais</div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: t.text, marginTop: 4 }}>{computedPrePontos.length} <span style={{ fontSize: "13px", fontWeight: 500, color: t.textMuted }}>cliques</span></div>
              </div>
              <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: "16px 20px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Batidas Confirmadas</div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#16a34a", marginTop: 4 }}>{computedPrePontos.filter(x => x.calcStatus === "sucesso").length} <span style={{ fontSize: "13px", fontWeight: 500, color: t.textMuted }}>conciliadas</span></div>
              </div>
              <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: "16px 20px", borderLeft: `4px solid #dc2626` }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.5px" }}>Anomalias / Fantasmas</div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#dc2626", marginTop: 4 }}>{computedPrePontos.filter(x => x.calcStatus === "fantasma").length} <span style={{ fontSize: "13px", fontWeight: 500, color: t.textMuted }}>não chegaram</span></div>
              </div>
              <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: "16px 20px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Cancelados ou Ativos</div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: t.textSub, marginTop: 4 }}>{computedPrePontos.filter(x => x.calcStatus === "cancelado" || x.calcStatus === "ativo").length} <span style={{ fontSize: "13px", fontWeight: 500, color: t.textMuted }}>desistências</span></div>
              </div>
            </div>

            {/* Filter controls */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  ["todos", "Todos os Cliques"],
                  ["sucesso", "✓ Confirmados"],
                  ["fantasma", "⚠️ Anomalias (Fantasmas)"],
                  ["cancelado", "✕ Cancelados"],
                  ["ativo", "⏳ Em andamento"]
                ].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setPreFilter(val as any)}
                    style={{
                      background: preFilter === val ? t.accentGlow : t.surface,
                      border: `1.5px solid ${preFilter === val ? t.borderFocus : t.border}`,
                      borderRadius: 10,
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: preFilter === val ? t.accent : t.textSub,
                      cursor: "pointer",
                      transition: "all 0.15s"
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Mini Search input */}
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por colaborador ou matrícula..."
                style={{
                  background: t.inputBg,
                  border: `1.5px solid ${t.border}`,
                  borderRadius: 10,
                  color: t.text,
                  fontSize: "13px",
                  padding: "8px 14px",
                  outline: "none",
                  width: "100%",
                  maxWidth: "320px",
                  fontFamily: "inherit"
                }}
              />
            </div>

            {/* Table or Empty message */}
            {(() => {
              const filteredList = computedPrePontos.filter(p => {
                // Status filter
                if (preFilter !== "todos" && p.calcStatus !== preFilter) return false;
                // Search filter
                if (busca) {
                  const bNorm = busca.toLowerCase();
                  return p.userName.toLowerCase().includes(bNorm) || p.matricula.includes(bNorm);
                }
                return true;
              });

              if (filteredList.length === 0) {
                return (
                  <div style={{ textAlign: "center", padding: "48px", background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, color: t.textMuted, fontSize: 14 }}>
                    Nenhum clique de intenção (pré-ponto) atende aos filtros atuais.
                  </div>
                );
              }

              const stepsLabels = [
                { label: "Entrada", color: "#10b981", bg: "rgba(16,185,129,0.11)" },
                { label: "Intervalo (Almoço)", color: "#ef4444", bg: "rgba(239,68,68,0.11)" },
                { label: "Volta Intervalo", color: "#3b82f6", bg: "rgba(59,130,246,0.11)" },
                { label: "Saída", color: "#8b5cf6", bg: "rgba(139,92,246,0.11)" }
              ];

              return (
                <div style={{ background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }} className="no-scrollbar">
                    <table style={{ minWidth: 800, width: "100%", borderCollapse: "collapse", textAlign: "left", fontFamily: "inherit" }}>
                      <thead>
                        <tr style={{ background: t.surfaceAlt, borderBottom: `1.5px solid ${t.border}` }}>
                          <th style={{ padding: "14px 18px", fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>Colaborador</th>
                          <th style={{ padding: "14px 18px", fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>Momento do Clique</th>
                          <th style={{ padding: "14px 18px", fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>Tipo de Batida</th>
                          <th style={{ padding: "14px 18px", fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>Modo</th>
                          <th style={{ padding: "14px 18px", fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>Status de Conciliação</th>
                          <th style={{ padding: "14px 18px", fontSize: "12.5px", fontWeight: 700, color: t.textSub }}>Carimbo Técnico</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredList.map((pre, idx) => {
                          const stepInfo = stepsLabels[pre.idx] || { label: "Desconhecido", color: "#6b7280", bg: "rgba(107,114,128,0.11)" };
                          const clickDate = new Date(pre.quando);
                          
                          return (
                            <tr key={pre.id || idx} style={{ borderBottom: `1px solid ${t.border}`, transition: "background 0.15s" }}>
                              {/* Colaborador */}
                              <td style={{ padding: "14px 18px" }}>
                                <div style={{ fontSize: "14px", fontWeight: 700, color: t.text }}>{pre.userName}</div>
                                <div style={{ fontSize: "11px", color: t.textMuted }}>Mat. {pre.matricula}</div>
                              </td>

                              {/* Momento */}
                              <td style={{ padding: "14px 18px" }}>
                                <div style={{ fontSize: "13px", color: t.text, fontWeight: 500 }}>
                                  {clickDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                </div>
                                <div style={{ fontSize: "11px", color: t.textSub }}>
                                  {clickDate.toLocaleDateString("pt-BR")}
                                </div>
                              </td>

                              {/* Tipo de batida (Entrada/Almoço etc) */}
                              <td style={{ padding: "14px 18px" }}>
                                <span
                                  style={{
                                    fontSize: "11.5px",
                                    fontWeight: 700,
                                    background: stepInfo.bg,
                                    color: stepInfo.color,
                                    padding: "3px 9px",
                                    borderRadius: 6,
                                    border: `1px solid ${stepInfo.color}25`
                                  }}
                                >
                                  {stepInfo.label}
                                </span>
                              </td>

                              {/* Modo */}
                              <td style={{ padding: "14px 18px" }}>
                                <span style={{ fontSize: "12.5px", color: t.textSub, fontWeight: 500 }}>
                                  {pre.tipo === "auto" ? "🛰️ Automático" : "⌨️ Manual"}
                                </span>
                              </td>

                              {/* Status Conciliação */}
                              <td style={{ padding: "14px 18px" }}>
                                {pre.calcStatus === "sucesso" ? (
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,0.11)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "4px 10px" }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                                    <strong style={{ color: "#16a34a", fontSize: "12px" }}>✓ Batida Gravada</strong>
                                  </div>
                                ) : pre.calcStatus === "fantasma" ? (
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(220,38,38,0.11)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 8, padding: "4px 10px" }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#dc2626" }} />
                                    <strong style={{ color: "#dc2626", fontSize: "12px" }}>⚠️ Clique Sem Batida (Fantasma)</strong>
                                  </div>
                                ) : pre.calcStatus === "cancelado" ? (
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(107,114,128,0.11)", border: "1px solid rgba(107,114,128,0.3)", borderRadius: 8, padding: "4px 10px" }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6b7280" }} />
                                    <strong style={{ color: "#4b5563", fontSize: "12px" }}>✕ Cancelado pelo Usuário</strong>
                                  </div>
                                ) : (
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(245,158,11,0.11)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "4px 10px" }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
                                    <strong style={{ color: "#d97706", fontSize: "12px" }}>⏳ Aguardando GPS / Rede</strong>
                                  </div>
                                )}
                              </td>

                              {/* Carimbo Técnico */}
                              <td style={{ padding: "14px 18px" }}>
                                <span style={{ fontFamily: "monospace", fontSize: "10.5px", color: t.textSub, background: t.surfaceAlt, padding: "3px 6px", borderRadius: 4, border: `1px solid ${t.border}` }}>
                                  ID: {pre.id ? pre.id.slice(0, 8) : "local"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {modalJornada && <ModalJornada t={t} userId={modalJornada} users={users} jornadaId={jornadaId} setJornadaId={setJornadaId} jornadaCustom={jornadaCustom} setJornadaCustom={setJornadaCustom} onSalvar={salvarJornada} onFechar={() => setModalJornada(null)} DIAS={DIAS} />}
      {modalEmpresa && <ModalEmpresa t={t} config={empresaConfig} onSalvar={c => { setEmpresaConfig(c); setModalEmpresa(false); }} onFechar={() => setModalEmpresa(false)} />}

      {atestadoAmpliado && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: 20
          }}
          onClick={() => setAtestadoAmpliado(null)}
        >
          <div
            style={{
              background: t.surface,
              border: `1.5px solid ${t.border}`,
              borderRadius: 20,
              width: "100%",
              maxWidth: 700,
              boxShadow: t.shadow,
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, color: t.text, fontSize: 16, fontWeight: 700 }}>Atestado de {atestadoAmpliado.userName}</h3>
                <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>
                  Data: {(() => {
                    try {
                      const [year, month, day] = atestadoAmpliado.dayKey.split("-");
                      return `${day}/${month}/${year}`;
                    } catch {
                      return atestadoAmpliado.dayKey;
                    }
                  })()} · CID: <strong style={{ color: t.accent }}>{atestadoAmpliado.cid}</strong>
                </div>
              </div>
              <button
                onClick={() => setAtestadoAmpliado(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 18,
                  color: t.textMuted,
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                ✕
              </button>
            </div>
            {/* Image Container */}
            <div style={{ flex: 1, overflow: "auto", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: 12, minHeight: 300 }}>
              <img
                src={atestadoAmpliado.foto}
                alt="Atestado Ampliado"
                referrerPolicy="no-referrer"
                style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 8 }}
              />
            </div>
            {/* Footer */}
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setAtestadoAmpliado(null)}
                style={{
                  background: t.surfaceAlt,
                  border: `1px solid ${t.border}`,
                  color: t.text,
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "8px 16px",
                  borderRadius: 10,
                  cursor: "pointer"
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {modalSpreadsheet && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 24
          }}
          onClick={() => setModalSpreadsheet(false)}
        >
          <div
            style={{
              background: t.surface,
              border: `1.5px solid ${t.border}`,
              borderRadius: 16,
              width: "100%",
              maxWidth: 1200,
              height: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              overflow: "hidden"
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: `1px solid ${t.border}` }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
                  📊 Planilha Geral de Frequência
                </h3>
                <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>
                  {empresaConfig.nome || "Empresa"} · Competência: <strong>{MESES_FULL[mesAtual.mes]} / {mesAtual.ano}</strong>
                </div>
              </div>
              
              <button
                onClick={() => setModalSpreadsheet(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                  color: t.textSub,
                  padding: 4,
                  display: "flex",
                  alignItems: "center"
                }}
              >
                ✕
              </button>
            </div>

            {/* Actions Bar */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 24px", background: t.surfaceAlt, borderBottom: `1px solid ${t.border}` }}>
              <div style={{ position: "relative", width: "100%", maxWidth: 300 }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: t.textSub }}>🔍</span>
                <input
                  type="text"
                  placeholder="Filtrar colaborador..."
                  value={buscaSpreadsheet}
                  onChange={e => setBuscaSpreadsheet(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 32px",
                    background: t.surface,
                    border: `1px solid ${t.border}`,
                    borderRadius: 8,
                    fontSize: 13,
                    color: t.text,
                    fontFamily: "inherit",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={exportToXLS}
                  style={{
                    background: "rgba(16,185,129,0.12)",
                    border: "1px solid rgba(16,185,129,0.3)",
                    color: "#10B981",
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  📥 Baixar Excel (.xls)
                </button>
                <button
                  onClick={exportToCSV}
                  style={{
                    background: "rgba(59,130,246,0.12)",
                    border: "1px solid rgba(59,130,246,0.3)",
                    color: "#3B82F6",
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  📄 Baixar CSV
                </button>
                <button
                  onClick={copyToClipboard}
                  style={{
                    background: "rgba(245,158,11,0.12)",
                    border: "1px solid rgba(245,158,11,0.3)",
                    color: "#F59E0B",
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  📋 Copiar Tabela
                </button>
                <button
                  onClick={gerarConsolidadoHTML}
                  style={{
                    background: "rgba(107,114,128,0.12)",
                    border: "1px solid rgba(107,114,128,0.3)",
                    color: t.text,
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  🖨️ Imprimir / PDF
                </button>
              </div>
            </div>

            {/* Spreadsheet Grid Preview Container */}
            <div style={{ flex: 1, overflow: "auto", padding: 24, background: t.surface }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, border: `1px solid ${t.border}` }}>
                <thead>
                  <tr style={{ background: "#B2C3E2", color: "#1E293B" }}>
                    <th style={{ border: `1px solid ${t.border}`, padding: "10px 12px", textAlign: "left", width: "25%", fontWeight: 700 }}>Colaboradores</th>
                    <th style={{ border: `1px solid ${t.border}`, padding: "10px 12px", textAlign: "center", width: "8%", fontWeight: 700 }}>Dias</th>
                    <th style={{ border: `1px solid ${t.border}`, padding: "10px 12px", textAlign: "center", width: "10%", fontWeight: 700 }}>turno</th>
                    <th style={{ border: `1px solid ${t.border}`, padding: "10px 12px", textAlign: "center", width: "10%", fontWeight: 700 }}>Insalub.</th>
                    <th style={{ border: `1px solid ${t.border}`, padding: "10px 12px", textAlign: "left", width: "37%", fontWeight: 700 }}>Obs</th>
                    <th style={{ border: `1px solid ${t.border}`, padding: "10px 12px", textAlign: "center", width: "10%", fontWeight: 700 }}>Alimentação</th>
                  </tr>
                </thead>
                <tbody>
                  {colaboradores
                    .filter(u => u.nome.toLowerCase().includes(buscaSpreadsheet.toLowerCase()))
                    .map(u => {
                      const r = resumosMes[u.id];
                      
                      // 1. turno Calculations
                      const isNoturno = u.jornadaId === "clt_noturno" || (u.jornadaId === "personalizada" && u.jornadaCustom?.entrada && (parseInt(u.jornadaCustom.entrada.split(":")[0]) >= 18 || parseInt(u.jornadaCustom.entrada.split(":")[0]) < 6));
                      let turnoStr = isNoturno ? "Noturno" : "Diurno";
                      if (u.trocaJornadaDia && u.trocaJornadaIdAnterior) {
                        turnoStr = "Misto";
                      }
                      
                      let insStr = u.insalubridade ? `${u.insalubridade}%` : "";
                      if (u.trocaInsalubridadeDia && u.trocaInsalubridadeAnterior !== undefined && u.trocaInsalubridadeAnterior !== null) {
                        insStr = `${u.trocaInsalubridadeAnterior}% / ${u.insalubridade || 0}%`;
                      }

                      if (!r) {
                        return (
                          <tr key={u.id} style={{ borderBottom: `1px solid ${t.border}`, background: t.surface }}>
                            <td style={{ border: `1px solid ${t.border}`, padding: "8px 12px", fontWeight: "bold", color: t.text }}>{u.nome}</td>
                            <td style={{ border: `1px solid ${t.border}`, padding: "8px 12px", textAlign: "center", color: t.textSub }}>-</td>
                            <td style={{ border: `1px solid ${t.border}`, padding: "8px 12px", textAlign: "center", color: t.text }}>{turnoStr}</td>
                            <td style={{ border: `1px solid ${t.border}`, padding: "8px 12px", textAlign: "center", color: t.textSub }}>{insStr || "-"}</td>
                            <td style={{ border: `1px solid ${t.border}`, padding: "8px 12px", color: t.textSub }}>—</td>
                            <td style={{ border: `1px solid ${t.border}`, padding: "8px 12px", textAlign: "center", color: t.textSub }}>-</td>
                          </tr>
                        );
                      }

                      const isAfastada = r.diasAfastamento > 0 && r.diasCartao === 0;
                      const diasValue = r.diasCartao > 0 ? String(r.diasCartao).padStart(2, "0") : "";

                      // 1. Faltas listing
                      const totalDays = new Date(mesAtual.ano, mesAtual.mes + 1, 0).getDate();
                      const diasFaltasArr = [];
                      for (let day = 1; day <= totalDays; day++) {
                        const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
                        if (rDia && rDia.status === "falta") {
                          diasFaltasArr.push(day);
                        }
                      }

                      let faltasObs = "";
                      if (diasFaltasArr.length > 0 && !u.apenasSomarHoras) {
                        if (diasFaltasArr.length === 1) {
                          faltasObs = `Falta dia ${String(diasFaltasArr[0]).padStart(2, "0")}`;
                        } else if (diasFaltasArr.length === 2) {
                          faltasObs = `Falta dias ${String(diasFaltasArr[0]).padStart(2, "0")} e ${String(diasFaltasArr[1]).padStart(2, "0")}`;
                        } else {
                          const firstParts = diasFaltasArr.slice(0, -1).map(d => String(d).padStart(2, "0")).join(", ");
                          const lastPart = String(diasFaltasArr[diasFaltasArr.length - 1]).padStart(2, "0");
                          faltasObs = `Falta dias: ${firstParts} e ${lastPart}`;
                        }
                      }

                      // 2. Night hours grouping
                      let adicObs = "";
                      let totalAdicNoturno = 0;
                      for (let day = 1; day <= totalDays; day++) {
                        const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
                        if (rDia && rDia.adicNoturnoHoras > 0) {
                          totalAdicNoturno += rDia.adicNoturnoHoras;
                        }
                      }
                      if (totalAdicNoturno > 0) {
                        const adicFmt = String(Math.round(totalAdicNoturno * 10) / 10).replace(".", ",");
                        adicObs = `${adicFmt}h de adicional noturno`;
                      }

                      // 3. Vacations
                      let feriasObs = "";
                      if (u.ferias && u.ferias.length > 0) {
                        const currentMonthStart = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-01`;
                        const currentMonthEnd = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}`;
                        const f = u.ferias.find(fv => fv.inicio <= currentMonthEnd && fv.fim >= currentMonthStart);
                        if (f) {
                          const fmtDate = (dStr: string) => {
                            const parts = dStr.split("-");
                            return `${parts[2]}/${parts[1]}`;
                          };
                          feriasObs = `Férias de ${fmtDate(f.inicio)} a ${fmtDate(f.fim)}`;
                        }
                      }

                      // 4. Leaders mark
                      const liderObs = u.lider ? "Líder (138,00)" : "";

                      // 5. Volus recommendation
                      const wantsVolus = (r.diasCartao > 0 && r.diasCartao <= 5) || !!u.forcarVolus;
                      const volusObs = wantsVolus ? "Solicitar Cartão Volus" : "";

                      // 6. Insalubridade transition description
                      let insalubridadeObs = "";
                      if (u.trocaInsalubridadeDia && u.trocaInsalubridadeAnterior !== undefined && u.trocaInsalubridadeAnterior !== null) {
                        const diaTroca = u.trocaInsalubridadeDia;
                        const ant = u.trocaInsalubridadeAnterior;
                        const atual = u.insalubridade || 0;
                        
                        let diasPrimeiroPeriodo = 0;
                        for (let day = 1; day < diaTroca; day++) {
                          const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                          const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
                          if (rDia && (rDia.horasTrabalhadas > 0 || rDia.status === "atestado")) {
                            diasPrimeiroPeriodo++;
                          }
                        }
                        
                        let diasSegundoPeriodo = 0;
                        for (let day = diaTroca; day <= totalDays; day++) {
                          const dayKey = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                          const rDia = calcularDia(u.id, dayKey, users, pontosGlobal, feriados);
                          if (rDia && (rDia.horasTrabalhadas > 0 || rDia.status === "atestado")) {
                            diasSegundoPeriodo++;
                          }
                        }

                        if (diasPrimeiroPeriodo > 0 && diasSegundoPeriodo > 0) {
                          insalubridadeObs = `${ant}% referente a ${String(diasPrimeiroPeriodo).padStart(2, "0")} dias, restante do mês ${atual}%`;
                        } else if (diasPrimeiroPeriodo > 0) {
                          insalubridadeObs = `${ant}% referente a ${String(diasPrimeiroPeriodo).padStart(2, "0")} dias`;
                        } else {
                          insalubridadeObs = `${atual}% referente a ${String(diasSegundoPeriodo).padStart(2, "0")} dias`;
                        }
                      }

                      // 7. Horas Extras
                      let horasExtrasObs = "";
                      if (r.horasExtra > 0) {
                        const hrExtraFmt = String(Math.round(r.horasExtra * 10) / 10).replace(".", ",");
                        horasExtrasObs = `${hrExtraFmt} horas extras 50%`;
                      }

                      const obsParts = [];
                      if (isAfastada) {
                        obsParts.push("Afastada");
                      } else if (u.apenasSomarHoras) {
                        obsParts.push(`${String(Math.round(r.horasTrabalhadas * 10) / 10).replace(".", ",")} horas trabalhadas`);
                      } else {
                        if (feriasObs) obsParts.push(feriasObs);
                        if (faltasObs) obsParts.push(faltasObs);
                        if (adicObs) obsParts.push(adicObs);
                        if (insalubridadeObs) obsParts.push(insalubridadeObs);
                        if (liderObs) obsParts.push(liderObs);
                        if (horasExtrasObs) obsParts.push(horasExtrasObs);
                        if (volusObs) obsParts.push(volusObs);
                      }
                      const obsString = obsParts.join(" / ") || "";

                      let alimentacaoStr = "";
                      if (isAfastada) {
                        alimentacaoStr = "--------------";
                      } else if (isNoturno || u.apenasSomarHoras) {
                        alimentacaoStr = "";
                      } else {
                        alimentacaoStr = diasValue;
                      }

                      const cellDias = isAfastada || u.apenasSomarHoras ? "" : diasValue;
                      const cellInsalub = isAfastada ? "" : insStr;

                      return (
                        <tr key={u.id} style={{ borderBottom: `1px solid ${t.border}`, background: t.surface, transition: "background 0.15s" }}>
                          <td style={{ border: `1px solid ${t.border}`, padding: "8px 12px", fontWeight: "bold", color: t.text }}>{u.nome}</td>
                          <td style={{ border: `1px solid ${t.border}`, padding: "8px 12px", textAlign: "center", color: t.text }}>{cellDias || "-"}</td>
                          <td style={{ border: `1px solid ${t.border}`, padding: "8px 12px", textAlign: "center", color: t.text }}>{isAfastada ? "-" : turnoStr}</td>
                          <td style={{ border: `1px solid ${t.border}`, padding: "8px 12px", textAlign: "center", color: t.text }}>{cellInsalub || "-"}</td>
                          <td style={{ border: `1px solid ${t.border}`, padding: "8px 12px", color: t.text }}>{obsString || "—"}</td>
                          <td style={{ border: `1px solid ${t.border}`, padding: "8px 12px", textAlign: "center", color: t.text, fontWeight: isAfastada ? 500 : "normal" }}>{alimentacaoStr || "-"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", background: t.surfaceAlt, borderTop: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 11, color: t.textSub }}>
                Dica: O formato <strong>Excel (.xls)</strong> exporta a planilha exatamente com a mesma formatação visual e cores.
              </div>
              <button
                onClick={() => setModalSpreadsheet(false)}
                style={{
                  background: t.text,
                  color: t.surface,
                  border: "none",
                  padding: "8px 20px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LOCAL LAUNCH MODAL ───
interface ModalLancamentoProps {
  t: ThemeColors;
  userId: number;
  dayKey: string;
  users: User[];
  pontosGlobal: PontosGlobal;
  jornada: Jornada | null;
  onSalvar: (userId: number, dayKey: string, batidas: any, resumo: string) => void;
  onFechar: () => void;
}

function ModalLancamento({ t, userId, dayKey, users, pontosGlobal, jornada, onSalvar, onFechar }: ModalLancamentoProps) {
  const u = users.find(x => x.id === userId);
  const dataFmt = new Date(dayKey + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const existente = pontosGlobal[userId]?.[dayKey] || [null, null, null, null];
  const J = jornada;

  const [modo, setModo] = useState<"horarios" | "ocorrencia" | "atestado_parcial">(() => {
    const oc = existente.find(b => b?.ocorrencia);
    if (!oc) return "horarios";
    if (oc.ocorrencia === "atestado" && oc.parcial) return "atestado_parcial";
    return "ocorrencia";
  });

  const STEPS = [
    { label: "Entrada", field: "entrada" },
    { label: "Saída Almoço", field: "saidaAlmoco" },
    { label: "Retorno", field: "retornoAlmoco" },
    { label: "Saída", field: "saida" }
  ];

  const [horas, setHoras] = useState<Record<string, string>>(() => {
    const h: Record<string, string> = { entrada: "", saidaAlmoco: "", retornoAlmoco: "", saida: "" };
    existente.forEach((b, i) => {
      if (!b || b.ocorrencia || !b.hora) return;
      const campo = STEPS[i].field;
      h[campo] = new Date(b.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    });
    if (!h.entrada && J?.entrada) h.entrada = J.entrada;
    if (!h.saidaAlmoco && J?.saidaAlmoco) h.saidaAlmoco = J.saidaAlmoco;
    if (!h.retornoAlmoco && J?.retornoAlmoco) h.retornoAlmoco = J.retornoAlmoco;
    if (!h.saida && J?.saida) h.saida = J.saida;
    return h;
  });

  const [semAlmoco, setSemAlmoco] = useState(!J?.saidaAlmoco);

  const OCORRENCIAS = [
    { id: "falta", label: "Falta", emoji: "✗", color: "#EF4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", desc: "Ausência sem justificativa" },
    { id: "atestado", label: "Atestado", emoji: "A", color: "#3B82F6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)", desc: "Dia inteiro coberto por atestado médico" },
    { id: "afastamento", label: "Afastamento", emoji: "AF", color: "#A855F7", bg: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.3)", desc: "Afastamento INSS / acidente" },
    { id: "atraso", label: "Atraso", emoji: "~", color: "#F59E0B", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", desc: "Entrou após o previsto" }
  ];

  const [ocorrencia, setOcorrencia] = useState(() => {
    const oc = existente.find(b => b?.ocorrencia);
    return oc?.ocorrencia || "";
  });

  const [obsOcorrencia, setObsOcorrencia] = useState(() => {
    const oc = existente.find(b => b?.ocorrencia);
    return oc?.obs || "";
  });

  const [atestadoEntrada, setAtestadoEntrada] = useState(J?.entrada || "08:00");
  const [atestadoSaida, setAtestadoSaida] = useState("");
  const [atestadoObs, setAtestadoObs] = useState("");

  const registradoEm = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  function montar() {
    const now = new Date();
    const base = new Date(dayKey + "T00:00:00");

    if (modo === "horarios") {
      const campos = semAlmoco ? ["entrada", "saida"] : ["entrada", "saidaAlmoco", "retornoAlmoco", "saida"];
      const batidas: any[] = [null, null, null, null];
      const fieldToIdx: Record<string, number> = { entrada: 0, saidaAlmoco: 1, retornoAlmoco: 2, saida: 3 };
      const resumoList = [];

      for (const campo of campos) {
        const val = horas[campo];
        if (!val) continue;
        const [hh, mm] = val.split(":").map(Number);
        const d = new Date(base);
        d.setHours(hh, mm, 0, 0);
        batidas[fieldToIdx[campo]] = { hora: d.toISOString(), tipo: "manual", registradoEm: now.toISOString(), lancadoPorAdm: true };
        resumoList.push(STEPS[fieldToIdx[campo]].label + " " + val);
      }
      return { batidas, resumo: resumoList.join(" · ") };
    }

    if (modo === "ocorrencia") {
      const oc = OCORRENCIAS.find(o => o.id === ocorrencia);
      const batidas = [{ ocorrencia, obs: obsOcorrencia, registradoEm: now.toISOString(), lancadoPorAdm: true }, null, null, null];
      return { batidas, resumo: `Ocorrência: ${oc?.label || ocorrencia}${obsOcorrencia ? " · " + obsOcorrencia : ""}` };
    }

    const [hh1, mm1] = atestadoEntrada.split(":").map(Number);
    const dEntrada = new Date(base);
    dEntrada.setHours(hh1, mm1, 0, 0);
    const batidas: any[] = [null, null, null, null];
    batidas[0] = { hora: dEntrada.toISOString(), tipo: "manual", registradoEm: now.toISOString(), lancadoPorAdm: true };

    if (atestadoSaida) {
      const [hh2, mm2] = atestadoSaida.split(":").map(Number);
      const dSaida = new Date(base);
      dSaida.setHours(hh2, mm2, 0, 0);
      batidas[3] = { hora: dSaida.toISOString(), tipo: "manual", cobertoPorAtestado: true, registradoEm: now.toISOString(), lancadoPorAdm: true };
    }
    batidas[1] = { ocorrencia: "atestado", parcial: true, obs: atestadoObs, registradoEm: now.toISOString(), lancadoPorAdm: true };
    return { batidas, resumo: `Atestado parcial · Entrada ${atestadoEntrada}${atestadoSaida ? " · Saída " + atestadoSaida + " (coberta)" : ""}` };
  }

  function confirmar() {
    const { batidas, resumo } = montar();
    onSalvar(userId, dayKey, batidas, resumo);
  }

  const canConfirm = modo === "horarios" ? horas.entrada || horas.saida : modo === "ocorrencia" ? ! !ocorrencia : ! !atestadoEntrada;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 600,
        padding: 20
      }}
      onClick={onFechar}
    >
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 20, width: "100%", maxWidth: 480, boxShadow: t.shadow, maxHeight: "92vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "24px 28px 16px", borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <h3 style={{ margin: "0 0 3px", color: t.text, fontSize: 17, fontWeight: 700 }}>Lançar ponto</h3>
              <div style={{ fontSize: 13, color: t.textSub, textTransform: "capitalize" }}>
                {u?.nome} · {dataFmt}
              </div>
            </div>
            <button onClick={onFechar} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: t.textMuted }}>
              ✕
            </button>
          </div>
          <div style={{ marginTop: 10, background: "rgba(245,158,11,0.09)", border: "1px solid rgba(245,158,11,0.28)", borderRadius: 8, padding: "7px 11px", fontSize: 12, color: "#F59E0B" }}>
            ⚠️ Lançamento retroativo — será registrado na auditoria atual ({registradoEm}).
          </div>
          {existente.some(b => b && (b.latitude || b.longitude)) && (
            <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 8 }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#16a34a", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
                📍 Coordenadas de GPS Registradas (Auditoria):
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {existente.map((b, idx) => {
                  if (!b || (!b.latitude && !b.longitude)) return null;
                  return (
                    <div key={idx} style={{ fontSize: "10.5px", color: t.textSub, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>• <strong>{STEPS[idx].label}:</strong> {new Date(b.hora!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span style={{ fontFamily: "monospace", color: t.textSub, background: t.surface, padding: "1px 4px", borderRadius: 4, border: `1px solid ${t.border}` }}>
                        Lat: {b.latitude?.toFixed(5)}, Long: {b.longitude?.toFixed(5)} ({b.tipo === "auto" ? "Automático" : "Manual"})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, padding: "16px 28px 0" }}>
          {[
            { id: "horarios", label: "Horários", icon: "🕐" },
            { id: "ocorrencia", label: "Ocorrência", icon: "📋" },
            { id: "atestado_parcial", label: "Atestado parcial", icon: "🏥" }
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setModo(m.id as any)}
              style={{
                flex: 1,
                padding: "9px 6px",
                borderRadius: 10,
                border: `1.5px solid ${modo === m.id ? t.accent : t.border}`,
                background: modo === m.id ? t.accentGlow : t.surfaceAlt,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "12.5px",
                fontWeight: 600,
                color: modo === m.id ? t.accent : t.textSub,
                transition: "all 0.15s",
                textAlign: "center"
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 3 }}>{m.icon}</div>
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ padding: "20px 28px 24px" }}>
          {modo === "horarios" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.textSub }}>Informe os horários do dia</span>
                <button
                  onClick={() => setSemAlmoco(v => !v)}
                  style={{
                    background: semAlmoco ? t.accentGlow : t.surfaceAlt,
                    border: `1px solid ${semAlmoco ? t.accent : t.border}`,
                    borderRadius: 7,
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 600,
                    color: semAlmoco ? t.accent : t.textSub
                  }}
                >
                  {semAlmoco ? "✓ Sem almoço" : "Tem intervalo"}
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: semAlmoco ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10 }}>
                {STEPS.filter((_, i) => (semAlmoco ? i === 0 || i === 3 : true)).map(({ label, field }) => (
                  <div key={field}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 5, textTransform: "uppercase" }}>{label}</label>
                    <input
                      type="time"
                      value={horas[field] || ""}
                      onChange={e => setHoras(p => ({ ...p, [field]: e.target.value }))}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        background: t.inputBg,
                        border: `1.5px solid ${t.border}`,
                        borderRadius: 8,
                        color: t.text,
                        fontSize: 15,
                        fontWeight: 700,
                        padding: "9px 8px",
                        outline: "none",
                        fontFamily: "monospace",
                        textAlign: "center"
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {modo === "ocorrencia" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 12 }}>Selecione o tipo de ocorrência</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {OCORRENCIAS.map(oc => (
                  <button
                    key={oc.id}
                    onClick={() => setOcorrencia(oc.id)}
                    style={{
                      background: ocorrencia === oc.id ? oc.bg : t.surfaceAlt,
                      border: `1.5px solid ${ocorrencia === oc.id ? oc.border : t.border}`,
                      borderRadius: 10,
                      padding: "11px 14px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                      transition: "all 0.15s",
                      display: "flex",
                      alignItems: "center",
                      gap: 10
                    }}
                  >
                    <span style={{ width: 28, height: 28, borderRadius: "50%", background: ocorrencia === oc.id ? oc.bg : t.surfaceAlt, border: `1.5px solid ${oc.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: oc.color, flexShrink: 0 }}>
                      {oc.emoji}
                    </span>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: ocorrencia === oc.id ? oc.color : t.text }}>{oc.label}</div>
                      <div style={{ fontSize: 11.5, color: t.textMuted }}>{oc.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              {ocorrencia && (
                <div>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: t.textSub, marginBottom: 6, textTransform: "uppercase" }}>Observação</label>
                  <textarea
                    value={obsOcorrencia}
                    onChange={e => setObsOcorrencia(e.target.value)}
                    placeholder="Ex: CID, justificativas..."
                    rows={2}
                    style={{ width: "100%", boxSizing: "border-box", background: t.inputBg, border: `1.5px solid ${t.border}`, borderRadius: 9, color: t.text, fontSize: "13.5px", padding: "9px 12px", outline: "none", fontFamily: "inherit", resize: "none" }}
                  />
                </div>
              )}
            </div>
          )}

          {modo === "atestado_parcial" && (
            <div>
              <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 9, padding: "10px 13px", marginBottom: 16, fontSize: "12.5px", color: "#3B82F6", lineHeight: 1.5 }}>
                🏥 Forneça o horário em que trabalhou e o restante do expediente coberto por atestado médico.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 5 }}>Entrada normal</label>
                  <input
                    type="time"
                    value={atestadoEntrada}
                    onChange={e => setAtestadoEntrada(e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", background: t.inputBg, border: `1.5px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 15, fontWeight: 700, padding: "9px 8px", outline: "none", fontFamily: "monospace", textAlign: "center" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 5 }}>Saída antecipada</label>
                  <input
                    type="time"
                    value={atestadoSaida}
                    onChange={e => setAtestadoSaida(e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", background: t.inputBg, border: `1.5px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 15, fontWeight: 700, padding: "9px 8px", outline: "none", fontFamily: "monospace", textAlign: "center" }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: t.textSub, marginBottom: 6, textTransform: "uppercase" }}>Observações</label>
                <textarea
                  value={atestadoObs}
                  onChange={e => setAtestadoObs(e.target.value)}
                  placeholder="Ex: CID, especificações do médico..."
                  rows={2}
                  style={{ width: "100%", boxSizing: "border-box", background: t.inputBg, border: `1.5px solid ${t.border}`, borderRadius: 9, color: t.text, fontSize: "13.5px", padding: "9px 12px", outline: "none", fontFamily: "inherit", resize: "none" }}
                />
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={onFechar} style={{ flex: 1, background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 10, padding: "11px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 14, color: t.textSub }}>
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={!canConfirm}
              style={{
                flex: 2,
                background: canConfirm ? `linear-gradient(135deg,${t.accent},#2040CC)` : t.surfaceAlt,
                border: "none",
                borderRadius: 10,
                padding: "11px",
                cursor: canConfirm ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                fontWeight: 700,
                fontSize: 14,
                color: canConfirm ? "#fff" : t.textMuted,
                boxShadow: canConfirm ? `0 4px 18px ${t.accentGlow}` : "none",
                transition: "all 0.2s"
              }}
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
