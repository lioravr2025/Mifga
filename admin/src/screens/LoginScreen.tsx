import { useState } from "react";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { useAdminAuth } from "../hooks/useAdminAuth";

export default function LoginScreen({ auth }: { auth: ReturnType<typeof useAdminAuth> }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupDone, setSignupDone] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const { error: err } = mode === "signin" ? await auth.signIn(email, password) : await auth.signUp(email, password);
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (mode === "signup") setSignupDone(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <span className="w-14 h-14 rounded-2xl bg-brand/15 border border-brand/40 flex items-center justify-center mb-3">
            <ShieldCheck size={26} className="text-brand-light" />
          </span>
          <h1 className="text-xl font-bold text-neutral-50">ניהול Mifga</h1>
          <p className="text-xs text-neutral-500 mt-1">ממשק פנימי - לא לשימוש ציבורי</p>
        </div>

        {signupDone ? (
          <div className="p-4 rounded-2xl bg-brand/10 border border-brand/30 text-sm text-neutral-200 text-center leading-relaxed">
            נשלח אליכם מייל אישור - לחצו על הקישור בו כדי לאמת את החשבון, ורק אז אפשר יהיה להתחבר. אם זה החשבון הראשון
            שנוצר כאן, הוא הפך אוטומטית למנהל.
            <button onClick={() => { setMode("signin"); setSignupDone(false); }} className="block mx-auto mt-3 text-brand-light font-semibold text-sm">
              למסך התחברות
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <label className="text-xs text-neutral-400 mb-1.5 block">אימייל</label>
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border">
                <Mail size={16} className="text-neutral-400 shrink-0" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  dir="ltr"
                  className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs text-neutral-400 mb-1.5 block">סיסמה</label>
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border">
                <Lock size={16} className="text-neutral-400 shrink-0" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  dir="ltr"
                  className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
              </div>
            </div>

            {error && <div className="mb-4 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs">{error}</div>}

            <button
              onClick={submit}
              disabled={!email || !password || submitting}
              className="w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {mode === "signin" ? "התחברות" : "יצירת חשבון"}
            </button>

            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="w-full text-center text-xs text-neutral-500 mt-4"
            >
              {mode === "signin" ? "יוצרים כאן חשבון בפעם הראשונה? יצירת חשבון" : "כבר יש חשבון? התחברות"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
