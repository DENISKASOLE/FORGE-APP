export function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
