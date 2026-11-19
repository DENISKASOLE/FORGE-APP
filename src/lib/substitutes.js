// Exercise swaps (Nov 2026). The coach picks allowed substitutes per
// exercise in the Exercise Library (`substitutes: [names]` on the library
// item) as the default, and can override it for one client on the program
// exercise itself (`ex.substitutes`). In the client app "Swap exercise"
// offers only those (program list first, else library); the coach app has
// no limit - any library exercise, or a typed name.

const norm = (s) => String(s || "").trim().toLowerCase();

export function substitutesFor(name, library = [], programSubs = null) {
  const own = Array.isArray(programSubs) && programSubs.length ? programSubs : null;
  const item = (library || []).find((it) => norm(it.name) === norm(name));
  return (own || item?.substitutes || []).filter((n) => n && norm(n) !== norm(name));
}

// Options to show under "Swap exercise".
// Client: the coach's substitutes for the ORIGINAL exercise, always listed,
// narrowed by the search box. Coach: every library exercise matching the
// search (nothing until they type), plus whatever they typed.
export function swapOptions({ originalName, library = [], programSubs = null, isCoach, query = "" }) {
  const q = norm(query);
  if (!isCoach) {
    const subs = substitutesFor(originalName, library, programSubs);
    return { options: q ? subs.filter((n) => norm(n).includes(q)) : subs, allowTyped: false, limited: true, total: subs.length };
  }
  if (!q) return { options: [], allowTyped: false, limited: false, total: 0 };
  const names = (library || []).map((it) => it.name).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const options = names.filter((n) => norm(n).includes(q) && norm(n) !== norm(originalName)).slice(0, 12);
  const exact = names.some((n) => norm(n) === q);
  return { options, allowTyped: !exact, limited: false, total: options.length };
}
