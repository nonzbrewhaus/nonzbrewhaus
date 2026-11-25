"use client";

// "Drop into the basket": a cup flies on an arc from where the drink was added to the basket, then the basket bounces.
// Uses the Web Animations API (no library). Skipped when the visitor prefers reduced motion.

const CUP = (fill: string, foam: boolean) => `
<svg viewBox="0 0 40 48" width="40" height="48" aria-hidden="true">
  <path d="M6 12h28l-4 34H10z" fill="${fill}" stroke="#3A2218" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M4 8h32v5H4z" fill="#F0E4DA" stroke="#3A2218" stroke-width="2.4"/>
  <path d="M22 8l3-7" stroke="#3A2218" stroke-width="2.4" stroke-linecap="round"/>
  ${foam ? '<circle cx="20" cy="22" r="4" fill="#FFF8F4" stroke="#3A2218" stroke-width="1.5"/>' : ""}
</svg>`;

export const BUMP_EVENT = "nz:basket-bump";

export function flyToBasket(from: DOMRect | null, opts: { matcha: boolean; foam: boolean }) {
  const basket = document.getElementById("basket");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!from || !basket || reduce) {
    window.dispatchEvent(new Event(BUMP_EVENT));
    return;
  }
  const to = basket.getBoundingClientRect();
  const cup = document.createElement("div");
  cup.innerHTML = CUP(opts.matcha ? "#9CC08A" : "#8A5A3B", opts.foam);
  Object.assign(cup.style, {
    position: "fixed",
    left: `${from.left + from.width / 2 - 20}px`,
    top: `${from.top + from.height / 2 - 24}px`,
    zIndex: "60",
    pointerEvents: "none",
  });
  document.body.appendChild(cup);

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  cup
    .animate(
      [
        { transform: "translate(0,0) rotate(0) scale(1)" },
        { transform: `translate(${dx * 0.55}px, ${Math.min(dy * 0.35, -40)}px) rotate(-10deg) scale(.9)`, offset: 0.35 },
        { transform: `translate(${dx}px, ${dy}px) rotate(-20deg) scale(.45)`, opacity: 0.9 },
      ],
      { duration: 650, easing: "cubic-bezier(.45,0,.9,.6)" },
    )
    .finished.finally(() => {
      cup.remove();
      window.dispatchEvent(new Event(BUMP_EVENT));
    });
}
