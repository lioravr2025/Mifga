import type { ReactNode } from "react";

export function Card({ title, icon, action, children }: { title?: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-bg-panel2 border border-bg-border p-4">
      {title && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-sm font-bold text-neutral-100">{title}</h2>
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatCard({ label, value, icon, accent }: { label: string; value: string | number; icon: ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl bg-bg-panel2 border border-bg-border p-4 flex items-center gap-3">
      <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: `${accent ?? "#7c3aed"}22` }}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-xl font-extrabold text-neutral-50 tabular-nums">{value}</div>
        <div className="text-[11px] text-neutral-400 truncate">{label}</div>
      </div>
    </div>
  );
}
