import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { ThemeColors } from "../types";

export interface PaginacaoProps {
  totalItems: number;
  itemsPerPage?: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  t?: ThemeColors;
}

export function Paginacao({
  totalItems,
  itemsPerPage = 10,
  currentPage,
  onPageChange,
  t
}: PaginacaoProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Do not render pagination if items fit on a single page
  if (totalItems <= itemsPerPage || totalPages <= 1) {
    return null;
  }

  const from = (currentPage - 1) * itemsPerPage + 1;
  const to = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate range of page numbers to show (max 5 page numbers)
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = startPage + maxButtons - 1;

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  const pages: number[] = [];
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  // Theme defaults if t is not fully passed
  const surfaceAlt = t?.surfaceAlt || "#1f293d";
  const surface = t?.surface || "#111827";
  const border = t?.border || "rgba(255,255,255,0.1)";
  const textSub = t?.textSub || "#9ca3af";
  const text = t?.text || "#f3f4f6";
  const accent = t?.accent || "#3b82f6";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        padding: "14px 18px",
        background: surfaceAlt,
        borderTop: `1px solid ${border}`,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        marginTop: 0
      }}
    >
      {/* Informative text */}
      <span style={{ fontSize: "12.5px", fontWeight: 500, color: textSub }}>
        Mostrando <strong style={{ color: text }}>{from}-{to}</strong> de <strong style={{ color: text }}>{totalItems}</strong> registros
      </span>

      {/* Pagination controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
        {/* Primeira */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="Primeira Página"
          style={{
            background: surface,
            border: `1px solid ${border}`,
            color: currentPage === 1 ? "rgba(156,163,175,0.4)" : text,
            borderRadius: 7,
            padding: "5px 8px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 2,
            opacity: currentPage === 1 ? 0.5 : 1,
            transition: "all 0.15s"
          }}
        >
          <ChevronsLeft size={14} />
          <span className="hidden-mobile">Primeira</span>
        </button>

        {/* Anterior */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title="Página Anterior"
          style={{
            background: surface,
            border: `1px solid ${border}`,
            color: currentPage === 1 ? "rgba(156,163,175,0.4)" : text,
            borderRadius: 7,
            padding: "5px 8px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 2,
            opacity: currentPage === 1 ? 0.5 : 1,
            transition: "all 0.15s"
          }}
        >
          <ChevronLeft size={14} />
          <span className="hidden-mobile">Anterior</span>
        </button>

        {/* Numbered page buttons */}
        {pages.map((p) => {
          const isActive = p === currentPage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              style={{
                background: isActive ? accent : surface,
                color: isActive ? "#ffffff" : text,
                border: `1px solid ${isActive ? accent : border}`,
                borderRadius: 7,
                minWidth: 30,
                height: 30,
                padding: "0 6px",
                fontSize: "12.5px",
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s"
              }}
            >
              {p}
            </button>
          );
        })}

        {/* Próxima */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Próxima Página"
          style={{
            background: surface,
            border: `1px solid ${border}`,
            color: currentPage === totalPages ? "rgba(156,163,175,0.4)" : text,
            borderRadius: 7,
            padding: "5px 8px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 2,
            opacity: currentPage === totalPages ? 0.5 : 1,
            transition: "all 0.15s"
          }}
        >
          <span className="hidden-mobile">Próxima</span>
          <ChevronRight size={14} />
        </button>

        {/* Última */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          title="Última Página"
          style={{
            background: surface,
            border: `1px solid ${border}`,
            color: currentPage === totalPages ? "rgba(156,163,175,0.4)" : text,
            borderRadius: 7,
            padding: "5px 8px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 2,
            opacity: currentPage === totalPages ? 0.5 : 1,
            transition: "all 0.15s"
          }}
        >
          <span className="hidden-mobile">Última</span>
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}
