import { useState } from "react";
import { Mic } from "lucide-react";
import { APIProvider } from "@vis.gl/react-google-maps";
import BottomNav from "./components/BottomNav";
import LoadingScreen from "./components/LoadingScreen";
import FeedbackButton from "./components/FeedbackButton";
import SettingsSheet from "./components/SettingsSheet";
import SideMenu from "./components/SideMenu";
import MyPointsScreen from "./components/MyPointsScreen";
import BroadcastPopup from "./components/BroadcastPopup";
import RideHazardConfirmPopup from "./components/RideHazardConfirmPopup";
import UpdateRequiredScreen from "./components/UpdateRequiredScreen";
import UpdateNudge from "./components/UpdateNudge";
import MapScreen from "./screens/MapScreen";
import ProfileScreen from "./screens/ProfileScreen";
import FriendsScreen from "./screens/FriendsScreen";
import RouteScreen from "./screens/RouteScreen";
import MeetupsScreen from "./screens/MeetupsScreen";
import MarketplaceScreen from "./screens/MarketplaceScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import { useGeolocation } from "./hooks/useGeolocation";
import { useRideMonitor } from "./hooks/useRideMonitor";
import { useAppConfig } from "./hooks/useAppConfig";
import { useWakeLock } from "./hooks/useWakeLock";
import { compareVersions, isVersionBelow } from "./lib/versionCheck";
import { useApp } from "./context/AppContext";

export type TabId = "profile" | "friends" | "map" | "route";

export default function App() {
  const [tab, setTab] = useState<TabId>("map");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const [meetupsOpen, setMeetupsOpen] = useState(false);
  const [myPointsOpen, setMyPointsOpen] = useState(false);
  const [editProfileSignal, setEditProfileSignal] = useState(0);
  const [focusFriendId, setFocusFriendId] = useState<string | null>(null);
  const { position } = useGeolocation();
  const { onboardingComplete, backendReady, lastIncomingVoiceLabel, incomingFriendRequests, incomingGroupInvites } = useApp();
  const appConfig = useAppConfig();
  const pendingFriendsCount = incomingFriendRequests.length + incomingGroupInvites.length;
  // Lives here (not inside a screen) so a ride keeps beeping regardless of
  // which tab is open - Route isn't kept mounted like Map is.
  const ride = useRideMonitor(position);
  // Screen stays on for the whole ride, same as Waze during turn-by-turn.
  useWakeLock(ride.rideActive);
  const updateRequired = isVersionBelow(__APP_VERSION__, appConfig.minRequiredVersion);
  const optionalUpdateAvailable =
    !updateRequired && !!appConfig.latestVersion && compareVersions(__APP_VERSION__, appConfig.latestVersion) < 0;

  return (
    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string} libraries={["places", "geometry"]}>
    <div className="min-h-screen w-full flex items-center justify-center bg-[#05070d] sm:py-4">
      <div className="relative w-full h-[100dvh] sm:h-[92dvh] sm:max-h-[900px] max-w-[430px] bg-bg overflow-hidden flex flex-col sm:rounded-[2.5rem] sm:border-8 sm:border-black sm:shadow-2xl">
        {!backendReady ? (
          <LoadingScreen />
        ) : updateRequired ? (
          <UpdateRequiredScreen message={appConfig.updateMessage} />
        ) : !onboardingComplete ? (
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
                onOpenMenu={() => setSideMenuOpen(true)}
                focusFriendId={focusFriendId}
                onConsumeFocusFriend={() => setFocusFriendId(null)}
              />
            </div>

            {tab === "profile" && (
              <div className="flex-1 min-h-0 flex flex-col">
                <ProfileScreen
                  onOpenSettings={() => setSettingsOpen(true)}
                  openEditSignal={editProfileSignal}
                  onOpenEditConsumed={() => setEditProfileSignal(0)}
                />
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
            {/* Kept mounted (display toggling) like Map above, not remounted per tab
                switch - otherwise an active turn-by-turn navigation (route, live
                position tracking, voice announcement history) is destroyed the
                moment you glance at another tab. */}
            <div className={`flex-1 min-h-0 flex flex-col ${tab === "route" ? "" : "hidden"}`}>
              <RouteScreen position={position} ride={ride} active={tab === "route"} />
            </div>

            <BottomNav tab={tab} onChange={setTab} friendsBadgeCount={pendingFriendsCount} />
            <FeedbackButton />

            {lastIncomingVoiceLabel && (
              <div className="absolute top-4 inset-x-4 z-[2000] flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-brand/90 backdrop-blur border border-brand-light/50 shadow-2xl safe-top animate-slideUp">
                <Mic size={16} className="text-white shrink-0" />
                <span className="text-sm font-semibold text-white">הודעה קולית מ{lastIncomingVoiceLabel} 🎙️</span>
              </div>
            )}

            <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
            <SideMenu
              open={sideMenuOpen}
              onClose={() => setSideMenuOpen(false)}
              onEditProfile={() => {
                setTab("profile");
                setEditProfileSignal((s) => s + 1);
              }}
              onOpenMarketplace={() => setMarketplaceOpen(true)}
              onOpenMeetups={() => setMeetupsOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenMyPoints={() => setMyPointsOpen(true)}
            />
            {marketplaceOpen && <MarketplaceScreen onClose={() => setMarketplaceOpen(false)} />}
            {meetupsOpen && <MeetupsScreen onClose={() => setMeetupsOpen(false)} />}
            <MyPointsScreen open={myPointsOpen} onClose={() => setMyPointsOpen(false)} />
            <BroadcastPopup />
            <RideHazardConfirmPopup hazard={ride.pendingConfirmHazard} onResolve={ride.resolvePendingConfirm} />
            {optionalUpdateAvailable && <UpdateNudge latestVersion={appConfig.latestVersion!} message={appConfig.updateMessage} />}
          </>
        )}
      </div>
    </div>
    </APIProvider>
  );
}
