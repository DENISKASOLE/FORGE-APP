export function modalBackdrop() {
  return { animation: "fx-scrim .2s ease both", position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
}
