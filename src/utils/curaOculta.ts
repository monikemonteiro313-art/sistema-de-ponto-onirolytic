/**
 * Cura Oculta v3.0 (Passiva — Responsabilidade total de sincronização no Firebase SDK persistentLocalCache)
 * O script de Autocura não manipula, não força envio e não altera documentos no Firestore.
 */

export interface CuraOcultaConfig {
  registerPrePonto?: any;
  onAddLog?: (acao: string, alvo: string, detalhe: string) => void;
  getUserId?: () => number | null;
}

export async function marcarPrePontoResolvidoLocal(punchId: string, motivo: string): Promise<void> {
  console.log(`[Autocura Passiva] Ponto observado: ${punchId} (${motivo})`);
}

export async function executarVarreduraCuraOculta(): Promise<void> {
  console.log("[Autocura Passiva] Sincronização offline tratada pelo Firebase SDK (persistentLocalCache).");
}

export function iniciarCuraOculta(config?: CuraOcultaConfig): () => void {
  console.log("[Autocura Passiva] Monitoramento iniciado.");
  return () => {};
}
