import { Jornada, User, PontosGlobal, PeriodoFerias, DiaPontos } from "../types";

export const JORNADAS_PREDEFINIDAS: Jornada[] = [
  {
    id: "clt_8h",
    nome: "CLT Padrão 8h",
    entrada: "08:00",
    saidaAlmoco: "12:00",
    retornoAlmoco: "13:00",
    saida: "17:00",
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 8,
    descricao: "Seg–Sex · 8h/dia · 44h/semana"
  },
  {
    id: "clt_6h",
    nome: "Jornada 6h",
    entrada: "07:00",
    saidaAlmoco: null,
    retornoAlmoco: null,
    saida: "13:00",
    diasSemana: [1, 2, 3, 4, 5, 6],
    horasDia: 6,
    descricao: "Seg–Sáb · 6h/dia · 36h/semana (sem intervalo obrigatório)"
  },
  {
    id: "clt_12x36",
    nome: "12x36",
    entrada: "07:00",
    saidaAlmoco: "13:00",
    retornoAlmoco: "14:00",
    saida: "19:00",
    diasSemana: [1, 3, 5],
    horasDia: 12,
    descricao: "12h trabalhadas · 36h de descanso (revezamento)"
  },
  {
    id: "clt_noturno",
    nome: "Noturno 8h",
    entrada: "22:00",
    saidaAlmoco: "02:00",
    retornoAlmoco: "03:00",
    saida: "06:00",
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 8,
    descricao: "Seg–Sex · 22h–06h · adicional noturno aplicável"
  },
  {
    id: "clt_tarde",
    nome: "Vespertino 8h",
    entrada: "13:00",
    saidaAlmoco: "17:00",
    retornoAlmoco: "18:00",
    saida: "22:00",
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 8,
    descricao: "Seg–Sex · 13h–22h"
  },
  {
    id: "clt_meio",
    nome: "Meio Período Manhã",
    entrada: "08:00",
    saidaAlmoco: null,
    retornoAlmoco: null,
    saida: "12:00",
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 4,
    descricao: "Seg–Sex · 08h–12h · 4h/dia"
  },
  {
    id: "clt_meio_t",
    nome: "Meio Período Tarde",
    entrada: "13:00",
    saidaAlmoco: null,
    retornoAlmoco: null,
    saida: "17:00",
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 4,
    descricao: "Seg–Sex · 13h–17h · 4h/dia"
  },
  {
    id: "comercial",
    nome: "Comercial 9h",
    entrada: "09:00",
    saidaAlmoco: "12:00",
    retornoAlmoco: "13:00",
    saida: "18:00",
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 8,
    descricao: "Seg–Sex · 09h–18h"
  },
  {
    id: "sabado",
    nome: "Seg–Sáb 7h20",
    entrada: "07:20",
    saidaAlmoco: "11:20",
    retornoAlmoco: "12:00",
    saida: "16:00",
    diasSemana: [1, 2, 3, 4, 5, 6],
    horasDia: 7.33,
    descricao: "Seg–Sáb · 44h/semana distribuídas"
  },
  {
    id: "escala_5x1",
    nome: "Escala 5x1",
    entrada: null,
    saidaAlmoco: null,
    retornoAlmoco: null,
    saida: null,
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 8,
    descricao: "5 dias trabalhados · 1 folga (revezamento) · Sem horário fixo"
  },
  {
    id: "escala_5x2",
    nome: "Escala 5x2",
    entrada: null,
    saidaAlmoco: null,
    retornoAlmoco: null,
    saida: null,
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 8,
    descricao: "Seg–Sex · 2 dias de folga · 40h/semana · Sem horário fixo"
  },
  {
    id: "escala_6x1",
    nome: "Escala 6x1",
    entrada: null,
    saidaAlmoco: null,
    retornoAlmoco: null,
    saida: null,
    diasSemana: [1, 2, 3, 4, 5, 6],
    horasDia: 8,
    descricao: "6 dias trabalhados · 1 folga (revezamento) · Sem horário fixo"
  },
  {
    id: "home_flex",
    nome: "Home Office / Flexível",
    entrada: null,
    saidaAlmoco: null,
    retornoAlmoco: null,
    saida: null,
    diasSemana: [1, 2, 3, 4, 5],
    horasDia: 8,
    descricao: "Sem horário fixo · carga horária diária de referência"
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

export function getJornada(id: string): Jornada | null {
  return JORNADAS_PREDEFINIDAS.find(j => j.id === id) || null;
}

export const SUPERADMIN_MAT = "090909";

export const INITIAL_USERS: User[] = [
  {
    id: 1,
    matricula: SUPERADMIN_MAT,
    nome: "Administrador",
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


