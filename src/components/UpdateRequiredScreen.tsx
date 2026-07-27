import { DownloadCloud } from "lucide-react";

const DOWNLOAD_URL = "https://israel-ai.org/mifga";

export default function UpdateRequiredScreen({ message }: { message: string | null }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-bg px-8 text-center">
      <span className="w-16 h-16 rounded-2xl bg-brand/15 border border-brand/40 flex items-center justify-center">
        <DownloadCloud size={30} className="text-brand-light" />
      </span>
      <p className="text-lg font-bold text-neutral-50">יש גרסה חדשה של Mifga</p>
      <p className="text-sm text-neutral-400 leading-relaxed">{message || "יש לעדכן את האפליקציה כדי להמשיך להשתמש בה."}</p>
      <a
        href={DOWNLOAD_URL}
        target="_blank"
        rel="noreferrer"
        className="px-6 py-3.5 rounded-2xl bg-brand text-white font-bold text-sm active:scale-95 transition"
      >
        הורדת הגרסה העדכנית
      </a>
    </div>
  );
}
