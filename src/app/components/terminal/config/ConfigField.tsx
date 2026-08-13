import type { ReactNode } from "react";

interface ConfigCardProps {
  label?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function ConfigCard({ label, footer, children }: ConfigCardProps) {
  const body = (
    <div className="config-card">
      {children}
      {footer ? <div className="config-card__footer">{footer}</div> : null}
    </div>
  );

  if (!label) {
    return body;
  }

  return (
    <section className="config-card-group">
      <h3 className="config-card__label">{label}</h3>
      {body}
    </section>
  );
}

interface ConfigRowProps {
  label: string;
  hint?: string;
  htmlFor?: string;
  layout?: "inline" | "stack";
  children: ReactNode;
}

export function ConfigRow({
  label,
  hint,
  htmlFor,
  layout = "inline",
  children,
}: ConfigRowProps) {
  const rowClass =
    layout === "stack" ? "config-row config-row--stack" : "config-row";

  return (
    <div className={rowClass}>
      <div className="config-row__meta">
        {htmlFor ? (
          <label className="config-row__label" htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <span className="config-row__label">{label}</span>
        )}
        {hint ? <p className="config-row__hint">{hint}</p> : null}
      </div>
      <div className="config-row__control">{children}</div>
    </div>
  );
}

interface ConfigSwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function ConfigSwitch({
  id,
  checked,
  onChange,
  label,
}: ConfigSwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={checked ? "config-switch config-switch--on" : "config-switch"}
      onClick={() => onChange(!checked)}
    >
      <span className="config-switch__thumb" />
    </button>
  );
}

interface ConfigSegmentedProps {
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  ariaLabel: string;
}

export function ConfigSegmented({
  value,
  options,
  onChange,
  ariaLabel,
}: ConfigSegmentedProps) {
  return (
    <div className="config-segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={
              active
                ? "config-segmented__btn config-segmented__btn--active"
                : "config-segmented__btn"
            }
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
