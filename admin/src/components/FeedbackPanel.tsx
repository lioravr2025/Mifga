import { MessageSquare, ThumbsDown, ThumbsUp } from "lucide-react";
import type { FeedbackRow, ProfileRow } from "../lib/types";
import { Card } from "./Card";

export default function FeedbackPanel({ feedback, profiles }: { feedback: FeedbackRow[]; profiles: ProfileRow[] }) {
  const nameFor = (uid: string | null) => profiles.find((p) => p.id === uid)?.name ?? "אנונימי";
  const sorted = [...feedback].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
  const likedCount = feedback.filter((f) => f.liked).length;

  return (
    <Card
      title={`פידבק ממשתמשים (${feedback.length})`}
      icon={<MessageSquare size={16} className="text-brand-light" />}
      action={
        <span className="text-[11px] text-neutral-400">
          {likedCount} 👍 · {feedback.length - likedCount} 👎
        </span>
      }
    >
      {sorted.length === 0 ? (
        <p className="text-xs text-neutral-500 text-center py-4">עדיין אין פידבק</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {sorted.map((f) => (
            <div key={f.id} className="px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-neutral-200">{nameFor(f.user_id)}</span>
                <div className="flex items-center gap-2">
                  {f.liked ? <ThumbsUp size={13} className="text-green-400" /> : <ThumbsDown size={13} className="text-red-400" />}
                  <span className="text-[10px] text-neutral-500">{new Date(f.submitted_at).toLocaleDateString("he-IL")}</span>
                </div>
              </div>
              {f.note ? (
                <p className="text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap border-r-2 border-brand/40 pr-2 mt-1.5">{f.note}</p>
              ) : (
                <p className="text-[11px] text-neutral-600 italic mt-1">ללא הערה כתובה</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
