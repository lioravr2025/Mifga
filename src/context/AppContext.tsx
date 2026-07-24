import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  AppSettings,
  Friend,
  GroupMessage,
  HazardReport,
  HazardTypeId,
  LatLng,
  NotifyTypePrefs,
  UserProfile,
  VehicleTypeId,
  WalkieGroup,
} from "../types";
import { DEMO_FRIENDS, DEMO_USER, seedHazards } from "../data/mockData";
import { POINTS_PER_REPORT, POINTS_PER_REPORT_WITH_PHOTO, REMOVAL_THRESHOLD } from "../data/hazardTypes";
import { loadJSON, saveJSON } from "../lib/storage";

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
}

export const MAX_FAVORITE_FRIENDS = 3;

interface AppContextValue {
  user: UserProfile;
  friends: Friend[];
  hazards: HazardReport[];
  groups: WalkieGroup[];
  settings: AppSettings;
  lastAwardedPoints: number | null;
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
}

const AppContext = createContext<AppContextValue | null>(null);

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  notificationsEnabled: false,
  notifyTypes: { police: true, inspector: true, other: true },
  notifyRadiusM: 1000,
  notifyDailyLimit: "limited",
};

// Real member approval / message delivery needs a backend push to the
// friend's device; this local prototype simulates that round trip with a
// short delay so the "pending -> accepted" / "sent -> delivered" flows are
// demoable end to end without a server.
const SIMULATED_APPROVAL_DELAY_MS = 2200;
const SIMULATED_DELIVERY_DELAY_MS = 900;

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile>(() => loadJSON("user", DEMO_USER));
  const [friends, setFriends] = useState<Friend[]>(() => {
    // backfill fields added after some users already had friends saved locally
    const stored = loadJSON("friends", DEMO_FRIENDS);
    return stored.map((f) => ({ ...f, lastSeenAt: f.lastSeenAt ?? Date.now(), favorite: f.favorite ?? false }));
  });
  const [hazards, setHazards] = useState<HazardReport[]>(() => {
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

  useEffect(() => saveJSON("user", user), [user]);
  useEffect(() => saveJSON("friends", friends), [friends]);
  useEffect(() => saveJSON("hazards", hazards), [hazards]);
  useEffect(() => saveJSON("groups", groups), [groups]);
  useEffect(() => saveJSON("settings", settings), [settings]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", settings.theme === "dark");
  }, [settings.theme]);

  const addReport = (input: NewReportInput) => {
    const points = input.photoDataUrl ? POINTS_PER_REPORT_WITH_PHOTO : POINTS_PER_REPORT;
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
    setHazards((prev) => prev.map((h) => (h.id === id ? { ...h, confirmations: h.confirmations + 1, lastVoteAt: Date.now() } : h)));
  };

  const denyHazard = (id: string) => {
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

  const updateProfile = (patch: ProfileUpdate) =>
    setUser((prev) => ({
      ...prev,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.avatarPhoto !== undefined ? { avatarPhoto: patch.avatarPhoto ?? undefined } : {}),
      ...(patch.vehicleType !== undefined ? { vehicleType: patch.vehicleType ?? undefined } : {}),
      ...(patch.vehicleModel !== undefined ? { vehicleModel: patch.vehicleModel ?? undefined } : {}),
    }));

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
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
