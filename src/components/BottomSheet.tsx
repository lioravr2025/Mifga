import type { ReactNode } from "react";

export default function BottomSheet({
  open,
  onClose,
  children,
  maxHeight = "80%",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeight?: string;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-[1000] flex flex-col justify-end">
      <button
        aria-label="סגור"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"
      />
      <div
        className="relative bg-bg-panel rounded-t-3xl border-t border-x border-bg-border shadow-2xl flex flex-col animate-slideUp"
        style={{ maxHeight }}
      >
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-bg-border" />
        </div>
        <div className="overflow-y-auto no-scrollbar px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}
