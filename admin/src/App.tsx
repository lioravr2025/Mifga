import { APIProvider } from "@vis.gl/react-google-maps";
import { Loader2, ShieldOff } from "lucide-react";
import { useAdminAuth } from "./hooks/useAdminAuth";
import LoginScreen from "./screens/LoginScreen";
import Dashboard from "./screens/Dashboard";

// Same key + Map ID the mobile app uses (src/App.tsx) - one Google Maps
// Platform key shared across app and admin keeps the cost panel's numbers
// meaningful instead of having to reconcile two separate keys' usage.
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

function AppShell() {
  const auth = useAdminAuth();

  if (auth.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 size={24} className="text-brand-light animate-spin" />
      </div>
    );
  }

  if (auth.status === "signed-out") {
    return <LoginScreen auth={auth} />;
  }

  if (auth.status === "not-admin") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg px-6 text-center gap-3">
        <ShieldOff size={32} className="text-red-400" />
        <p className="text-neutral-200 font-semibold">החשבון הזה אינו מנהל מערכת</p>
        <button onClick={() => auth.signOut()} className="text-sm text-brand-light font-semibold">
          התנתקות
        </button>
      </div>
    );
  }

  return <Dashboard onSignOut={() => auth.signOut()} />;
}

export default function App() {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY ?? ""} libraries={["places"]} language="he" region="il">
      <AppShell />
    </APIProvider>
  );
}
