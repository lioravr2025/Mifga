import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  AppSettings,
  FeedbackEntry,
  Friend,
  GroupMessage,
  HazardReport,
  HazardTypeId,
  LatLng,
  NotifyTypePrefs,
  RideLogEntry,
  UserProfile,
  VehicleTypeId,
  WalkieGroup,
} from "../types";
import { DEMO_FRIENDS, DEMO_USER, seedHazards } from "../data/mockData";
import { POINTS_PER_REPORT, POINTS_PER_REPORT_WITH_PHOTO, REMOVAL_THRESHOLD } from "../data/hazardTypes";
import { loadJSON, saveJSON } from "../lib/storage";
import { isBackendConfigured } from "../lib/supabaseClient";
import { ensureSession, fetchOwnProfile } from "../lib/backend/auth";
import { insertProfile, updateProfileRemote } from "../lib/backend/profile";
import { awardPointsRemote } from "../lib/backend/profile";
import { confirmHazardRemote, denyHazardRemote, fetchHazards, insertHazard, subscribeHazards } from "../lib/backend/hazards";

interface NewReportInput {
  type: HazardTypeId;
  position: LatLng;
  photoDataUrl?: string;
  nickname?: string;
}

interface ProfileUpdate {
  name?: string;
  avatarPhoto?: string | null;
  vehicleType?: VehicleTypeId | null;
  vehicleModel?: string | null;
  phone?: string | null;
  username?: string | null;
}

export interface OnboardingInput {
  name: string;
  username: string;
  phone?: string;
  vehicleType?: VehicleTypeId | null;
  vehicleModel?: string | null;
  avatarPhoto?: string | null;
}

export const MAX_FAVORITE_FRIENDS = 3;

interface AppContextValue {
  user: UserProfile;
  friends: Friend[];
  hazards: HazardReport[];
  groups: WalkieGroup[];
  settings: AppSettings;
  lastAwardedPoints: number | null;
  onboardingComplete: boolean;
  /** false only while bootstrapping a real backend session on first load - App.tsx should show a loading state until this flips true */
  backendReady: boolean;
  rideLog: RideLogEntry[];
  addReport: (input: NewReportInput) => void;
  confirmHazard: (id: string) => void;
  denyHazard: (id: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  updateNotifyTypes: (patch: Partial<NotifyTypePrefs>) => void;
  updateProfile: (patch: ProfileUpdate) => void;
  toggleFriendShare: (id: string) => void;
  toggleFavorite: (id: string) => boolean;
  createGroup: (name: string, memberFriendIds: string[]) => string;
  addMembersToGroup: (groupId: string, memberFriendIds: string[]) => void;
  removeMemberFromGroup: (groupId: string, friendId: string) => void;
  removeGroup: (groupId: string) => void;
  sendGroupMessage: (groupId: string) => void;
  clearLastAwarded: () => void;
  /** Throws on failure (e.g. network/backend error) so the onboarding screen can show it - local mode never throws. */
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  addRideLogEntry: (entry: Omit<RideLogEntry, "id">) => void;
  submitFeedback: (liked: boolean, note: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  notificationsEnabled: false,
  notifyTypes: { police: true, inspector: true, other: true },
  notifyRadiusM: 1000,
  notifyDailyLimit: "limited",
  rideAlertRadiusM: 100,
};

const EMPTY_USER: UserProfile = {
  id: "",
  name: "",
  avatarEmoji: "🧑",
  points: 0,
  reportsCount: 0,
  reportsWithPhoto: 0,
  createdAt: Date.now(),
};

// Real member approval / message delivery needs a backend push to the
// friend's device; friends/groups aren't migrated to Supabase yet (see
// README - "מה עוד נשאר"), so this local prototype simulates that round
// trip with a short delay so the "pending -> accepted" / "sent -> delivered"
// flows are demoable end to end without a server, in both modes.
const SIMULATED_APPROVAL_DELAY_MS = 2200;
const SIMULATED_DELIVERY_DELAY_MS = 900;

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile>(() => (isBackendConfigured ? EMPTY_USER : loadJSON("user", DEMO_USER)));
  const [friends, setFriends] = useState<Friend[]>(() => {
    if (isBackendConfigured) return []; // no fake demo people in a real deployment - see README
    // backfill fields added after some users already had friends saved locally
    const stored = loadJSON("friends", DEMO_FRIENDS);
    return stored.map((f, i) => ({
      ...f,
      lastSeenAt: f.lastSeenAt ?? Date.now(),
      favorite: f.favorite ?? false,
      username: f.username ?? `friend${i + 1}`,
    }));
  });
  const [hazards, setHazards] = useState<HazardReport[]>(() => {
    if (isBackendConfigured) return []; // populated by the bootstrap effect below
    const stored = loadJSON<HazardReport[] | null>("hazards", null);
    return stored ?? seedHazards();
  });
  const [groups, setGroups] = useState<WalkieGroup[]>(() => {
    // backfill `messages` for groups created before that field existed - otherwise
    // GroupManageSheet crashes reading .length off an undefined array
    const stored = loadJSON<WalkieGroup[]>("groups", []);
    return stored.map((g) => ({ ...g, messages: g.messages ?? [] }));
  });
  const [settings, setSettings] = useState<AppSettings>(() => {
    const stored = loadJSON("settings", DEFAULT_SETTINGS);
    // merge in case an older saved settings blob predates newer fields
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      notifyTypes: { ...DEFAULT_SETTINGS.notifyTypes, ...stored.notifyTypes },
    };
  });
  const [lastAwardedPoints, setLastAwardedPoints] = useState<number | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean>(() =>
    isBackendConfigured ? false : loadJSON("onboardingComplete", false)
  );
  const [backendReady, setBackendReady] = useState<boolean>(!isBackendConfigured);
  const [rideLog, setRideLog] = useState<RideLogEntry[]>(() => loadJSON("rideLog", []));
  const [feedbackEntries, setFeedbackEntries] = useState<FeedbackEntry[]>(() => loadJSON("feedback", []));

