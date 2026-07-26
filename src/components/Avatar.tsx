/** Shows the uploaded photo when present, falling back to the emoji avatar otherwise - used everywhere a friend/user is shown (lists, search results, cards). */
export default function Avatar({
  emoji,
  photoUrl,
  size = 36,
  className = "",
}: {
  emoji: string;
  photoUrl?: string;
  size?: number;
  className?: string;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={`rounded-full bg-bg-panel border border-bg-border flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {emoji}
    </span>
  );
}
