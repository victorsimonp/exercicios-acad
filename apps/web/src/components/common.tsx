import { useEffect, useRef, type ReactNode } from 'react';
import { X, Plus, ArrowUpRight, Dumbbell } from 'lucide-react';
import { Button } from './ui/button';
export const number = (v: number) =>
  v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
export const date = (v: string) =>
  new Date(v).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'short',
  });
export const basisLabel = (basis: string) =>
  basis === 'per_dumbbell'
    ? 'kg/halter'
    : basis === 'per_side'
      ? 'kg/lado'
      : 'kg total';
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Dumbbell size={28} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function ErrorMessage({ error }: { error: Error | null | undefined }) {
  return error ? (
    <p role="alert" className="error">
      {error.message}
    </p>
  ) : null;
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Tab') {
            const items = dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
            );
            const first = items?.[0];
            const last = items?.[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Fechar"
            onClick={onClose}
            autoFocus
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function AddButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button className="primary" onClick={onClick}>
      <Plus size={17} />
      {children}
    </Button>
  );
}
export function ArrowLink() {
  return <ArrowUpRight size={17} />;
}