  useEffect(() => {
    if (!isBackendConfigured) saveJSON("user", user);
  }, [user]);
  useEffect(() => saveJSON("friends", friends), [friends]);
  useEffect(() => {
    if (!isBackendConfigured) saveJSON("hazards", hazards);
  }, [hazards]);
  useEffect(() => saveJSON("groups", groups), [groups]);
  useEffect(() => saveJSON("settings", settings), [settings]);
  useEffect(() => {
    if (!isBackendConfigured) saveJSON("onboardingComplete", onboardingComplete);
  }, [onboardingComplete]);
  useEffect(() => saveJSON("rideLog", rideLog), [rideLog]);
  useEffect(() => saveJSON("feedback", feedbackEntries), [feedbackEntries]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", settings.theme === "dark");
  }, [settings.theme]);

  // Merge one hazard insert/update from the server into local state -
  // shared by the initial fetch's realtime subscription and addReport's own write.
  const mergeHazard = (incoming: HazardReport) => {
    setHazards((prev) => {
      const idx = prev.findIndex((h) => h.id === incoming.id);
      if (incoming.removed) return prev.filter((h) => h.id !== incoming.id);
      if (idx === -1) return [incoming, ...prev];
      const next = [...prev];
      next[idx] = incoming;
      return next;
    });
  };

  // One-time bootstrap when a real backend is configured: sign in (anonymous
  // session persists across reloads via Supabase's own storage), load the
  // caller's profile if one already exists, and load current hazards.
  useEffect(() => {
    if (!isBackendConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const uid = await ensureSession();
        const profile = await fetchOwnProfile(uid);
        if (cancelled) return;
        if (profile) {
          setUser(profile);
          setOnboardingComplete(true);
        } else {
          setUser({ ...EMPTY_USER, id: uid });
        }
        const remoteHazards = await fetchHazards();
        if (cancelled) return;
        setHazards(remoteHazards);
      } catch (err) {
        console.error("Mifga: backend bootstrap failed", err);
      } finally {
        if (!cancelled) setBackendReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isBackendConfigured) return;
    return subscribeHazards(mergeHazard);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addReport = (input: NewReportInput) => {
    const points = input.photoDataUrl ? POINTS_PER_REPORT_WITH_PHOTO : POINTS_PER_REPORT;

    if (isBackendConfigured) {
      (async () => {
        try {
          const report = await insertHazard({
            type: input.type,
            position: input.position,
            reporterId: user.id,
            reporterName: user.name,
            photoDataUrl: input.photoDataUrl,
            nickname: input.nickname,
          });
          mergeHazard(report);
          await awardPointsRemote(user.id, points, !!input.photoDataUrl);
          setUser((prev) => ({
            ...prev,
            points: prev.points + points,
            reportsCount: prev.reportsCount + 1,
            reportsWithPhoto: prev.reportsWithPhoto + (input.photoDataUrl ? 1 : 0),
          }));
          setLastAwardedPoints(points);
        } catch (err) {
          console.error("Mifga: addReport failed", err);
        }
      })();
      return;
    }

    const report: HazardReport = {
      id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: input.type,
      position: input.position,
      createdAt: Date.now(),
      reporterId: user.id,
      reporterName: user.name,
      hasPhoto: !!input.photoDataUrl,
      photoDataUrl: input.photoDataUrl,
      confirmations: 0,
      denials: 0,
      nickname: input.nickname?.trim() || undefined,
    };
    setHazards((prev) => [report, ...prev]);
    setUser((prev) => ({
      ...prev,
      points: prev.points + points,
      reportsCount: prev.reportsCount + 1,
      reportsWithPhoto: prev.reportsWithPhoto + (input.photoDataUrl ? 1 : 0),
    }));
    setLastAwardedPoints(points);
  };

  const confirmHazard = (id: string) => {
    if (isBackendConfigured) {
      confirmHazardRemote(id).catch((err) => console.error("Mifga: confirmHazard failed", err));
      return;
    }
    setHazards((prev) => prev.map((h) => (h.id === id ? { ...h, confirmations: h.confirmations + 1, lastVoteAt: Date.now() } : h)));
  };

  const denyHazard = (id: string) => {
    if (isBackendConfigured) {
      denyHazardRemote(id).catch((err) => console.error("Mifga: denyHazard failed", err));
      return;
    }
    setHazards((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const denials = h.denials + 1;
        return { ...h, denials, lastVoteAt: Date.now(), removed: denials >= REMOVAL_THRESHOLD };
      })
    );
  };

  const updateSettings = (patch: Partial<AppSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const updateNotifyTypes = (patch: Partial<NotifyTypePrefs>) =>
    setSettings((s) => ({ ...s, notifyTypes: { ...s.notifyTypes, ...patch } }));

  const updateProfile = (patch: ProfileUpdate) => {
    if (isBackendConfigured && user.id) {
      updateProfileRemote(user.id, patch).catch((err) => console.error("Mifga: updateProfile failed", err));
    }
    setUser((prev) => ({
      ...prev,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.avatarPhoto !== undefined ? { avatarPhoto: patch.avatarPhoto ?? undefined } : {}),
      ...(patch.vehicleType !== undefined ? { vehicleType: patch.vehicleType ?? undefined } : {}),
      ...(patch.vehicleModel !== undefined ? { vehicleModel: patch.vehicleModel ?? undefined } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone ?? undefined } : {}),
      ...(patch.username !== undefined ? { username: patch.username ?? undefined } : {}),
    }));
  };

  const completeOnboarding = async (input: OnboardingInput) => {
    if (isBackendConfigured) {
      const uid = await ensureSession();
      const profile = await insertProfile({
        id: uid,
        name: input.name,
        username: input.username,
        phone: input.phone,
        vehicleType: input.vehicleType,
        vehicleModel: input.vehicleModel,
        avatarPhoto: input.avatarPhoto,
      });
      setUser(profile);
      setOnboardingComplete(true);
      return;
    }
    setUser((prev) => ({
      ...prev,
      name: input.name,
      username: input.username,
      phone: input.phone,
      vehicleType: input.vehicleType ?? undefined,
      vehicleModel: input.vehicleModel ?? undefined,
      avatarPhoto: input.avatarPhoto ?? undefined,
    }));
    setOnboardingComplete(true);
  };

  const addRideLogEntry = (entry: Omit<RideLogEntry, "id">) => {
    const logEntry: RideLogEntry = { id: `ride-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...entry };
    setRideLog((prev) => [logEntry, ...prev].slice(0, 200));
  };

  const submitFeedback = (liked: boolean, note: string) => {
    const entry: FeedbackEntry = {
      id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      liked,
      note: note.trim(),
      submittedAt: Date.now(),
    };
    setFeedbackEntries((prev) => [entry, ...prev]);
  };

  const toggleFriendShare = (_id: string) => {
    // Friend location sharing is mutual/consent-based in the real product;
    // stubbed as a no-op toggle target for the UI in this local prototype.
  };

  const toggleFavorite = (id: string): boolean => {
    const target = friends.find((f) => f.id === id);
    if (!target) return false;
    if (!target.favorite && friends.filter((f) => f.favorite).length >= MAX_FAVORITE_FRIENDS) return false;
    setFriends((prev) => prev.map((f) => (f.id === id ? { ...f, favorite: !f.favorite } : f)));
    return true;
  };

  const acceptGroupMember = (groupId: string, friendId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId
          ? g
          : { ...g, members: g.members.map((m) => (m.friendId === friendId ? { ...m, status: "accepted" as const } : m)) }
      )
    );
  };

  const addMembersToGroup = (groupId: string, memberFriendIds: string[]) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const existingIds = new Set(g.members.map((m) => m.friendId));
        const additions = memberFriendIds.filter((id) => !existingIds.has(id)).map((friendId) => ({ friendId, status: "pending" as const }));
        return { ...g, members: [...g.members, ...additions] };
      })
    );
    memberFriendIds.forEach((friendId) => {
      setTimeout(() => acceptGroupMember(groupId, friendId), SIMULATED_APPROVAL_DELAY_MS + Math.random() * 1500);
    });
  };

  const removeMemberFromGroup = (groupId: string, friendId: string) => {
    setGroups((prev) => prev.map((g) => (g.id !== groupId ? g : { ...g, members: g.members.filter((m) => m.friendId !== friendId) })));
  };

  const createGroup = (name: string, memberFriendIds: string[]): string => {
    const id = `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const group: WalkieGroup = { id, name, createdAt: Date.now(), members: [], messages: [] };
    setGroups((prev) => [...prev, group]);
    addMembersToGroup(id, memberFriendIds);
    return id;
  };

  const removeGroup = (groupId: string) => setGroups((prev) => prev.filter((g) => g.id !== groupId));

  const sendGroupMessage = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const acceptedIds = group.members.filter((m) => m.status === "accepted").map((m) => m.friendId);
    const messageId = `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const message: GroupMessage = {
      id: messageId,
      sentAt: Date.now(),
      receipts: acceptedIds.map((friendId) => ({ friendId, deliveredAt: null })),
    };
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, messages: [...g.messages, message] } : g)));
    acceptedIds.forEach((friendId) => {
      setTimeout(() => {
        setGroups((prev) =>
          prev.map((g) => {
            if (g.id !== groupId) return g;
            return {
              ...g,
              messages: g.messages.map((m) =>
                m.id !== messageId
                  ? m
                  : { ...m, receipts: m.receipts.map((r) => (r.friendId === friendId ? { ...r, deliveredAt: Date.now() } : r)) }
              ),
            };
          })
        );
      }, SIMULATED_DELIVERY_DELAY_MS + Math.random() * 1500);
    });
  };

  const visibleHazards = useMemo(() => hazards.filter((h) => !h.removed), [hazards]);

  const value: AppContextValue = {
    user,
    friends,
    hazards: visibleHazards,
    groups,
    settings,
    lastAwardedPoints,
    onboardingComplete,
    backendReady,
    rideLog,
    addReport,
    confirmHazard,
    denyHazard,
    updateSettings,
    updateNotifyTypes,
    updateProfile,
    toggleFriendShare,
    toggleFavorite,
    createGroup,
    addMembersToGroup,
    removeMemberFromGroup,
    removeGroup,
    sendGroupMessage,
    clearLastAwarded: () => setLastAwardedPoints(null),
    completeOnboarding,
    addRideLogEntry,
    submitFeedback,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
