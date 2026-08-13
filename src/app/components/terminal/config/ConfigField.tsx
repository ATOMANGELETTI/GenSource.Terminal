import type { ReactNode } from "react";

interface ConfigFieldProps {
  label: string;
  htmlFor: string;
  children: ReactNode;
}

export default function ConfigField({
  label,
  htmlFor,
  children,
}: ConfigFieldProps) {
  return (
    <div className="config-form__row">
      <label className="config-form__label" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="config-form__field">{children}</div>
    </div>
  );
}
