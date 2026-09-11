type HoneypotFieldProps = {
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
};

/**
 * Invisible bot trap — not a password-manager-visible field, not the
 * word "honeypot" anywhere in its name/id/label, removed from keyboard
 * navigation and screen readers. A legitimate operator never sees or
 * fills it in. Callers own what happens when it is filled (see
 * LoginPage: no signInWithPassword() call, one fixed security signal, no
 * honeypot value ever transmitted).
 */
export function HoneypotField({ name = 'company_website', value, onChange }: HoneypotFieldProps) {
  return (
    <div className="honeypot" aria-hidden="true">
      <label htmlFor={name}>Leave this field empty</label>
      <input
        id={name}
        name={name}
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      />
    </div>
  );
}
