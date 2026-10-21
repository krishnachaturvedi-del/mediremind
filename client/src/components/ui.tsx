import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { useState } from "react";
import { X, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { statusMeta } from "../lib/utils";

// ---------------------------------------------------------------- basics

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        {icon && <span className="text-teal-600">{icon}</span>}
        <div>
          <h2 className="text-base font-semibold text-navy-900 sm:text-lg">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-navy-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800 shadow-sm disabled:bg-teal-300",
  secondary:
    "bg-white text-navy-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:text-slate-400",
  ghost: "text-navy-600 hover:bg-slate-100 disabled:text-slate-400",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm disabled:bg-red-300",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:bg-emerald-300",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  loading = false,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4 border-2" />}
      {children}
    </button>
  );
}

export function Spinner({ className = "h-5 w-5 border-2" }: { className?: string }) {
  return (
    <span
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-navy-200 border-t-teal-600 ${className}`}
      role="status"
    />
  );
}

export function Badge({ status, children }: { status: string; children?: ReactNode }) {
  const meta = statusMeta(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${meta.classes}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {children ?? meta.label}
    </span>
  );
}

// ----------------------------------------------------------------- forms

export function Label({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-navy-800">
        {children}
      </label>
      {hint && <span className="text-xs text-navy-400">{hint}</span>}
    </div>
  );
}

const fieldClasses =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-navy-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:bg-slate-50 disabled:text-slate-500";

export function Input({
  invalid = false,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={`${fieldClasses} ${invalid ? "border-red-400 focus:border-red-500 focus:ring-red-500/30" : ""} ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Textarea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldClasses} min-h-24 ${className}`} {...rest} />;
}

export function Select({
  className = "",
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${fieldClasses} ${className}`} {...rest} />;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-sm font-medium text-red-600" role="alert">
      {message}
    </p>
  );
}

export function Checkbox({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={`mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-teal-600 ${className}`}
      {...rest}
    />
  );
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div
      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{error}</span>
    </div>
  );
}

// ---------------------------------------------------------------- layout

export function StatCard({
  label,
  value,
  icon,
  tone = "neutral",
  sub,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
  sub?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-navy-50 text-navy-600",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    danger: "bg-red-50 text-red-600",
    accent: "bg-teal-50 text-teal-700",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-navy-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-navy-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-navy-400">{sub}</p>}
        </div>
        {icon && (
          <span className={`rounded-xl p-2.5 ${tones[tone]}`} aria-hidden>
            {icon}
          </span>
        )}
      </div>
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 rounded-2xl bg-teal-50 p-4 text-teal-600" aria-hidden>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-navy-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-navy-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ----------------------------------------------------------------- modal

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-xl sm:rounded-3xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <h2 className="text-lg font-bold text-navy-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-navy-400 hover:bg-slate-100 hover:text-navy-700"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- toasts

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<{
  push: (message: string, tone?: ToastTone) => void;
} | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: ToastTone = "info") => {
    const id = ++toastId;
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
              t.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : t.tone === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-sky-200 bg-sky-50 text-sky-800"
            }`}
          >
            {t.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : t.tone === "error" ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{t.message}</span>
            <button
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              className="ml-auto shrink-0 opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
