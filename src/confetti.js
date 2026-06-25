// Tiny dependency-free confetti burst. Spawns DOM pieces, lets CSS animate
// them, then cleans up. Used when a player nails their tip exactly.
export function burstConfetti() {
  if (typeof document === "undefined") return;

  const colors = ["#ffd166", "#ff6b6b", "#06d6a0", "#4cc9f0", "#f72585"];
  const count = 80;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty("--drift", Math.random() * 240 - 120 + "px");
    piece.style.setProperty("--spin", Math.random() * 1080 - 540 + "deg");
    piece.style.animationDuration = 1.4 + Math.random() * 1 + "s";
    piece.style.animationDelay = Math.random() * 0.25 + "s";
    if (Math.random() > 0.5) piece.style.borderRadius = "50%";
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3000);
  }
}
