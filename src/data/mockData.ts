import { Jornada, User, PontosGlobal, PeriodoFerias, DiaPontos } from "../types";

export const JORNADAS_PREDEFINIDAS: Jornada[] = [
  {
    id: "seg_sab_8h_4h",
    nome: "Seg a Sáb (8h Seg–Sex + 4h Sáb)",
    entrada: "08:00",
    saidaAlmoco: "12:00",
    retornoAlmoco: "13:00",
    saida: "17:00",
    diasSemana: [1, 2, 3, 4, 5, 6],
    horasDia: 8,
    descricao: "Seg–Sex: 8h/dia · Sáb: 4h (08h–12h) · Total: 44h/sem (Valida por soma de horas)",
    sabadoEspecial: true,
    sabadoEntrada: "08:00",
    sabadoSaida: "12:00",
    sabadoHoras: 4
  },
  {
    id: "seg_sab_8h",
    nome: "Seg a Sáb (8h Seg–Sex + 8h Sáb)",
    entrada: "08:00",
    saidaAlmoco: "12:00",
    retornoAlmoco: "13:00",
    saida: "17:00",
    diasSemana: [1, 2, 3, 4, 5, 6],
    horasDia: 8,
    descricao: "Seg–Sex: 8h/dia · Sáb: 8h (08h–17h) · Total: 48h/sem",
    sabadoEspecial: true,
    sabadoEntrada: "08:00",
    sabadoSaida: "17:00",
    sabadoHoras: 8
  },
  {
    id: "seg_sex_8h",
    nome: "Seg a Sex (8h/dia - 40h/sem)",
    entrada: "08:00",
    saidaAlmoco: "12:00",
    retornoAlmoco: "13:00",
    saida: "17:00",
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 8,
    descricao: "Seg–Sex: 8h/dia · Sábados e Domingos Folga · Total: 40h/sem"
  },
  {
    id: "seg_sex_compensatoria",
    nome: "Seg a Sex Compensatória 44h (Sem Sábado)",
    entrada: "08:00",
    saidaAlmoco: "12:00",
    retornoAlmoco: "13:00",
    saida: "17:48",
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 8.8,
    descricao: "Seg–Sex: 8h48min/dia (1h a mais de Seg–Sex para folgar no Sábado) · Total: 44h/sem"
  },
  {
    id: "seg_sex_6h_sab_4h",
    nome: "Seg a Sex 6h (15min int) + Sáb 4h",
    entrada: "07:00",
    saidaAlmoco: null,
    retornoAlmoco: null,
    saida: "13:15",
    diasSemana: [1, 2, 3, 4, 5, 6],
    horasDia: 6,
    descricao: "Seg–Sex: 6h/dia (15min intervalo) · Sáb: 4h · Total: 34h/sem",
    sabadoEspecial: true,
    sabadoEntrada: "07:00",
    sabadoSaida: "11:00",
    sabadoHoras: 4
  },
  {
    id: "seg_sex_6h",
    nome: "Seg a Sex 6h (15min intervalo)",
    entrada: "07:00",
    saidaAlmoco: null,
    retornoAlmoco: null,
    saida: "13:15",
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 6,
    descricao: "Seg–Sex: 6h/dia (15min de intervalo) · Sábados e Domingos Folga · Total: 30h/sem"
  },
  {
    id: "personalizada",
    nome: "Criar nova jornada",
    entrada: null,
    saidaAlmoco: null,
    retornoAlmoco: null,
    saida: null,
    diasSemana: [],
    horasDia: 0,
    descricao: "Defina nome, horários e dias manualmente"
  }
];

export function getJornada(id: string | null | undefined): Jornada | null {
  if (!id) return JORNADAS_PREDEFINIDAS[0];
  const found = JORNADAS_PREDEFINIDAS.find(j => j.id === id);
  if (found) return found;

  // Fallback seguro de conversão para jornadas legadas:
  if (id === "personalizada") return JORNADAS_PREDEFINIDAS.find(j => j.id === "personalizada") || JORNADAS_PREDEFINIDAS[0];
  if (id.includes("comp") || id.includes("48")) return JORNADAS_PREDEFINIDAS[3]; // compensatoria
  if (id.includes("6h") && (id.includes("sab") || id.includes("34"))) return JORNADAS_PREDEFINIDAS[4];
  if (id.includes("6h")) return JORNADAS_PREDEFINIDAS[5];
  if (id.includes("sab_4h") || id.includes("44") || id.includes("posto") || id.includes("07_16") || id.includes("08_18") || id.includes("07_17")) return JORNADAS_PREDEFINIDAS[0];
  if (id.includes("sab_8h") || id.includes("5x1") || id.includes("6x1") || id.includes("sab")) return JORNADAS_PREDEFINIDAS[1];

  return JORNADAS_PREDEFINIDAS[2];
}

export const SUPERADMIN_MAT = "090909";

export const INITIAL_USERS: User[] = [
  {
    id: 1,
    matricula: SUPERADMIN_MAT,
    nome: "Onirolytic",
    tipo: "adm-dev",
    senha: "Admin@090909",
    primeiroAcesso: true,
    bloqueado: false,
    desativado: false,
    perm_trocar_senha_adm: false,
    termoAceito: false,
    termoAceitoEm: null,
    jornadaId: null,
    jornadaCustom: null,
    criadoEm: "2026-05-01T08:00:00Z"
  }
];

export const SEED_PONTOS: PontosGlobal = {};


