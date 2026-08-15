import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "warn" | "ghost";
  wide?: boolean;
  children: ReactNode;
};

export function Button({ variant = "default", wide, className = "", children, ...rest }: Props) {
  const v =
    variant === "primary"
      ? "btn-primary"
      : variant === "danger"
        ? "btn-danger"
        : variant === "warn"
          ? "btn-warn"
          : variant === "ghost"
            ? "btn-ghost"
            : "";
  return (
    <button className={`btn ${v} ${wide ? "btn-wide" : ""} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}
