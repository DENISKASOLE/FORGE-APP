// Tiny parameterised-SQL builder. A Frag is SQL text plus its positional
// `?` parameters in textual order; composing frags concatenates both, so
// values can never be spliced into the SQL string.

export interface Frag {
  sql: string;
  params: unknown[];
}

const isFrag = (v: unknown): v is Frag =>
  typeof v === "object" && v !== null && "sql" in v && "params" in v && Array.isArray((v as Frag).params);

/** Tagged template: interpolated Frags are inlined, anything else is bound. */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): Frag {
  let text = strings[0];
  const params: unknown[] = [];
  values.forEach((v, i) => {
    if (isFrag(v)) {
      text += v.sql;
      params.push(...v.params);
    } else {
      text += "?";
      params.push(v);
    }
    text += strings[i + 1];
  });
  return { sql: text, params };
}

/** Raw SQL with no parameters. Only ever call with trusted constant text. */
export function raw(text: string): Frag {
  return { sql: text, params: [] };
}

export function join(frags: readonly Frag[], sep: string): Frag {
  return {
    sql: frags.map((f) => f.sql).join(sep),
    params: frags.flatMap((f) => f.params),
  };
}

export const TRUE = raw("1");
export const FALSE = raw("0");

export function and(...frags: Frag[]): Frag {
  const parts = frags.filter((f) => f !== TRUE);
  if (parts.some((f) => f === FALSE)) return FALSE;
  if (!parts.length) return TRUE;
  return parts.length === 1 ? parts[0] : join(parts.map(paren), " AND ");
}

export function or(...frags: Frag[]): Frag {
  const parts = frags.filter((f) => f !== FALSE);
  if (parts.some((f) => f === TRUE)) return TRUE;
  if (!parts.length) return FALSE;
  return parts.length === 1 ? parts[0] : join(parts.map(paren), " OR ");
}

export function paren(f: Frag): Frag {
  return { sql: `(${f.sql})`, params: f.params };
}

/** Quote an identifier that has already been checked against the schema. */
export function ident(name: string): Frag {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Unsafe identifier: ${name}`);
  return raw(`"${name}"`);
}

/** alias."col" for a schema-checked column. */
export function col(alias: string, name: string): Frag {
  if (!/^[a-z][a-z0-9_]*$/.test(alias)) throw new Error(`Unsafe alias: ${alias}`);
  return raw(`${alias}.${ident(name).sql}`);
}
