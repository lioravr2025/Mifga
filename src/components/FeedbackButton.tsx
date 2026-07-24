import { useState } from "react";
import { MessageSquareHeart } from "lucide-react";
import FeedbackSheet from "./FeedbackSheet";

/** Sits in the same bottom slot the ad banner used to - a feedback prompt for the beta-testing stage. */
export default function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 h-9 w-full bg-gradient-to-l from-brand/30 via-bg-panel2 to-brand/30 border-t border-bg-border text-[11px] text-neutral-300 font-semibold active:opacity-80 transition"
      >
        <MessageSquareHeart size={13} className="text-brand-light" />
        <span>תנו פידבק על האפליקציה</span>
      </button>
      <FeedbackSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
