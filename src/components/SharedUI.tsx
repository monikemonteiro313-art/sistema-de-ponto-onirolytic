import React, { useState, HTMLAttributes } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
import { ThemeColors } from "../types";

export interface BtnProps extends Omit<HTMLAttributes<HTMLButtonElement>, "onClick"> {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "success" | "warning" | "gold";
  t: ThemeColors;
  disabled?: boolean;
  small?: boolean;
}

export function Btn({ children, onClick, variant = "primary", t, disabled, style = {}, small, ...rest }: BtnProps) {
  const base: React.CSSProperties = {
    border: "none",
    borderRadius: small ? 7 : 10,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "all 0.18s",
    fontSize: small ? 12.5 : 14,
    padding: small ? "6px 12px" : "11px 18px",
    opacity: disabled ? 0.5 : 1,
    ...style
  };

  const variants = {
    primary: {
      background: `linear-gradient(135deg, ${t.accent}, #2346C0)`,
      color: "#fff",
      boxShadow: `0 4px 18px ${t.accentGlow}`
    },
    ghost: {
      background: t.surfaceAlt,
      color: t.textSub,
      border: `1.5px solid ${t.border}`
    },
    danger: {
      background: t.dangerBg,
      color: t.danger,
      border: `1.5px solid ${t.dangerBorder}`
    },
    success: {
      background: t.successBg,
      color: t.success,
      border: `1.5px solid ${t.successBorder}`
    },
    warning: {
      background: t.warningBg,
      color: t.warning,
      border: `1.5px solid ${t.warningBorder}`
    },
    gold: {
      background: t.goldBg,
      color: t.gold,
      border: `1.5px solid ${t.goldBorder}`
    }
  };

  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...variants[variant] }}
      {...rest}
    >
      {children}
    </button>
  );
}

interface TagProps {
  label: string;
  color: string;
  bg: string;
  border?: string;
}

export function Tag({ label, color, bg, border }: TagProps) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.4px",
        color,
        background: bg,
        border: `1.5px solid ${border || "transparent"}`,
        borderRadius: 99,
        padding: "2px 9px",
        textTransform: "uppercase",
        whiteSpace: "nowrap"
      }}
    >
      {label}
    </span>
  );
}

interface PwInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  t: ThemeColors;
  style?: React.CSSProperties;
}

export function PwInput({ value, onChange, placeholder, t, style = {} }: PwInputProps) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: t.inputBg,
          border: `1.5px solid ${focused ? t.borderFocus : t.border}`,
          borderRadius: 9,
          color: t.text,
          fontSize: 14,
          padding: "11px 40px 11px 13px",
          outline: "none",
          fontFamily: "inherit",
          boxShadow: focused ? `0 0 0 3px ${t.accentGlow}` : "none",
          transition: "border 0.2s, box-shadow 0.2s",
          ...style
        }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        style={{
          position: "absolute",
          right: 11,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 2,
          display: "flex"
        }}
      >
        {show ? <EyeOff size={17} color={t.textMuted} /> : <Eye size={17} color={t.textMuted} />}
      </button>
    </div>
  );
}

interface PwChecksProps {
  pw: string;
  t: ThemeColors;
  isAdmin?: boolean;
}

export function PwChecks({ pw, t, isAdmin = true }: PwChecksProps) {
  const checks: [RegExp, string][] = isAdmin
    ? [
        [/[a-z]/, "minúscula"],
        [/[A-Z]/, "maiúscula"],
        [/[0-9]/, "número"],
        [/[^a-zA-Z0-9]/, "especial"],
        [/.{8,}/, "mín. 8 car."]
      ]
    : [
        [/[a-zA-Z]/, "letra"],
        [/[0-9]/, "número"],
        [/.{8,}/, "mín. 8"]
      ];

  if (!pw) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 6px", marginTop: 7 }}>
      {checks.map(([rx, label]) => {
        const ok = rx.test(pw);
        return (
          <span
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: ok ? t.success : t.textMuted,
              background: ok ? t.successBg : t.surfaceAlt,
              border: `1.5px solid ${ok ? t.successBorder : t.border}`,
              borderRadius: 99,
              padding: "2px 8px",
              transition: "all 0.2s"
            }}
          >
            {ok ? (
              <Check size={10} color={t.success} />
            ) : (
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  border: `1.5px solid ${t.textMuted}`,
                  display: "inline-block"
                }}
              />
            )}
            {label}
          </span>
        );
      })}
    </div>
  );
}
