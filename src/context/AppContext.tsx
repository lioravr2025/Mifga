import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  AppSettings,
  FeedbackEntry,
  Friend,
  GroupMessage,
  HazardReport,
  HazardTypeId,
  IncomingFriendRequest,
  IncomingGroupInvite,
  LatLng,
  NotifyTypePrefs,
  Prize,
  RideLogEntry,
  UserProfile,
  VehicleTypeId,
  WalkieGroup,
} from "../types";
import { DEMO_FRIENDS, DEMO_USER, seedHazards } from "../data/mockData";
import {
  HAZARD_EXPIRY_MS,
  HAZARD_EXPIRY_TYPES,
  POINTS_PER_REPORT,
  POINTS_PER_REPORT_WITH_PHOTO,
  POINTS_PER_VOTE,
  REMOVAL_THRESHOLD,
} from "../data/hazardTypes";
import { loadJSON, saveJSON } from "../lib/storage";
import { playAudioUrl } from "../lib/nativeMic";
import { setErrorLogUser } from "../lib/errorLogger";
import { setAnalyticsUser } from "../lib/analytics";
import { isBackendConfigured } from "../lib/supabaseClient";
import { ensureSession, fetchOwnProfile, recoverAccount as recoverAccountRemote } from "../lib/backend/auth";
import { insertProfile, updateProfileRemote } from "../lib/backend/profile";
import { awardPointsRemote, awardVotePointsRemote } from "../lib/backend/profile";
import { confirmHazardRemote, denyHazardRemote, fetchHazards, insertHazard, subscribeHazards } from "../lib/backend/hazards";
import { collectPrizeRemote, fetchMyCollectedPrizeIds, fetchPrizes, subscribePrizes } from "../lib/backend/prizes";
import { awardMeetupArrival } from "../lib/backend/meetups";
import { uploadBlob } from "../lib/backend/storage";
import { playPrizeCollected } from "../lib/sound";
import {
  fetchFriends,
  fetchIncomingFriendRequests,
  respondFriendRequestRemote,
  searchProfiles,
  sendFriendRequest,
  subscribeFriendships,
  toggleFriendFavoriteRemote,
  removeFriendRemote,
  updatePresence,
  type ProfileSearchResult,
} from "../lib/backend/friends";
import {
  createGroupRemote,
  fetchGroups,
  fetchIncomingGroupInvites,
  inviteMembersRemote,
  markMessageDeliveredRemote,
  removeGroupRemote,
  removeMemberRemote,
  respondGroupInviteRemote,
  sendGroupMessageRemote,
  subscribeGroupMessages,
  subscribeGroups,
  subscribeMessageReceipts,
  toggleGroupPinRemote,
} from "../lib/backend/groups";
import {
  markFriendMessageDeliveredRemote,
  sendFriendMessageRemote,
  subscribeFriendMessages,
  type FriendMessageRow,
} from "../lib/backend/directMessages";
import type { WalkieGroupMessageReceiptRow, WalkieGroupMessageRow } from "../lib/backend/types";
import { fetchRideLog, hideRideLogEntryRemote, insertRideLogEntry } from "../lib/backend/rideLog";
import { insertFeedbackRemote } from "../lib/backend/feedback";

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
  instagram?: string | null;
  tiktok?: string | null;
}

export interface OnboardingInput {
  name: string;
  username: string;
  phone?: string;
  vehicleType?: VehicleTypeId | null;
  vehicleModel?: string | null;
  avatarPhoto?: string | null;
  recoveryCode?: string;
}

export const MAX_FAVORITE_FRIENDS = 3;
export const MAX_PINNED_GROUPS = 3;

