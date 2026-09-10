type HoneypotFieldProps = { name?: string };

/** Visual placeholder only. Stage B never submits or validates this value. */
export function HoneypotField({ name = 'company_website' }: HoneypotFieldProps) {
  return <div className="honeypot" aria-hidden="true"><label htmlFor={name}>Leave this field empty</label><input id={name} name={name} tabIndex={-1} autoComplete="off" /></div>;
}
