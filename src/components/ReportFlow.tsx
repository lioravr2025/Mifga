import { useEffect, useRef, useState } from "react";
import { Camera, Check, ChevronRight, Crosshair, ImagePlus, MapPin, MapPinOff, Tag, X } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { HazardIcon } from "./HazardIcon";
import AddressAutocomplete from "./AddressAutocomplete";
import IsraeliCityAutocomplete from "./IsraeliCityAutocomplete";
import { MORE_HAZARD_TYPES, POINTS_PER_REPORT, POINTS_PER_REPORT_WITH_PHOTO, PRIMARY_HAZARD_TYPES } from "../data/hazardTypes";
import { HAZARD_COLOR_HEX } from "../lib/colors";
import { distanceMeters } from "../lib/geo";
import { submitWaitlistSignup } from "../lib/backend/waitlist";
import { useAppConfig } from "../hooks/useAppConfig";
import type { HazardTypeId, LatLng } from "../types";
import { useApp } from "../context/AppContext";
import { trackClick } from "../lib/analytics";

const NICKNAME_TYPES: HazardTypeId[] = ["police", "inspector"];

type Step = "type" | "more" | "location" | "photo";

interface ReportFlowProps {
  open: boolean;
  userPosition: LatLng;
  onClose: () => void;
  /** Ask the map to enter "drag to place pin" mode; MapScreen owns the live center state. */
  onStartPicking: () => void;
  onStopPicking: () => void;
  pickedCenter: LatLng | null;
  isPicking: boolean;
  /** When set (tapped a specific icon in the quick-report strip), skips straight to the location step. */
  initialType?: HazardTypeId | null;
  /** When set (tapped a point directly on the map), skips the location step entirely and reports at that point once a type is picked. */
  initialPosition?: LatLng | null;
  /** Opens straight on the full hazard-type grid instead of the police/inspector/"more" screen - used by the home "עוד" button, which already showed police/inspector right next to it. */
  initialStep?: "type" | "more";
}

