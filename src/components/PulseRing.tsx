/**
 * A pulsing ring meant to sit BEHIND a button as a sibling (parent needs
 * `relative`), not as a class on the button itself - animating scale/opacity
 * on the button directly makes the whole thing (icon, label, everything)
 * flicker in and out, which reads as broken. This stays purely decorative.
 */
export default function PulseRing({ color }: { color: string }) {
  return (
    <span
      className="absolute inset-0 rounded-full animate-pulseRing pointer-events-none"
      style={{ border: `2px solid ${color}` }}
    />
  );
}
