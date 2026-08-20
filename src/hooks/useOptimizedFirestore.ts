import { useState, useEffect, useCallback } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  getCountFromServer,
  Unsubscribe
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { User, AuditLogEntry } from "../types";

/**
 * Hook para escutar as logs de auditoria em tempo real com limit + orderBy
 * com cancelamento correto de listener e array de dependências seguro.
 */
export function useRealtimeAuditLogs(limitCount: number = 20) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const colRef = collection(db, "auditLogs");
    
    // 1. Filtro e Limitação rígida ordenado pelo campo 'quando' (data do evento de auditoria)
    // Se o índice composto para 'quando' falhar, recua graciosamente para limit sem orderBy
    let q;
    try {
      q = query(colRef, orderBy("quando", "desc"), limit(limitCount));
    } catch {
      q = query(colRef, limit(limitCount));
    }

    // 2. Listener em tempo real com suporte a documentos individuais e legados
    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const resultLogs: AuditLogEntry[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (Array.isArray(data.logs)) {
            // Suporte para documentos antigos com logs agregados em array
            for (const l of data.logs) {
              resultLogs.push(l as AuditLogEntry);
            }
          } else {
            // Documento de evento individual de auditoria (melhor prática de escalabilidade)
            resultLogs.push({ id: docSnap.id, ...data } as AuditLogEntry);
          }
        });

        resultLogs.sort((a, b) => new Date(b.quando || 0).getTime() - new Date(a.quando || 0).getTime());
        setLogs(resultLogs.slice(0, limitCount));
        setLoading(false);
      },
      (err) => {
        console.warn("[Firestore Realtime Audit] Listener error:", err);
        setError(err);
        setLoading(false);
      }
    );

    // Cancelamento do listener ao desmontar o componente
    return () => {
      unsubscribe();
    };
  }, [limitCount]); // Dependência primitiva estável

  return { logs, loading, error };
}

/**
 * Hook para escutar a lista de usuários em tempo real com limit + orderBy("nome", "asc")
 */
export function useRealtimeUsers(limitCount: number = 20) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const colRef = collection(db, "users");
    
    // 1. Filtro, Ordenação determinística por Nome e Limitação
    let q;
    try {
      q = query(colRef, orderBy("nome", "asc"), limit(limitCount));
    } catch {
      q = query(colRef, limit(limitCount));
    }

    // 2. Listener com unsubscribe no cleanup
    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const userList: User[] = [];
        snapshot.forEach((docSnap) => {
          userList.push(docSnap.data() as User);
        });
        userList.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
        setUsers(userList);
        setLoading(false);
      },
      (err) => {
        console.warn("[Firestore Realtime Users] Listener error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [limitCount]);

  return { users, loading, error };
}

/**
 * Hook eficiente para obter a contagem total de registros de uma coleção usando getCountFromServer
 */
export function useCollectionCount(collectionName: "users" | "auditLogs") {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      setLoading(true);
      // 3. Uso de getCountFromServer() para consumo mínimo de leituras (1 operação de agregação)
      const colRef = collection(db, collectionName);
      const snapshot = await getCountFromServer(colRef);
      setCount(snapshot.data().count);
      setError(null);
    } catch (err: any) {
      console.warn(`[Firestore Count] Error counting ${collectionName}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [collectionName]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  return { count, loading, error, refreshCount };
}
