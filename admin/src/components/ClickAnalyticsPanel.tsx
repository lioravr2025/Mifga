import { useEffect, useState } from "react";
import { MousePointerClick } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { Card } from "./Card";

const SCREEN_LABELS: Record<string, string> = {
  map: "מסך ראשי",
  route: "מסך מסלול",
  friends: "מסך חברים",
  profile: "מסך פרופיל",
  nav: "תפריט תחתון",
  report: "טופס דיווח מפגע",
};

const NAV_TAB_LABELS: Record<string, string> = { map: "ראשי", route: "מסלול", friends: "חברים", profile: "פרופיל" };

const HAZARD_LABELS: Record<string, string> = {
  police: "שוטר",
  inspector: "פקח",
  pothole: "חור בכביש",
  car: "רכב מפריע",
  sidewalk: "מדרכה משובשת",
  camera: "מצלמה",
  accident: "תאונה",
  roadwork: "עבודות בכביש",
  closure: "כביש חסום",
  flood: "הצפה",
  animal: "בעל חיים בכביש",
};

/** Translates the raw `element` id logged by trackClick() (see src/lib/analytics.ts on the mobile app) into a readable Hebrew description. Falls back to the raw id for anything not recognized, so new buttons don't just disappear. */
function elementLabel(element: string): string {
  if (element === "ride_start") return "כפתור \"תחילת נסיעה\"";
  if (element === "ride_stop") return "כפתור \"הפסקת נסיעה\"";
  if (element === "report_more") return "פתיחת \"עוד\" בדיווח מהיר";
  if (element.startsWith("nav_")) {
    const tab = element.slice(4);
    return `מעבר לטאב "${NAV_TAB_LABELS[tab] ?? tab}"`;
  }
  if (element.startsWith("report_quick_")) {
    const type = element.slice("report_quick_".length);
    return `דיווח מהיר: ${HAZARD_LABELS[type] ?? type}`;
  }
  if (element.startsWith("report_submit_")) {
    const type = element.slice("report_submit_".length);
    return `שליחת דיווח: ${HAZARD_LABELS[type] ?? type}`;
  }
  return element;
}

export default function ClickAnalyticsPanel() {
  const [counts, setCounts] = useState<{ element: string; screen: string | null; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("ui_click_events")
      .select("element, screen")
      .then(({ data }) => {
        const tally: Record<string, { element: string; screen: string | null; count: number }> = {};
        for (const row of (data as { element: string; screen: string | null }[]) ?? []) {
          const key = `${row.element}|${row.screen ?? ""}`;
          tally[key] ??= { element: row.element, screen: row.screen, count: 0 };
          tally[key].count += 1;
        }
        setCounts(
          Object.values(tally)
            .sort((a, b) => b.count - a.count)
            .slice(0, 15)
        );
        setLoading(false);
      });
  }, []);

  const max = counts[0]?.count ?? 1;

  return (
    <Card title="הכפתורים הכי פופולריים" icon={<MousePointerClick size={16} className="text-brand-light" />}>
      {loading ? (
        <p className="text-xs text-neutral-500 text-center py-4">טוען...</p>
      ) : counts.length === 0 ? (
        <p className="text-xs text-neutral-500 text-center py-4">עדיין אין נתוני שימוש</p>
      ) : (
        <div className="space-y-2.5">
          {counts.map((c) => (
            <div key={`${c.element}|${c.screen}`} className="text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-neutral-200 font-medium">
                  {elementLabel(c.element)}
                  {c.screen && <span className="text-neutral-500 font-normal"> · {SCREEN_LABELS[c.screen] ?? c.screen}</span>}
                </span>
                <span className="text-neutral-500 tabular-nums shrink-0 ms-2">{c.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-bg-panel overflow-hidden">
                <div className="h-full bg-brand rounded-full" style={{ width: `${(c.count / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
