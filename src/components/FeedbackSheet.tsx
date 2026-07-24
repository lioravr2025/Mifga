import { useState } from "react";
import { PartyPopper, ThumbsDown, ThumbsUp, X } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { useApp } from "../context/AppContext";

export default function FeedbackSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { submitFeedback } = useApp();
  const [liked, setLiked] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const close = () => {
    onClose();
    setTimeout(() => {
      setLiked(null);
      setNote("");
      setSubmitted(false);
    }, 250); // let the close animation finish before resetting
  };

  const submit = () => {
    if (liked === null) return;
    submitFeedback(liked, note);
    setSubmitted(true);
  };

  return (
    <BottomSheet open={open} onClose={close} maxHeight="65%">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-neutral-50">פידבק על האפליקציה</h2>
        <button onClick={close} className="text-neutral-400">
          <X size={22} />
        </button>
      </div>

      {submitted ? (
        <div className="flex flex-col items-center py-6 text-center">
          <PartyPopper size={36} className="text-brand-light mb-3" />
          <div className="text-base font-bold text-neutral-50 mb-1">תודה על המשוב!</div>
          <p className="text-xs text-neutral-400">כל הערה עוזרת לנו לשפר את מפגע</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-neutral-300 mb-4">האם אהבת את האפליקציה?</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setLiked(true)}
              className={`flex flex-col items-center gap-2 py-4 rounded-2xl border active:scale-95 transition ${
                liked === true ? "bg-green-500/15 border-green-500" : "bg-bg-panel2 border-bg-border"
              }`}
            >
              <ThumbsUp size={24} className={liked === true ? "text-green-400" : "text-neutral-400"} />
              <span className={`text-sm font-semibold ${liked === true ? "text-green-300" : "text-neutral-300"}`}>אהבתי</span>
            </button>
            <button
              onClick={() => setLiked(false)}
              className={`flex flex-col items-center gap-2 py-4 rounded-2xl border active:scale-95 transition ${
                liked === false ? "bg-red-500/15 border-red-500" : "bg-bg-panel2 border-bg-border"
              }`}
            >
              <ThumbsDown size={24} className={liked === false ? "text-red-400" : "text-neutral-400"} />
              <span className={`text-sm font-semibold ${liked === false ? "text-red-300" : "text-neutral-300"}`}>לא כל כך</span>
            </button>
          </div>

          {liked !== null && (
            <div className="mb-4">
              <label className="text-xs text-neutral-400 mb-1.5 block">{liked ? "מה אהבת באפליקציה?" : "מה תרצו שנשפר?"}</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={liked ? "למשל: קל לדווח, אהבתי את הצפצופים בנסיעה..." : "למשל: הייתי רוצה ש..."}
                className="w-full px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand resize-none placeholder:text-neutral-500"
              />
            </div>
          )}

          <button
            onClick={submit}
            disabled={liked === null}
            className="w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-base disabled:opacity-40 active:scale-95 transition"
          >
            שליחת משוב
          </button>
        </>
      )}
    </BottomSheet>
  );
}
