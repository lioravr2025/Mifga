// Lucide has no kick-scooter glyph, so this is a small hand-drawn stroke
// icon in the same style (24x24, stroke-based) to match the rest of the UI.
export default function ScooterIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="19" r="2" />
      <circle cx="18" cy="19" r="2" />
      <path d="M7 19h9l-3.2-9H16" />
      <path d="M12.8 10 10 4H7" />
      <path d="M16 4h2.5" />
      <path d="M16 4v6" />
    </svg>
  );
}
