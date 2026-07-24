import { useState } from "react";
import BottomNav from "./components/BottomNav";
import FeedbackButton from "./components/FeedbackButton";
import SettingsSheet from "./components/SettingsSheet";
import MapScreen from "./screens/MapScreen";
import ProfileScreen from "./screens/ProfileScreen";
import FriendsScreen from "./screens/FriendsScreen";
import RouteScreen from "./screens/RouteScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import { useGeolocation } from "./hooks/useGeolocation";
import { useRideMonitor } from "./hooks/useRideMonitor";
import { useApp } from "./context/AppContext";

export type TabId = "profile" | "friends" | "map" | "route";

export default function App() {
  const [tab, setTab] = useState<TabId>("map");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusFriendId, setFocusFriendId] = useState<string | null>(null);
  const { position } = useGeolocation();
  const { onboardingComplete } = useApp();
  // Lives here (not inside a screen) so a ride keeps beeping regardless of
  // which tab is open - Route isn't kept mounted like Map is.
  const ride = useRideMonitor(position);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#05070d] sm:py-4">
      <div className="relative w-full h-[100dvh] sm:h-[92dvh] sm:max-h-[900px] max-w-[430px] bg-bg overflow-hidden flex flex-col sm:rounded-[2.5rem] sm:border-8 sm:border-black sm:shadow-2xl">
        {!onboardingComplete ? (
          <OnboardingScreen />
        ) : (
          <>
            {/* Map screen stays mounted always (display toggling) so GPS watch + map
                state survive tab switches instead of remounting Leaflet each time. */}
            <div className={`flex-1 min-h-0 flex flex-col ${tab === "map" ? "" : "hidden"}`}>
              <MapScreen
                position={position}
                ride={ride}
                onGoRoute={() => setTab("route")}
                onGoFriends={() => setTab("friends")}
                onGoProfile={() => setTab("profile")}
                onOpenSettings={() => setSettingsOpen(true)}
                focusFriendId={focusFriendId}
                onConsumeFocusFriend={() => setFocusFriendId(null)}
              />
            </div>

            {tab === "profile" && (
              <div className="flex-1 min-h-0 flex flex-col">
                <ProfileScreen onOpenSettings={() => setSettingsOpen(true)} />
              </div>
            )}
            {tab === "friends" && (
              <div className="flex-1 min-h-0 flex flex-col">
                <FriendsScreen
                  onLocateFriend={(id) => {
                    setFocusFriendId(id);
                    setTab("map");
                  }}
                />
              </div>
            )}
            {tab === "route" && (
              <div className="flex-1 min-h-0 flex flex-col">
                <RouteScreen position={position} ride={ride} />
              </div>
            )}

            <BottomNav tab={tab} onChange={setTab} />
            <FeedbackButton />

            <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
          </>
        )}
      </div>
    </div>
  );
}
