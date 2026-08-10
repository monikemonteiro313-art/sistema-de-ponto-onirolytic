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
  sabadoEspecial?: boolean;
  sabadoEntrada?: string | null;
  sabadoSaida?: string | null;
  sabadoHoras?: number;
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
  iso?: string;
  tipo?: "auto" | "manual";
  registradoEm?: string;
  editadoEm?: string;
  editadoPor?: string;
  justificativa?: string;
  serverTime?: any;
  lancadoPorAdm?: boolean;
  modificadoPorGestor?: boolean;
  origemMarcacao?: "MA" | "MO" | "NORMAL";
  modificadoPor?: string;
  modificadoPorMatricula?: string;
  alteradoEm?: string;
  justificativaAlteracao?: string;
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
  cidAtestado?: string;
  atestadoGroupId?: string;
  totalDiasAtestado?: number;
  diaSequencia?: number;
  justificativaAtestado?: string;
  horaInicioParcial?: string;
  horaFimParcial?: string;
  statusAtestado?: "pendente" | "aceito" | "recusado";
  motivoRecusaAtestado?: string;
  revisadoEm?: string;
  revisadoPor?: string;
  vistoPeloColaborador?: boolean;
  statusAprovacao?: "pendente" | "aprovado" | "rejeitado" | "recusado";
  motivoRejeicaoAjuste?: string;
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
  userId?: number;
  dayKey?: string;
  slotIdx?: number;
  horaAnterior?: string;
  horaNova?: string;
  tipoModificacao?: "MA" | "MO" | "NORMAL";
  justificativa?: string;
  ip?: string;
  dispositivo?: string;
}

export interface EmpresaConfig {
  nome: string;
  cnpj: string;
  toleranciaMinutos?: number;
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

export interface Alerta {
  id: string;
  destinatarioMatricula: string; // "TODOS" ou matrícula específica
  mensagem: string;
  criadoEm: string;
  criadoPor: string;
  lidoPorMatriculas?: string[];
  ativo?: boolean;
}

export interface Denuncia {
  id: string;
  texto: string;
  fotoUrl?: string | null;
  criadoEm: string;
  status: "pendente" | "em_analise" | "resolvido" | "arquivado";
  respostaAdm?: string | null;
  atualizadoEm?: string | null;
}

export interface SolicitacaoCorrecao {
  id: string;
  userId: number;
  userName: string;
  matricula: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:mm
  slotIdx: number; // 0, 1, 2, 3
  motivo: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  status: "pendente" | "aprovado" | "rejeitado" | "recusado";
  motivoRejeicao?: string | null;
  criadoEm: string;
  revisadoEm?: string | null;
  revisadoPor?: string | null;
}

export interface FolgaRemunerada {
  id: string;
  userIds: number[]; // Lista de IDs de colaboradores selecionados
  aplicarATodosAtivos?: boolean; // Se true, aplica a todos os colaboradores ativos
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  tipo: "completo" | "parcial";
  horaInicio?: string | null; // HH:mm se parcial
  horaFim?: string | null; // HH:mm se parcial
  motivo?: string;
  criadoEm: string;
  criadoPor?: string;
}