interface AppContextValue {
  user: UserProfile;
  friends: Friend[];
  hazards: HazardReport[];
  prizes: Prize[];
  groups: WalkieGroup[];
  settings: AppSettings;
  lastAwardedPoints: number | null;
  onboardingComplete: boolean;
  /** false only while bootstrapping a real backend session on first load - App.tsx should show a loading state until this flips true */
  backendReady: boolean;
  rideLog: RideLogEntry[];
  /** backend mode only: friend requests other people sent me, awaiting my accept/decline */
  incomingFriendRequests: IncomingFriendRequest[];
  /** backend mode only: group invites awaiting my accept/decline */
  incomingGroupInvites: IncomingGroupInvite[];
  /** backend mode only: name of whoever a just-received voice message is from, shown as a toast then auto-cleared */
  lastIncomingVoiceLabel: string | null;
  addReport: (input: NewReportInput) => void;
  confirmHazard: (id: string) => void;
  denyHazard: (id: string) => void;
  collectPrize: (id: string) => void;
  awardMeetupArrivalPoints: (meetupId: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  updateNotifyTypes: (patch: Partial<NotifyTypePrefs>) => void;
  updateProfile: (patch: ProfileUpdate) => void;
  toggleFriendShare: (id: string) => void;
  toggleFavorite: (id: string) => boolean;
  toggleGroupPin: (id: string) => boolean;
  removeFriend: (id: string) => Promise<void>;
  createGroup: (name: string, memberFriendIds: string[]) => string;
  addMembersToGroup: (groupId: string, memberFriendIds: string[]) => void;
  removeMemberFromGroup: (groupId: string, friendId: string) => void;
  removeGroup: (groupId: string) => void;
  sendGroupMessage: (groupId: string, audioBlob?: Blob | null) => void;
  /** backend mode only: a direct (non-group) walkie-talkie voice message straight to a friend */
  sendFriendMessage: (friendId: string, audioBlob?: Blob | null) => void;
  clearLastAwarded: () => void;
  /** Throws on failure (e.g. network/backend error) so the onboarding screen can show it - local mode never throws. */
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  recoverAccount: (phone: string, code: string) => Promise<boolean>;
  addRideLogEntry: (entry: Omit<RideLogEntry, "id">) => void;
  deleteRideLogEntry: (id: string) => void;
  submitFeedback: (liked: boolean, note: string) => void;
  /** backend mode only: search all registered users by username to add as a friend */
  searchFriendCandidates: (query: string) => Promise<ProfileSearchResult[]>;
  addFriendByUid: (targetUid: string) => Promise<void>;
  respondFriendRequest: (friendshipId: string, accept: boolean) => Promise<void>;
  respondGroupInvite: (groupId: string, accept: boolean) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  notificationsEnabled: true,
  notifyTypes: { police: true, inspector: true, other: false, meetups: true, prizes: true },
  notifyDailyLimit: "limited",
  rideAlertRadiusM: 100,
  walkieTipDismissed: false,
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
// friend's device; in local (no-backend) mode this simulates that round
// trip with a short delay so the "pending -> accepted" / "sent -> delivered"
// flows are demoable end to end without a server.
const SIMULATED_APPROVAL_DELAY_MS = 2200;
const SIMULATED_DELIVERY_DELAY_MS = 900;
const PRESENCE_PUSH_INTERVAL_MS = 25_000;
const VOICE_TOAST_MS = 3000;

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile>(() => (isBackendConfigured ? EMPTY_USER : loadJSON("user", DEMO_USER)));
  const [friends, setFriends] = useState<Friend[]>(() => {
    if (isBackendConfigured) return []; // populated by the bootstrap effect below
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
  // Backend-only feature (admin-seeded via the dashboard's "פיזור" tab) - no
  // offline/local-mode equivalent, so it just starts empty there.
  const [prizes, setPrizes] = useState<Prize[]>([]);
  // Multi-collect prizes this rider already collected - hidden from *their*
  // map only (the prize row itself stays live for everyone else). Single-
  // collect prizes never need this: they're removed from `prizes` for
  // everyone the moment anyone collects them.
  const [myCollectedPrizeIds, setMyCollectedPrizeIds] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<WalkieGroup[]>(() => {
    if (isBackendConfigured) return []; // populated by the bootstrap effect below
    // backfill `messages` for groups created before that field existed - otherwise
    // GroupManageSheet crashes reading .length off an undefined array
    const stored = loadJSON<WalkieGroup[]>("groups", []);
    return stored.map((g) => ({ ...g, messages: g.messages ?? [], pinned: g.pinned ?? false }));
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
  const [rideLog, setRideLog] = useState<RideLogEntry[]>(() => (isBackendConfigured ? [] : loadJSON("rideLog", [])));
  const [feedbackEntries, setFeedbackEntries] = useState<FeedbackEntry[]>(() => loadJSON("feedback", []));
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<IncomingFriendRequest[]>([]);
  const [incomingGroupInvites, setIncomingGroupInvites] = useState<IncomingGroupInvite[]>([]);
  const [lastIncomingVoiceLabel, setLastIncomingVoiceLabel] = useState<string | null>(null);

  // Refs so realtime callbacks (set up once) can read current state without
  // re-subscribing on every friends/groups change.
  const friendsRef = useRef(friends);
  useEffect(() => {
    friendsRef.current = friends;
  }, [friends]);
  const groupsRef = useRef(groups);
  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    if (!isBackendConfigured) saveJSON("user", user);
  }, [user]);
  useEffect(() => {
    if (!isBackendConfigured) saveJSON("friends", friends);
  }, [friends]);
  useEffect(() => {
    if (!isBackendConfigured) saveJSON("hazards", hazards);
  }, [hazards]);
  useEffect(() => {
    if (!isBackendConfigured) saveJSON("groups", groups);
  }, [groups]);
  useEffect(() => saveJSON("settings", settings), [settings]);
  useEffect(() => {
    if (!isBackendConfigured) saveJSON("onboardingComplete", onboardingComplete);
  }, [onboardingComplete]);
  useEffect(() => {
    if (!isBackendConfigured) saveJSON("rideLog", rideLog);
  }, [rideLog]);
  useEffect(() => saveJSON("feedback", feedbackEntries), [feedbackEntries]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", settings.theme === "dark");
  }, [settings.theme]);

  const showVoiceToast = (label: string) => {
    setLastIncomingVoiceLabel(label);
    setTimeout(() => setLastIncomingVoiceLabel((cur) => (cur === label ? null : cur)), VOICE_TOAST_MS);
  };

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

  const addPrize = (incoming: Prize) => {
    setPrizes((prev) => (prev.some((p) => p.id === incoming.id) ? prev : [...prev, incoming]));
  };

  const removePrize = (id: string) => {
    setPrizes((prev) => prev.filter((p) => p.id !== id));
  };

  const reloadFriendsAndRequests = async (uid: string) => {
    try {
      const [friendsList, requests] = await Promise.all([fetchFriends(uid), fetchIncomingFriendRequests(uid)]);
      setFriends(friendsList);
      setIncomingFriendRequests(requests);
    } catch (err) {
      console.error("Mifga: reload friends failed", err);
    }
  };

  const reloadGroups = async (uid: string) => {
    try {
      const [groupList, invites] = await Promise.all([fetchGroups(uid), fetchIncomingGroupInvites(uid)]);
      setGroups(groupList);
      setIncomingGroupInvites(invites);
    } catch (err) {
      console.error("Mifga: reload groups failed", err);
    }
  };

  // One-time bootstrap when a real backend is configured: sign in (anonymous
  // session persists across reloads via Supabase's own storage), load the
  // caller's profile/friends/groups/ride-log if they already exist, and load
  // current hazards.
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

        const [remoteHazards, rideLogEntries] = await Promise.all([fetchHazards(), fetchRideLog(uid)]);
        if (cancelled) return;
        setHazards(remoteHazards);
        setRideLog(rideLogEntries);
        await Promise.all([reloadFriendsAndRequests(uid), reloadGroups(uid)]);

        // Isolated from the critical path above on purpose - the prizes table
        // is a newer addition, and a hiccup fetching it (or the SQL simply not
        // having been applied yet on a given environment) must never block
        // hazards/ride-log/friends/groups from loading.
        fetchPrizes()
          .then((remotePrizes) => {
            if (!cancelled) setPrizes(remotePrizes);
          })
          .catch((err) => console.error("Mifga: fetchPrizes failed", err));
        fetchMyCollectedPrizeIds(uid)
          .then((ids) => {
            if (!cancelled) setMyCollectedPrizeIds(new Set(ids));
          })
          .catch((err) => console.error("Mifga: fetchMyCollectedPrizeIds failed", err));
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

  useEffect(() => {
    if (!isBackendConfigured) return;
    return subscribePrizes(addPrize, removePrize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: friends, groups, and incoming voice messages. Gated on having
  // a signed-in uid (set by the bootstrap effect above, for both new and
  // returning users) so callbacks below always have a valid `uid` to close over.
  useEffect(() => {
    if (!isBackendConfigured || !user.id) return;
    const uid = user.id;

    const handleIncomingGroupMessage = (row: WalkieGroupMessageRow) => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id !== row.group_id
            ? g
            : {
                ...g,
                messages: g.messages.some((m) => m.id === row.id)
                  ? g.messages
                  : [
                      ...g.messages,
                      {
                        id: row.id,
                        sentAt: new Date(row.sent_at).getTime(),
                        audioUrl: row.audio_url,
                        senderId: row.sender_id,
                        receipts: [],
                      } as GroupMessage,
                    ],
              }
        )
      );
      if (row.sender_id === uid) return;
      playAudioUrl(row.audio_url).catch((err) => console.error("Mifga: group voice message playback failed", err));
      const group = groupsRef.current.find((g) => g.id === row.group_id);
      showVoiceToast(group?.name ?? "קבוצה");
      markMessageDeliveredRemote(row.id).catch((err) => console.error("Mifga: markMessageDelivered failed", err));
    };

    const handleReceiptUpdate = (row: WalkieGroupMessageReceiptRow) => {
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          messages: g.messages.map((m) =>
            m.id !== row.message_id
              ? m
              : {
                  ...m,
                  receipts: m.receipts.map((r) =>
                    r.friendId === row.member_id
                      ? { ...r, deliveredAt: row.delivered_at ? new Date(row.delivered_at).getTime() : null }
                      : r
                  ),
                }
          ),
        }))
      );
    };