export default function ReportFlow({
  open,
  userPosition,
  onClose,
  onStartPicking,
  onStopPicking,
  pickedCenter,
  isPicking,
  initialType,
  initialPosition,
  initialStep,
}: ReportFlowProps) {
  const { addReport } = useApp();
  const appConfig = useAppConfig();
  const [step, setStep] = useState<Step>("type");
  const [selectedType, setSelectedType] = useState<HazardTypeId | null>(null);
  const [manualPosition, setManualPosition] = useState<LatLng | null>(null);
  const [nickname, setNickname] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pilot-launch geofence (see admin dashboard's ServiceAreaPanel) - reporting
  // is limited to the current service area. Checked against wherever the
  // report would actually land - initialPosition (a direct map tap) or
  // manualPosition (address search / drag-to-pin) if either is set, not just
  // the rider's own live GPS - a rider standing inside the area can still
  // tap or search a point outside it, and that's what matters here. Matches
  // exactly what submit() below uses to place the report.
  const reportPosition = initialPosition ?? manualPosition ?? userPosition;
  const outOfServiceArea =
    appConfig.serviceAreaEnabled &&
    distanceMeters(reportPosition, appConfig.serviceAreaCenter) > appConfig.serviceAreaRadiusKm * 1000;

  const [waitlistPhone, setWaitlistPhone] = useState("");
  const [waitlistCity, setWaitlistCity] = useState("");
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  const submitWaitlist = async () => {
    if (!waitlistPhone.trim() || !waitlistCity.trim()) return;
    setWaitlistSubmitting(true);
    try {
      await submitWaitlistSignup(waitlistPhone.trim(), waitlistCity.trim());
      setWaitlistSubmitted(true);
    } catch (err) {
      console.error("Mifga: submitWaitlistSignup failed", err);
    } finally {
      setWaitlistSubmitting(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (initialType) {
      setSelectedType(initialType);
      setStep("location");
    } else {
      setSelectedType(null);
      setStep(initialStep ?? "type");
    }
  }, [open, initialType, initialStep]);

  const reset = () => {
    setStep("type");
    setSelectedType(null);
    setManualPosition(null);
    setNickname("");
    setPhoto(null);
    setWaitlistPhone("");
    setWaitlistCity("");
    setWaitlistSubmitted(false);
    onStopPicking();
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickType = (id: HazardTypeId) => {
    setSelectedType(id);
    if (initialPosition) {
      setManualPosition(initialPosition);
      setStep("photo");
    } else {
      setStep("location");
    }
  };

  const goManualPick = () => {
    onStartPicking();
  };

  const confirmManualPick = () => {
    onStopPicking();
    setManualPosition(pickedCenter);
    setStep("photo");
  };

  const pickAddress = (pos: LatLng) => {
    setManualPosition(pos);
    setStep("photo");
  };

  const useCurrentLocation = () => {
    setManualPosition(null);
    setStep("photo");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!selectedType) return;
    trackClick(`report_submit_${selectedType}`, "report");
    const position = manualPosition ?? userPosition;
    addReport({ type: selectedType, position, photoDataUrl: photo ?? undefined, nickname: nickname || undefined });
    close();
  };

  // While the user is dragging the map to drop a manual pin, we hide the
  // sheet body but keep it mounted (mounted=open) so state survives, and
  // show a slim confirm bar instead - the crosshair itself lives in MapScreen.
  if (isPicking) {
    return (
      <div className="absolute bottom-0 inset-x-0 z-[1000] p-4 safe-bottom">
        <div className="bg-bg-panel border border-bg-border rounded-2xl shadow-2xl p-3 flex items-center gap-3">
          <Crosshair size={18} className="text-brand-light shrink-0" />
          <div className="flex-1 text-sm text-neutral-200">גררו את המפה כדי למקם את הסיכה במיקום המפגע</div>
          <button onClick={confirmManualPick} className="px-3 py-2 rounded-xl bg-brand text-white text-sm font-semibold active:scale-95">
            אישור מיקום
          </button>
        </div>
      </div>
    );
  }

  return (
    <BottomSheet open={open} onClose={close} maxHeight="88%">
      {outOfServiceArea ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-neutral-50">עוד לא אצלכם</h2>
            <button onClick={close} className="text-neutral-400">
              <X size={22} />
            </button>
          </div>

          <div className="flex flex-col items-center text-center gap-3 mb-5">
            <span className="w-16 h-16 rounded-full flex items-center justify-center bg-bg-panel2 border border-bg-border">
              <MapPinOff size={28} className="text-neutral-400" />
            </span>
            <p className="text-sm text-neutral-300 leading-relaxed max-w-[280px]">{appConfig.serviceAreaMessage}</p>
          </div>

          {waitlistSubmitted ? (
            <div className="flex flex-col items-center text-center gap-2 py-4">
              <span className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center">
                <Check size={22} className="text-green-400" />
              </span>
              <p className="text-sm font-semibold text-neutral-100">נרשמתם!</p>
              <p className="text-xs text-neutral-500">ככל שיירשמו יותר אנשים מהעיר שלכם, ככה נדע שכדאי לפתוח אצלכם קודם.</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-neutral-500 mb-3 text-center">
                תרשמו אותנו - העיר עם הכי הרבה נרשמים היא היעד הבא שנפתח.
              </p>
              <div className="mb-3">
                <input
                  value={waitlistPhone}
                  onChange={(e) => setWaitlistPhone(e.target.value)}
                  placeholder="מספר טלפון"
                  type="tel"
                  inputMode="tel"
                  className="w-full px-4 py-3 rounded-2xl bg-bg-panel2 border-2 border-bg-border outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
                />
              </div>
              <div className="mb-4">
                <IsraeliCityAutocomplete value={waitlistCity} onChange={setWaitlistCity} placeholder="עיר מגורים" />
              </div>
              <button
                onClick={submitWaitlist}
                disabled={waitlistSubmitting || !waitlistPhone.trim() || !waitlistCity.trim()}
                className="w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-base active:scale-95 transition disabled:opacity-40"
              >
                {waitlistSubmitting ? "שולח..." : "הרשמה"}
              </button>
            </div>
          )}
        </div>
      ) : step === "type" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-neutral-50">מה קורה בדרכים?</h2>
            <button onClick={close} className="text-neutral-400">
              <X size={22} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-3">
            {PRIMARY_HAZARD_TYPES.map((h) => (
              <button
                key={h.id}
                onClick={() => pickType(h.id)}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-bg-panel2 border border-bg-border active:scale-95 transition"
              >
                <span
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "#0f1830", border: `2.5px solid ${HAZARD_COLOR_HEX[h.color]}`, boxShadow: `0 0 16px -2px ${HAZARD_COLOR_HEX[h.color]}` }}
                >
                  <HazardIcon name={h.icon} color={HAZARD_COLOR_HEX[h.color]} size={30} />
                </span>
                <span className="text-sm font-semibold text-neutral-200 text-center leading-tight">{h.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setStep("more")}
            className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-bg-panel2 border border-dashed border-bg-border active:scale-95 transition"
          >
            <span className="text-xl leading-none text-neutral-300">···</span>
            <span className="text-sm font-semibold text-neutral-200">עוד סוגי מפגעים</span>
          </button>
        </div>
      )}

      {step === "more" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setStep("type")} className="text-neutral-400">
              <ChevronRight size={22} />
            </button>
            <h2 className="text-lg font-bold text-neutral-50">עוד מפגעים</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {MORE_HAZARD_TYPES.map((h) => (
              <button
                key={h.id}
                onClick={() => pickType(h.id)}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-bg-panel2 border border-bg-border active:scale-95 transition"
              >
                <span
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: "#0f1830", border: `2px solid ${HAZARD_COLOR_HEX[h.color]}`, boxShadow: `0 0 12px -2px ${HAZARD_COLOR_HEX[h.color]}` }}
                >
                  <HazardIcon name={h.icon} color={HAZARD_COLOR_HEX[h.color]} size={24} />
                </span>
                <span className="text-xs text-neutral-200 text-center leading-tight">{h.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "location" && selectedType && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setStep("type")} className="text-neutral-400">
              <ChevronRight size={22} />
            </button>
            <h2 className="text-lg font-bold text-neutral-50">איפה זה?</h2>
          </div>

          {NICKNAME_TYPES.includes(selectedType) && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border mb-4">
              <Tag size={16} className="text-neutral-400 shrink-0" />
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="כינוי אופציונלי (למשל: השוטר עם האופנוע הכחול)"
                className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
              />
            </div>
          )}

          <button
            onClick={useCurrentLocation}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-bg-panel2 border border-brand/60 mb-3 active:scale-95 transition"
          >
            <span className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center">
              <MapPin size={20} className="text-brand-light" />
            </span>
            <div className="text-right flex-1">
              <div className="text-sm font-semibold text-neutral-50">המיקום הנוכחי שלי</div>
              <div className="text-xs text-neutral-400">מבוסס GPS</div>
            </div>
            <Check size={18} className="text-brand-light" />
          </button>

          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-bg-border" />
            <span className="text-[11px] text-neutral-500">או</span>
            <div className="flex-1 h-px bg-bg-border" />
          </div>

          <div className="mb-3">
            <AddressAutocomplete biasNear={userPosition} placeholder="הקלידו כתובת עם השלמה אוטומטית" onSelect={(s) => pickAddress(s.position)} />
          </div>

          <button
            onClick={goManualPick}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-bg-panel2 border border-bg-border active:scale-95 transition"
          >
            <span className="w-10 h-10 rounded-full bg-bg-panel flex items-center justify-center">
              <Crosshair size={20} className="text-neutral-300" />
            </span>
            <div className="text-right flex-1">
              <div className="text-sm font-semibold text-neutral-50">בחירת מיקום ידנית על המפה</div>
              <div className="text-xs text-neutral-400">גררו את המפה למיקום המדויק</div>
            </div>
          </button>
        </div>
      )}

      {step === "photo" && selectedType && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setStep(initialPosition ? "type" : "location")} className="text-neutral-400">
              <ChevronRight size={22} />
            </button>
            <h2 className="text-lg font-bold text-neutral-50">רוצים לצרף תמונה?</h2>
          </div>

          {photo ? (
            <div className="relative mb-4">
              <img src={photo} alt="" className="w-full h-44 object-cover rounded-2xl border border-bg-border" />
              <button
                onClick={() => setPhoto(null)}
                className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
              >
                <X size={16} className="text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 h-32 rounded-2xl bg-bg-panel2 border-2 border-dashed border-bg-border mb-4 active:scale-95 transition"
            >
              <Camera size={26} className="text-brand-light" />
              <span className="text-sm text-neutral-300">צלמו או העלו תמונה</span>
              <span className="text-[11px] text-amber-400 font-semibold">מזכה {POINTS_PER_REPORT_WITH_PHOTO} נקודות במקום {POINTS_PER_REPORT}</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />

          <button onClick={submit} className="w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-base active:scale-95 transition flex items-center justify-center gap-2">
            <ImagePlus size={18} />
            שליחת דיווח {photo ? `(+${POINTS_PER_REPORT_WITH_PHOTO})` : `(+${POINTS_PER_REPORT})`}
          </button>
          {!photo && (
            <button onClick={submit} className="w-full py-2.5 mt-2 text-sm text-neutral-400 active:text-neutral-200">
              דלג ושלח בלי תמונה
            </button>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
