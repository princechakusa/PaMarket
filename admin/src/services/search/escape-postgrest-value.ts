// PostgREST's .or()/.filter() string syntax treats `,`, `(`, `)`, and `.` as
// clause/operator delimiters -- a raw admin search term containing any of
// them (e.g. "ABC (Pvt) Ltd", or a name with a comma) corrupts the filter
// expression it's interpolated into, rather than being matched literally.
// PostgREST's own fix for this is to wrap the value in double quotes,
// backslash-escaping any literal backslash/double-quote first. Callers pass
// the full value they want matched (including any `%...%` ilike wildcards)
// -- this only quotes/escapes it, it doesn't add the wildcards itself.
export function escapePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