    const handleIncomingFriendMessage = (row: FriendMessageRow) => {
      if (row.sender_id === uid) return;
      playAudioUrl(row.audio_url).catch((err) => console.error("Mifga: friend voice message playback failed", err));
      const friend = friendsRef.current.find((f) => f.id === row.sender_id);
      showVoiceToast(friend?.name ?? "חבר");
      markFriendMessageDeliveredRemote(row.id).catch((err) => console.error("Mifga: markFriendMessageDelivered failed", err));
    };

    const unsubFriendships = subscribeFriendships(uid, () => reloadFriendsAndRequests(uid));
    const unsubGroups = subscribeGroups(() => reloadGroups(uid));
    const unsubMessages = subscribeGroupMessages(handleIncomingGroupMessage);
    const unsubReceipts = subscribeMessageReceipts(handleReceiptUpdate);
    const unsubFriendMsgs = subscribeFriendMessages(uid, handleIncomingFriendMessage);
    return () => {
      unsubFriendships();
      unsubGroups();
      unsubMessages();
      unsubReceipts();
      unsubFriendMsgs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Ties future crash/error reports and usage analytics to an account, once known
  useEffect(() => {
    setErrorLogUser(user.id || null);
    setAnalyticsUser(user.id || null);
  }, [user.id]);

  // Live presence: push my position + activity timestamp periodically so
  // friends see "online" / distance, once I'm a real onboarded user.
  useEffect(() => {
    if (!isBackendConfigured || !user.id || !onboardingComplete) return;
    const push = () => {
      if (!("geolocation" in navigator)) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => updatePresence(user.id, pos.coords.latitude, pos.coords.longitude).catch(() => {}),
        () => {},
        { maximumAge: 20_000, timeout: 8000 }
      );
    };
    push();
    const interval = setInterval(push, PRESENCE_PUSH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user.id, onboardingComplete]);

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

  const awardVotePoints = () => {
    if (isBackendConfigured && user.id) {
      awardVotePointsRemote(user.id, POINTS_PER_VOTE).catch((err) => console.error("Mifga: awardVotePoints failed", err));
    }
    setUser((prev) => ({ ...prev, points: prev.points + POINTS_PER_VOTE }));
    setLastAwardedPoints(POINTS_PER_VOTE);
  };

  const confirmHazard = (id: string) => {
    if (isBackendConfigured) {
      confirmHazardRemote(id).catch((err) => console.error("Mifga: confirmHazard failed", err));
      awardVotePoints();
      return;
    }
    setHazards((prev) => prev.map((h) => (h.id === id ? { ...h, confirmations: h.confirmations + 1, lastVoteAt: Date.now() } : h)));
    awardVotePoints();
  };

  const collectPrize = (id: string) => {
    if (!isBackendConfigured) return; // no local-mode equivalent - admin-seeded only
    // Optimistic removal - the realtime UPDATE would also remove it, but that
    // round trip is what a fast second tap could otherwise sneak past.
    // Multi-collect prizes never get removed this way - they stay on the map
    // for every other rider to collect too, only this user's own copy is done.
    const isMulti = prizes.find((p) => p.id === id)?.collectMode === "multi";
    if (!isMulti) removePrize(id);
    collectPrizeRemote(id)
      .then((points) => {
        if (points === null) return; // already collected (by someone else, or by me already in multi mode)
        setUser((prev) => ({ ...prev, points: prev.points + points }));
        setLastAwardedPoints(points);
        if (settings.notifyTypes.prizes) playPrizeCollected();
        // Multi-collect prizes stay live for everyone else, but this rider
        // shouldn't keep seeing (or re-triggering proximity collection on)
        // one they already got - hide it from just their own map.
        if (isMulti) setMyCollectedPrizeIds((prev) => new Set(prev).add(id));
      })
      .catch((err) => console.error("Mifga: collectPrize failed", err));
  };

  const awardMeetupArrivalPoints = (meetupId: string) => {
    if (!isBackendConfigured) return; // no local-mode equivalent
    awardMeetupArrival(meetupId)
      .then((points) => {
        if (points === null) return; // already awarded for this meetup before
        setUser((prev) => ({ ...prev, points: prev.points + points }));
        setLastAwardedPoints(points);
      })
      .catch((err) => console.error("Mifga: awardMeetupArrival failed", err));
  };

  const denyHazard = (id: string) => {
    if (isBackendConfigured) {
      denyHazardRemote(id).catch((err) => console.error("Mifga: denyHazard failed", err));
      awardVotePoints();
      return;
    }
    setHazards((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const denials = h.denials + 1;
        return { ...h, denials, lastVoteAt: Date.now(), removed: denials >= REMOVAL_THRESHOLD };
      })
    );
    awardVotePoints();
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
      ...(patch.instagram !== undefined ? { instagram: patch.instagram ?? undefined } : {}),
      ...(patch.tiktok !== undefined ? { tiktok: patch.tiktok ?? undefined } : {}),
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
        recoveryCode: input.recoveryCode,
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
      recoveryCode: input.recoveryCode,
    }));
    setOnboardingComplete(true);
  };

  /** Resolves true/false rather than throwing so the login screen can show a plain inline error instead of an unhandled rejection. */
  const recoverAccount = async (phone: string, code: string): Promise<boolean> => {
    if (!isBackendConfigured) return false;
    try {
      const profile = await recoverAccountRemote(phone.trim(), code.trim());
      if (!profile) return false;
      setUser(profile);
      setOnboardingComplete(true);
      return true;
    } catch (err) {
      console.error("Mifga: recoverAccount failed", err);
      return false;
    }
  };

  const addRideLogEntry = (entry: Omit<RideLogEntry, "id">) => {
    if (isBackendConfigured && user.id) {
      insertRideLogEntry(user.id, entry).catch((err) => console.error("Mifga: addRideLogEntry failed", err));
    }
    const logEntry: RideLogEntry = { id: `ride-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...entry };
    setRideLog((prev) => [logEntry, ...prev].slice(0, 200));
  };

  /** Removes a ride from the rider's own history only - the underlying record (and its data for analytics) is kept, just hidden from this user's view. */
  const deleteRideLogEntry = (id: string) => {
    if (isBackendConfigured && user.id) {
      hideRideLogEntryRemote(user.id, id).catch((err) => console.error("Mifga: deleteRideLogEntry failed", err));
    }
    setRideLog((prev) => prev.filter((r) => r.id !== id));
  };

  const submitFeedback = (liked: boolean, note: string) => {
    if (isBackendConfigured && user.id) {
      insertFeedbackRemote(user.id, liked, note).catch((err) => console.error("Mifga: submitFeedback failed", err));
    }
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
    // stubbed as a no-op toggle target for the UI. In backend mode, sharing
    // is simplified to "on for every accepted friend" (see friends.ts) - true
    // per-friend consent is a documented follow-up, not built in this pass.
  };

  const toggleFavorite = (id: string): boolean => {
    const target = friends.find((f) => f.id === id);
    if (!target) return false;
    if (!target.favorite && friends.filter((f) => f.favorite).length >= MAX_FAVORITE_FRIENDS) return false;
    setFriends((prev) => prev.map((f) => (f.id === id ? { ...f, favorite: !f.favorite } : f)));
    if (isBackendConfigured && target.friendshipId) {
      toggleFriendFavoriteRemote(target.friendshipId).catch((err) => console.error("Mifga: toggleFavorite failed", err));
    }
    return true;
  };

  const toggleGroupPin = (id: string): boolean => {
    const target = groups.find((g) => g.id === id);
    if (!target) return false;
    if (!target.pinned && groups.filter((g) => g.pinned).length >= MAX_PINNED_GROUPS) return false;
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, pinned: !g.pinned } : g)));
    if (isBackendConfigured) {
      toggleGroupPinRemote(id).catch((err) => console.error("Mifga: toggleGroupPin failed", err));
    }
    return true;
  };

  const removeFriend = async (id: string): Promise<void> => {
    const target = friends.find((f) => f.id === id);
    if (!target) return;
    setFriends((prev) => prev.filter((f) => f.id !== id));
    if (isBackendConfigured && target.friendshipId) {
      await removeFriendRemote(target.friendshipId).catch((err) => console.error("Mifga: removeFriend failed", err));
    }
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
    if (isBackendConfigured) {
      inviteMembersRemote(groupId, memberFriendIds)
        .then(() => reloadGroups(user.id))
        .catch((err) => console.error("Mifga: addMembersToGroup failed", err));
      return;
    }
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
    if (isBackendConfigured) {
      removeMemberRemote(groupId, friendId)
        .then(() => reloadGroups(user.id))
        .catch((err) => console.error("Mifga: removeMemberFromGroup failed", err));
      return;
    }
    setGroups((prev) => prev.map((g) => (g.id !== groupId ? g : { ...g, members: g.members.filter((m) => m.friendId !== friendId) })));
  };

  const createGroup = (name: string, memberFriendIds: string[]): string => {
    if (isBackendConfigured) {
      createGroupRemote(user.id, name, memberFriendIds)
        .then(() => reloadGroups(user.id))
        .catch((err) => console.error("Mifga: createGroup failed", err));
      return "";
    }
    const id = `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const group: WalkieGroup = { id, name, createdAt: Date.now(), members: [], messages: [], pinned: false };
    setGroups((prev) => [...prev, group]);
    addMembersToGroup(id, memberFriendIds);
    return id;
  };

  const removeGroup = (groupId: string) => {
    if (isBackendConfigured) {
      removeGroupRemote(groupId)
        .then(() => reloadGroups(user.id))
        .catch((err) => console.error("Mifga: removeGroup failed", err));
      return;
    }
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  const sendGroupMessage = (groupId: string, audioBlob?: Blob | null) => {
    if (isBackendConfigured) {
      if (!audioBlob) return; // no real audio captured (mic unavailable/denied) - nothing to persist in backend mode
      (async () => {
        try {
          const audioUrl = await uploadBlob("walkie-audio", user.id, audioBlob);
          await sendGroupMessageRemote(groupId, audioUrl);
          // the realtime subscription appends the message (for every member, sender included) - no local append needed here.
        } catch (err) {
          console.error("Mifga: sendGroupMessage failed", err);
        }
      })();
      return;
    }

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

  const sendFriendMessage = (friendId: string, audioBlob?: Blob | null) => {
    if (!isBackendConfigured || !audioBlob) return; // local mode has never persisted direct messages - the screen shows its own "sent" toast
    (async () => {
      try {
        const audioUrl = await uploadBlob("walkie-audio", user.id, audioBlob);
        await sendFriendMessageRemote(user.id, friendId, audioUrl);
      } catch (err) {
        console.error("Mifga: sendFriendMessage failed", err);
      }
    })();
  };

  const searchFriendCandidates = async (query: string): Promise<ProfileSearchResult[]> => {
    if (!isBackendConfigured || !user.id) return [];
    return searchProfiles(query, user.id);
  };

  const addFriendByUid = async (targetUid: string): Promise<void> => {
    if (!isBackendConfigured || !user.id) return;
    await sendFriendRequest(user.id, targetUid);
    await reloadFriendsAndRequests(user.id);
  };

  const respondFriendRequest = async (friendshipId: string, accept: boolean): Promise<void> => {
    if (!isBackendConfigured || !user.id) return;
    await respondFriendRequestRemote(friendshipId, accept);
    await reloadFriendsAndRequests(user.id);
  };

  const respondGroupInvite = async (groupId: string, accept: boolean): Promise<void> => {
    if (!isBackendConfigured || !user.id) return;
    await respondGroupInviteRemote(groupId, accept);
    await reloadGroups(user.id);
  };

  // Re-check every 30s so a hazard actually disappears from the map as its
  // 20-minute silence window elapses, not only after the next unrelated re-render.
  const [expiryTick, setExpiryTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setExpiryTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const visibleHazards = useMemo(() => {
    const now = Date.now();
    return hazards.filter((h) => {
      if (h.removed) return false;
      if (!HAZARD_EXPIRY_TYPES.includes(h.type)) return true;
      const lastInteraction = h.lastVoteAt ?? h.createdAt;
      return now - lastInteraction < HAZARD_EXPIRY_MS;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hazards, expiryTick]);

  const visiblePrizes = useMemo(() => {
    const now = Date.now();
    return prizes.filter((p) => !myCollectedPrizeIds.has(p.id) && (p.expiresAt === undefined || p.expiresAt > now));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prizes, myCollectedPrizeIds, expiryTick]);

  const value: AppContextValue = {
    user,
    friends,
    hazards: visibleHazards,
    prizes: visiblePrizes,
    groups,
    settings,
    lastAwardedPoints,
    onboardingComplete,
    backendReady,
    rideLog,
    incomingFriendRequests,
    incomingGroupInvites,
    lastIncomingVoiceLabel,
    addReport,
    confirmHazard,
    denyHazard,
    collectPrize,
    awardMeetupArrivalPoints,
    updateSettings,
    updateNotifyTypes,
    updateProfile,
    toggleFriendShare,
    toggleFavorite,
    toggleGroupPin,
    removeFriend,
    createGroup,
    addMembersToGroup,
    removeMemberFromGroup,
    removeGroup,
    sendGroupMessage,
    sendFriendMessage,
    clearLastAwarded: () => setLastAwardedPoints(null),
    completeOnboarding,
    recoverAccount,
    addRideLogEntry,
    deleteRideLogEntry,
    submitFeedback,
    searchFriendCandidates,
    addFriendByUid,
    respondFriendRequest,
    respondGroupInvite,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
