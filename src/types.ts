export interface Jornada {
  id: string;
  nome: string;
  entrada: string | null;
  saidaAlmoco: string | null;
  retornoAlmoco: string | null;
  saida: string | null;
  diasSemana: number[];
  horasDia: number;
  descricao: string;
}

export interface PeriodoFerias {
  inicio: string; // YYYY-MM-DD
  fim: string; // YYYY-MM-DD
}

export interface User {
  id: number;
  matricula: string;
  nome: string;
  tipo: "colaborador" | "adm-dev";
  senha: string | null;
  primeiroAcesso?: boolean;
  bloqueado: boolean;
  bloqueadoAceite?: boolean; // Novo campo para bloquear por recusa de folha
  desativado: boolean;
  perm_trocar_senha_adm: boolean;
  perm_trocar_senha?: boolean;
  perm_bloquear?: boolean;
  perm_excluir?: boolean;
  perm_editar_calendario?: boolean;
  perm_gestao_folhas?: boolean;
  termoAceito: boolean;
  termoAceitoEm: string | null;
  jornadaId: string | null;
  jornadaCustom: Jornada | null;
  insalubridade?: 0 | 20 | 40;
  criadoEm: string;
  desativadoEm?: string | null;
  desativadoPor?: string | null;
  ferias?: PeriodoFerias[];
  forcarVolus?: boolean;
  lider?: boolean;
  trocaJornadaDia?: number | null;
  trocaJornadaIdAnterior?: string | null;
  trocaInsalubridadeDia?: number | null;
  trocaInsalubridadeAnterior?: 0 | 20 | 40 | null;
  autorizarHoraExtra?: boolean;
  apenasSomarHoras?: boolean;
  direitoAlimentacao?: boolean;
}

export interface Batida {
  hora?: string;
  tipo?: "auto" | "manual";
  registradoEm?: string;
  serverTime?: any;
  lancadoPorAdm?: boolean;
  ocorrencia?: string;
  obs?: string;
  parcial?: boolean;
  cobertoPorAtestado?: boolean;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  consentimentoGeoloc?: boolean;
  pendenteJustificativa?: boolean;
  suspeitoHoraModificada?: boolean;
  duplicadoOculto?: boolean;
  dispositivoLocalHora?: string;
  gravadoOffline?: boolean;
  offlineAudited?: boolean;
  cid?: string;
  fotoAtestado?: string;
}

export type DiaPontos = (Batida | null)[];

export interface PontosGlobal {
  [userId: number]: {
    [dayKey: string]: DiaPontos;
  };
}

export interface AuditLogEntry {
  id: number;
  quando: string;
  quem: string;
  quemMat: string;
  acao: string;
  alvo: string;
  detalhe?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

export interface EmpresaConfig {
  nome: string;
  cnpj: string;
}

export interface PrePonto {
  id: string;
  userId: number;
  userName: string;
  matricula: string;
  dayKey: string;
  idx: number;
  tipo: "auto" | "manual";
  quando: string;
  status: "pendente" | "sucesso" | "cancelado";
  atualizadoEm?: string;
}

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceHover: string;
  border: string;
  borderFocus: string;
  text: string;
  textSub: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentGlow: string;
  danger: string;
  dangerBg: string;
  dangerBorder: string;
  warning: string;
  warningBg: string;
  warningBorder: string;
  success: string;
  successBg: string;
  successBorder: string;
  inputBg: string;
  shadow: string;
  blockedBg: string;
  gold: string;
  goldBg: string;
  goldBorder: string;
}

export interface Theme {
  dark: ThemeColors;
  light: ThemeColors;
}

export interface FolhaAceite {
  id: string; // "userId_ano_mes" ou aleatório
  userId: number;
  userName: string;
  matricula: string;
  mes: number; // 0-11
  ano: number;
  status: "pendente" | "aceito" | "recusado" | "retificado";
  horasTrabalhadas: number;
  horasExtra: number;
  horasAdicionalNoturno: number;
  faltas: number;
  atrasos: number;
  insalubridadeTexto: string; // Ex: "Recebe 20% insalubridade" ou histórico se aplicável
  motivoRecusa?: string; // obrigatório quando status é "recusado"
  textoAceite?: string; // o textinho formal de aceite preenchido
  enviadoEm: string; // data ISO
  respondidoEm?: string; // data ISO
}

