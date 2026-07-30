import { useEffect, useState } from "react";
import { Bug, Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import type { ClientErrorRow } from "../lib/types";
import { Card } from "./Card";

// Heuristic, pattern-matched explanation of common client error signatures -
// not a real classifier, just enough context that a non-developer glancing
// at the dashboard can tell "network hiccup" from "real bug" without pasting
// the message into a search engine.
function explain(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("network request failed")) {
    return "כשל בחיבור לרשת - כנראה שלמשתמש לא היה אינטרנט זמין, או שהשרת לא הגיב, ברגע הפעולה.";
  }
  if (m.includes("notallowederror") || (m.includes("permission") && m.includes("denied"))) {
    return "המשתמש דחה הרשאה (מצלמה, מיקרופון או מיקום) - לא באג בקוד, אלא בחירה של המשתמש במכשיר.";
  }
  if (m.includes("notfounderror")) {
    return "המכשיר לא נמצא (למשל אין מיקרופון/מצלמה זמינים בהתקן הזה).";
  }
  if (m.includes("quotaexceedederror") || m.includes("quota")) {
    return "אחסון מקומי מלא במכשיר של המשתמש.";
  }
  if (m.includes("cannot read propert") && (m.includes("null") || m.includes("undefined"))) {
    return "ניסיון להשתמש בנתון שעדיין לא נטען (null/undefined) - כנראה קוד שרץ לפני שהמידע הגיע מהשרת. כדאי לבדוק את הפרטים המלאים למטה.";
  }
  if (m.includes("json") && (m.includes("parse") || m.includes("unexpected token"))) {
    return "תגובה לא תקינה התקבלה מהשרת (לא JSON תקין) - יכול לקרות אם הבקשה נכשלה בדרך לא צפויה.";
  }
  if (m.includes("timeout") || m.includes("timed out")) {
    return "הבקשה ארכה יותר מדי זמן וזמן ההמתנה פג.";
  }
  if (m.includes("rate limit") || m.includes("429")) {
    return "חריגה ממכסת קריאות לשירות חיצוני (למשל Nominatim או Supabase) - זמני, אמור להיפתר מעצמו.";
  }
  return "שגיאה לא מסווגת - כדאי לבדוק את ההודעה וה-stack המלאים למטה כדי להבין את הגורם.";
}

export default function ErrorLogsPanel() {
  const [errors, setErrors] = useState<ClientErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyError = async (e: ClientErrorRow, evt: React.MouseEvent) => {
    evt.stopPropagation();
    const text = [
      `זמן: ${new Date(e.created_at).toLocaleString("he-IL")}`,
      e.app_version ? `גרסה: ${e.app_version}` : null,
      e.platform ? `פלטפורמה: ${e.platform}` : null,
      `הודעה: ${e.message}`,
      e.stack ? `Stack:\n${e.stack}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(e.id);
      setTimeout(() => setCopiedId((cur) => (cur === e.id ? null : cur)), 1800);
    } catch {
      // clipboard permission denied - nothing else to fall back to here
    }
  };

  useEffect(() => {
    supabase
      .from("client_error_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setErrors((data as ClientErrorRow[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <Card title={`שגיאות אחרונות (${errors.length})`} icon={<Bug size={16} className="text-red-400" />}>
      {loading ? (
        <p className="text-xs text-neutral-500 text-center py-4">טוען...</p>
      ) : errors.length === 0 ? (
        <p className="text-xs text-neutral-500 text-center py-4">אין שגיאות מתועדות - מצוין</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {errors.map((e) => {
            const expanded = expandedId === e.id;
            return (
              <div key={e.id} className="rounded-xl bg-bg-panel border border-red-500/20 text-xs overflow-hidden">
                <button onClick={() => setExpandedId(expanded ? null : e.id)} className="w-full text-right px-3 py-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-red-300 font-semibold truncate flex-1">{e.message}</span>
                    <span className="text-[10px] text-neutral-500 shrink-0 ms-2">{new Date(e.created_at).toLocaleString("he-IL")}</span>
                    <span
                      role="button"
                      onClick={(evt) => copyError(e, evt)}
                      className="shrink-0 ms-1.5 w-5 h-5 rounded-md bg-bg-panel2 border border-bg-border flex items-center justify-center active:scale-95 transition"
                      title="העתקת השגיאה"
                    >
                      {copiedId === e.id ? <Check size={10} className="text-green-400" /> : <Copy size={10} className="text-neutral-400" />}
                    </span>
                    {expanded ? (
                      <ChevronUp size={13} className="text-neutral-500 shrink-0 ms-1.5" />
                    ) : (
                      <ChevronDown size={13} className="text-neutral-500 shrink-0 ms-1.5" />
                    )}
                  </div>
                  <div className="text-[10px] text-neutral-500 text-right">
                    {e.app_version ? `v${e.app_version}` : ""} {e.platform ? `· ${e.platform}` : ""}
                  </div>
                </button>
                {expanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-bg-border">
                    <div className="mb-2 px-2.5 py-2 rounded-lg bg-brand/10 border border-brand/30 text-neutral-200 leading-relaxed">
                      {explain(e.message)}
                    </div>
                    <div className="text-[10px] text-neutral-500 mb-1">הודעת שגיאה מלאה:</div>
                    <div className="text-neutral-300 whitespace-pre-wrap break-all mb-2 font-mono text-[11px]">{e.message}</div>
                    {e.stack && (
                      <>
                        <div className="text-[10px] text-neutral-500 mb-1">Stack trace:</div>
                        <div className="text-neutral-500 whitespace-pre-wrap break-all font-mono text-[10px] max-h-40 overflow-y-auto">
                          {e.stack}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
