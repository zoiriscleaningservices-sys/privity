import { forwardRef, ReactNode, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

/** Labelled icon button with a 48px minimum touch target. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    icon: ReactNode;
    onClick?: () => void;
    pressed?: boolean;
    tone?: 'glass' | 'solid' | 'danger' | 'iris' | 'plain';
    size?: 'md' | 'lg';
    disabled?: boolean;
    showLabel?: boolean;
    badge?: number | null;
    id?: string;
    className?: string;
    describedBy?: string;
  }
>(function IconButton(
  { label, icon, onClick, pressed, tone = 'glass', size = 'md', disabled, showLabel, badge, id, className, describedBy },
  ref,
) {
  return (
    <button
      ref={ref}
      id={id}
      type="button"
      className={`plv-icon-btn plv-icon-btn--${tone} plv-icon-btn--${size} ${showLabel ? 'plv-icon-btn--labelled' : ''} ${className ?? ''}`}
      aria-label={showLabel ? undefined : label}
      aria-pressed={pressed}
      aria-describedby={describedBy}
      title={showLabel ? undefined : label}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="plv-icon-btn-glyph" aria-hidden="true">
        {icon}
      </span>
      {showLabel && <span className="plv-icon-btn-text">{label}</span>}
      {badge != null && badge > 0 && (
        <span className="plv-icon-btn-badge" aria-label={`${badge} pending`}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
});

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function useFocusTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const a = items[0];
      const z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    node?.addEventListener('keydown', onKey);
    return () => {
      node?.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);
  return ref;
}

/**
 * Bottom sheet rendered inside the LIVE screen (not the page), so a phone-sized screen in the
 * Lab behaves like the real device. `scrim="light"` keeps the video visible (filters).
 */
export function Sheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  scrim = 'dim',
  size = 'auto',
  id,
  headerAction,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  scrim?: 'dim' | 'light' | 'none';
  size?: 'auto' | 'tall' | 'compact';
  id?: string;
  headerAction?: ReactNode;
}) {
  const ref = useFocusTrap(open, onClose);
  const titleId = useId();
  if (!open) return null;
  return (
    <div className={`plv-sheet-layer plv-sheet-layer--${scrim}`} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        id={id}
        className={`plv-sheet plv-sheet--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="plv-sheet-grip" aria-hidden="true" />
        <header className="plv-sheet-head">
          <div className="plv-sheet-titles">
            <h2 id={titleId} className="plv-sheet-title">
              {title}
            </h2>
            {subtitle && <p className="plv-sheet-subtitle">{subtitle}</p>}
          </div>
          {headerAction}
          <IconButton label="Close" icon={<X size={20} />} onClick={onClose} tone="plain" />
        </header>
        <div className="plv-sheet-body">{children}</div>
        {footer && <footer className="plv-sheet-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'iris';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useFocusTrap(open, onCancel);
  const titleId = useId();
  if (!open) return null;
  return (
    <div className="plv-sheet-layer plv-sheet-layer--dim plv-dialog-layer">
      <div ref={ref} className="plv-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="plv-dialog-title">
          {title}
        </h2>
        <div className="plv-dialog-body">{body}</div>
        <div className="plv-dialog-actions">
          <button type="button" className="plv-btn plv-btn--ghost" onClick={onCancel} data-autofocus>
            {cancelLabel}
          </button>
          <button type="button" className={`plv-btn plv-btn--${tone}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
