import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import PlayerHUD from "@/components/PlayerHUD";
import XPGainPopup from "@/components/XPGainPopup";
import { getUrgency, getUrgencyColor, formatTimeAgo } from "@/lib/xpUtils";

const HOLD_DURATION = 800;
const RADIUS = 24;
const CIRC = 2 * Math.PI * RADIUS;
const URGENCY_THRESHOLD = 0.25;
const XP_OPTIONS = [5, 10, 20, 50, 100];
const ONE_SHOT_EMOJIS = ["📋","📬","🏛️","🧾","💊","🔑","🛠️","🎁","📞","🗂️","🚗","✈️"];

// ── Periodic Task Card ───────────────────────────────────────────────────────
function TaskCard({ task, householdId, isFlagged, onCompleted, onFlag, completingAsId }) {
  const { user } = useAuth();
  const [completing, setCompleting] = useState(false);
  const [showXP, setShowXP] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdRef = useRef(null);

  const urgency = getUrgency(task.last_completed_at, task.frequency_hours);
  const urgencyColor = justDone ? "#00ff88" : isFlagged ? "#f59e0b" : getUrgencyColor(urgency);
  const isOverdue = urgency >= 1;

  function startHold(e) {
    if (completing || justDone) return;
    e.preventDefault();
    const t0 = Date.now();
    holdRef.current = setInterval(() => {
      const p = Math.min((Date.now() - t0) / HOLD_DURATION, 1);
      setHoldProgress(p);
      if (p >= 1) {
        clearInterval(holdRef.current);
        setHoldProgress(0);
        handleComplete();
      }
    }, 16);
  }

  function cancelHold() {
    clearInterval(holdRef.current);
    setHoldProgress(0);
  }

  async function handleComplete() {
    if (completing || justDone) return;
    setCompleting(true);
    try {
      const { error } = await supabase.from("task_completions").insert({
        task_type_id: task.id,
        household_id: householdId,
        completed_by: completingAsId ?? user.id,
        xp_earned: task.xp_value,
      });
      if (error) throw error;
      if (isFlagged) {
        await supabase.from("task_flags")
          .delete().eq("task_type_id", task.id).eq("household_id", householdId);
      }
      setShowXP(true);
      setJustDone(true);
      setTimeout(() => setShowXP(false), 1000);
      setTimeout(() => { setJustDone(false); onCompleted?.(task.xp_value); }, 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div
      className="relative w-full flex items-center gap-3 overflow-hidden px-4 py-3"
      style={{
        WebkitTapHighlightColor: "transparent",
        background: isFlagged && !justDone ? "rgba(245,158,11,0.04)" : "transparent",
        borderLeft: isFlagged && !justDone ? "3px solid rgba(245,158,11,0.6)" : "3px solid transparent",
      }}
    >
      <button
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        disabled={completing}
        className="relative shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl select-none"
        style={{
          background: justDone ? "rgba(0,255,136,0.15)" : isFlagged ? "rgba(245,158,11,0.12)" : `${urgencyColor}18`,
          border: `1.5px solid ${urgencyColor}44`,
          boxShadow: (isOverdue || isFlagged) && !justDone ? `0 0 16px ${urgencyColor}33` : "none",
          touchAction: "none",
        }}
      >
        {holdProgress > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r={RADIUS} fill="none"
              stroke={urgencyColor} strokeWidth="3"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - holdProgress)}
              strokeLinecap="round"
              style={{ transform: "rotate(-90deg)", transformOrigin: "28px 28px" }}
            />
          </svg>
        )}
        <motion.span
          animate={isOverdue && !justDone && !isFlagged ? { scale: [1, 1.15, 1] } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          {justDone ? "✅" : task.emoji}
        </motion.span>
        {urgency >= 0.75 && !justDone && (
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-game-bg"
            style={{ background: urgencyColor }} />
        )}
        <AnimatePresence>
          {showXP && <XPGainPopup xp={task.xp_value} visible />}
        </AnimatePresence>
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-game-text font-semibold text-sm leading-tight truncate">{task.name}</p>
        <p className="text-game-muted text-xs mt-0.5 truncate">
          {isFlagged && !justDone && <span style={{ color: "#f59e0b" }}>⚡ urgent · </span>}
          {task.last_completed_username
            ? `${task.last_completed_avatar} ${task.last_completed_username} · ${formatTimeAgo(task.last_completed_at)}`
            : <span style={{ color: urgencyColor }}>Jamais fait</span>}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className="font-game font-bold px-2 py-0.5 rounded-lg"
          style={{ color: "#f59e0b", background: "rgba(245,158,11,0.12)", fontSize: "10px" }}>
          +{task.xp_value}
        </span>
        <button
          onClick={() => onFlag?.(task.id, !isFlagged)}
          className="text-base leading-none transition-all active:scale-110"
          style={{ opacity: isFlagged ? 1 : 0.25 }}
        >
          ⚡
        </button>
      </div>
    </div>
  );
}

// ── One-shot Card ────────────────────────────────────────────────────────────
function OneShotCard({ task, currentUserId, getProfileInfo, onComplete, onClaim, onUnclaim, onDelete }) {
  const holdRef = useRef(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [showXP, setShowXP] = useState(false);

  const isCompleted = !!task.completed_at;
  const isClaimedByMe = task.claimed_by === currentUserId;
  const isClaimedByPartner = !!task.claimed_by && !isClaimedByMe;
  const claimer = getProfileInfo(task.claimed_by);

  function startHold(e) {
    if (!isClaimedByMe) return;
    e.preventDefault();
    const t0 = Date.now();
    holdRef.current = setInterval(() => {
      const p = Math.min((Date.now() - t0) / HOLD_DURATION, 1);
      setHoldProgress(p);
      if (p >= 1) {
        clearInterval(holdRef.current);
        setHoldProgress(0);
        setShowXP(true);
        setTimeout(() => setShowXP(false), 900);
        onComplete(task);
      }
    }, 16);
  }

  function cancelHold() {
    clearInterval(holdRef.current);
    setHoldProgress(0);
  }

  if (isCompleted) {
    return (
      <div className="flex items-center gap-3 px-4 py-3" style={{ opacity: 0.4 }}>
        <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl"
          style={{ background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.15)" }}>
          ✅
        </div>
        <p className="flex-1 text-game-text text-sm line-through truncate">{task.name}</p>
        <span className="font-game text-xs shrink-0" style={{ color: "#f59e0b" }}>+{task.xp_value}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {isClaimedByMe ? (
        <button
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          className="relative shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl select-none"
          style={{ background: "rgba(124,58,237,0.15)", border: "1.5px solid rgba(124,58,237,0.4)", touchAction: "none" }}
        >
          {holdProgress > 0 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="17" fill="none" stroke="#7c3aed" strokeWidth="2.5"
                strokeDasharray={2 * Math.PI * 17}
                strokeDashoffset={2 * Math.PI * 17 * (1 - holdProgress)}
                strokeLinecap="round"
                style={{ transform: "rotate(-90deg)", transformOrigin: "20px 20px" }}
              />
            </svg>
          )}
          {task.emoji}
          <AnimatePresence>{showXP && <XPGainPopup xp={task.xp_value} visible />}</AnimatePresence>
        </button>
      ) : (
        <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl"
          style={{
            background: isClaimedByPartner ? "rgba(100,116,139,0.08)" : "rgba(245,158,11,0.08)",
            border: `1px solid ${isClaimedByPartner ? "rgba(100,116,139,0.2)" : "rgba(245,158,11,0.2)"}`,
            opacity: isClaimedByPartner ? 0.6 : 1,
          }}>
          {task.emoji}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-game-text text-sm font-semibold truncate">{task.name}</p>
        {isClaimedByMe && (
          <p className="text-xs" style={{ color: "#a78bfa" }}>Appui long pour terminer</p>
        )}
        {isClaimedByPartner && claimer && (
          <p className="text-game-muted text-xs truncate">
            {claimer.avatar_emoji} {claimer.username} s'en occupe
          </p>
        )}
      </div>

      <span className="font-game text-xs shrink-0" style={{ color: "#f59e0b" }}>+{task.xp_value}</span>

      {!task.claimed_by ? (
        <>
          <button onClick={() => onClaim(task.id)}
            className="font-game font-bold px-2 py-1 rounded-lg shrink-0 whitespace-nowrap"
            style={{ background: "rgba(124,58,237,0.12)", color: "#a78bfa", fontSize: "10px" }}>
            Je m'en occupe
          </button>
          <button onClick={() => onDelete(task.id)} className="shrink-0 text-game-muted text-sm ml-0.5">×</button>
        </>
      ) : (
        <button onClick={() => onUnclaim(task.id)}
          className="font-game px-2 py-1 rounded-lg shrink-0"
          style={{ background: "rgba(100,116,139,0.12)", color: "#64748b", fontSize: "10px" }}>
          Annuler
        </button>
      )}
    </div>
  );
}

// ── Add One-shot Modal ───────────────────────────────────────────────────────
function AddOneShotModal({ onAdd, onClose }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📋");
  const [xp, setXp] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleAdd() {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    const err = await onAdd({ name: name.trim(), emoji, xp_value: xp });
    setLoading(false);
    if (err) setError(err);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
        className="w-full max-w-lg rounded-t-3xl p-5 space-y-4"
        style={{ background: "#0a0a1a", border: "1px solid #1e1e4a" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-game font-bold text-game-text">Nouvelle quête</h3>
          <button onClick={onClose} className="text-game-muted text-xl leading-none">✕</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {ONE_SHOT_EMOJIS.map((e) => (
            <button key={e} onClick={() => setEmoji(e)}
              className="text-xl p-2 rounded-xl transition-all"
              style={{ background: emoji === e ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.04)" }}>
              {e}
            </button>
          ))}
        </div>

        <input
          value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Nom de la quête..." maxLength={50}
          className="w-full bg-game-bg border border-game-border rounded-xl px-3 py-2.5 text-sm text-game-text placeholder-game-muted focus:outline-none focus:border-game-cyan"
        />

        <div>
          <p className="font-game text-game-muted text-xs mb-2">XP · difficulté / durée</p>
          <div className="flex gap-2">
            {XP_OPTIONS.map((v) => (
              <button key={v} onClick={() => setXp(v)}
                className="flex-1 font-game font-bold text-xs py-2 rounded-xl transition-all"
                style={{
                  background: xp === v ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.04)",
                  color: xp === v ? "#f59e0b" : "#64748b",
                  border: xp === v ? "1px solid rgba(245,158,11,0.4)" : "1px solid transparent",
                }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs font-game" style={{ color: "#ef4444" }}>⚠️ {error}</p>}

        <button onClick={handleAdd} disabled={!name.trim() || loading}
          className="w-full font-game font-bold text-sm py-3 rounded-2xl disabled:opacity-40"
          style={{ background: "rgba(124,58,237,0.3)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.4)" }}>
          {loading ? "Ajout..." : "Ajouter la quête"}
        </button>
      </motion.div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [partner, setPartner] = useState(null);
  const [inviteCode, setInviteCode] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [flags, setFlags] = useState(new Set());
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [tasksError, setTasksError] = useState(null);
  const [levelUpVisible, setLevelUpVisible] = useState(false);
  const [xpFlash, setXpFlash] = useState(null);
  const [prevLevel, setPrevLevel] = useState(profile?.level ?? 1);
  const [oneShotTasks, setOneShotTasks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [earlyExpanded, setEarlyExpanded] = useState(false);
  const [activeUserId, setActiveUserId] = useState(null);

  const householdId = profile?.household_id;

  function getProfileInfo(userId) {
    if (!userId) return null;
    if (userId === profile?.id) return profile;
    if (userId === partner?.id) return partner;
    return null;
  }

  const effectiveUserId = activeUserId ?? user?.id;
  const isProxyMode = activeUserId !== null && activeUserId !== user?.id;
  const proxyProfile = isProxyMode ? getProfileInfo(effectiveUserId) : null;

  // ── Fetch periodic tasks ──
  const fetchTasks = useCallback(async () => {
    if (!householdId) return;
    const [{ data: taskTypes, error: taskTypesError }, { data: completions }] = await Promise.all([
      supabase.from("task_types").select("*").order("sort_order"),
      supabase.from("task_completions_latest").select("*").eq("household_id", householdId),
    ]);
    if (taskTypesError) {
      setTasksError(taskTypesError.message);
      setLoadingTasks(false);
      return;
    }
    setTasksError(null);
    const map = {};
    (completions ?? []).forEach((c) => { map[c.task_type_id] = c; });
    const enriched = (taskTypes ?? []).map((t) => {
      const c = map[t.id];
      return {
        ...t,
        last_completed_at: c?.completed_at ?? null,
        last_completed_username: c?.username ?? null,
        last_completed_avatar: c?.avatar_emoji ?? null,
        urgency: getUrgency(c?.completed_at ?? null, t.frequency_hours),
      };
    });
    enriched.sort((a, b) => b.urgency - a.urgency);
    setTasks(enriched);
    setLoadingTasks(false);
  }, [householdId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── Fetch flags ──
  const fetchFlags = useCallback(async () => {
    if (!householdId) return;
    const { data } = await supabase
      .from("task_flags").select("task_type_id").eq("household_id", householdId);
    setFlags(new Set((data ?? []).map((f) => f.task_type_id)));
  }, [householdId]);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  async function toggleFlag(taskId, flagged) {
    if (flagged) {
      await supabase.from("task_flags").insert({ task_type_id: taskId, household_id: householdId, flagged_by: user.id });
      setFlags((prev) => new Set([...prev, taskId]));
    } else {
      await supabase.from("task_flags").delete().eq("task_type_id", taskId).eq("household_id", householdId);
      setFlags((prev) => { const s = new Set(prev); s.delete(taskId); return s; });
    }
  }

  // ── Fetch one-shot tasks (active + completed < 24h) ──
  const fetchOneShotTasks = useCallback(async () => {
    if (!householdId) return;
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("one_shot_tasks")
      .select("*")
      .eq("household_id", householdId)
      .or(`completed_at.is.null,completed_at.gte.${since24h}`)
      .order("created_at");
    if (!error) setOneShotTasks(data ?? []);
  }, [householdId]);

  useEffect(() => { fetchOneShotTasks(); }, [fetchOneShotTasks]);

  async function addOneShotTask({ name, emoji, xp_value }) {
    const { data, error } = await supabase.from("one_shot_tasks")
      .insert({ name, emoji, xp_value, household_id: householdId })
      .select().single();
    if (error) return error.message;
    if (data) {
      setOneShotTasks((prev) => [...prev, data]);
      setShowModal(false);
    }
    return null;
  }

  async function claimOneShotTask(id) {
    const now = new Date().toISOString();
    await supabase.from("one_shot_tasks")
      .update({ claimed_by: user.id, claimed_at: now }).eq("id", id);
    setOneShotTasks((prev) => prev.map((t) => t.id === id ? { ...t, claimed_by: user.id, claimed_at: now } : t));
  }

  async function unclaimOneShotTask(id) {
    await supabase.from("one_shot_tasks")
      .update({ claimed_by: null, claimed_at: null }).eq("id", id);
    setOneShotTasks((prev) => prev.map((t) => t.id === id ? { ...t, claimed_by: null, claimed_at: null } : t));
  }

  async function completeOneShotTask(task) {
    const now = new Date().toISOString();
    await supabase.from("one_shot_tasks")
      .update({ completed_at: now, completed_by: effectiveUserId, claimed_by: null, claimed_at: null }).eq("id", task.id);
    setOneShotTasks((prev) => prev.map((t) =>
      t.id === task.id ? { ...t, completed_at: now, completed_by: effectiveUserId, claimed_by: null, claimed_at: null } : t
    ));
    handleXPGained(task.xp_value);
    refreshProfile();
  }

  async function deleteOneShotTask(id) {
    await supabase.from("one_shot_tasks").delete().eq("id", id);
    setOneShotTasks((prev) => prev.filter((t) => t.id !== id));
  }

  // ── Fetch partner + invite code ──
  useEffect(() => {
    if (!householdId) return;
    supabase.from("profiles").select("*").eq("household_id", householdId).neq("id", user.id).single()
      .then(({ data }) => setPartner(data ?? null));
    supabase.from("households").select("invite_code").eq("id", householdId).single()
      .then(({ data }) => setInviteCode(data?.invite_code ?? null));
  }, [householdId, user.id]);

  // ── Realtime ──
  useEffect(() => {
    if (!householdId) return;
    const ch = supabase.channel(`dashboard-${householdId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "task_completions", filter: `household_id=eq.${householdId}` }, () => fetchTasks())
      .on("postgres_changes", { event: "*", schema: "public", table: "task_flags", filter: `household_id=eq.${householdId}` }, () => fetchFlags())
      .on("postgres_changes", { event: "*", schema: "public", table: "one_shot_tasks", filter: `household_id=eq.${householdId}` }, () => fetchOneShotTasks())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `household_id=eq.${householdId}` }, (payload) => {
        if (payload.new.id !== user.id) {
          setPartner(payload.new);
        } else {
          if (payload.new.level > prevLevel) {
            setLevelUpVisible(true);
            setTimeout(() => setLevelUpVisible(false), 3000);
          }
          setPrevLevel(payload.new.level);
          refreshProfile();
        }
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [householdId, user.id, prevLevel, refreshProfile, fetchTasks, fetchFlags, fetchOneShotTasks]);

  function handleXPGained(xp) {
    setXpFlash(`+${xp} XP ⚡`);
    setTimeout(() => setXpFlash(null), 2000);
  }

  // ── Computed ──
  const activeTasks = tasks.filter((t) => t.urgency > URGENCY_THRESHOLD);
  const earlyTasks = tasks.filter((t) => t.urgency <= URGENCY_THRESHOLD);
  const overdueCount = tasks.filter((t) => t.urgency >= 1).length;
  const flagCount = flags.size;
  const activeOneShotTasks = oneShotTasks.filter((t) => !t.completed_at);
  const completedOneShotTasks = oneShotTasks.filter((t) => !!t.completed_at);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-game-border shrink-0">
        <div>
          <h1 className="font-pixel text-game-green neon-green" style={{ fontSize: "10px" }}>HOUSEHOLD QUEST</h1>
          <p className="text-game-muted" style={{ fontSize: "10px" }}>
            v{__APP_VERSION__}
            {overdueCount > 0 && <span className="text-game-red ml-2">· {overdueCount} en retard</span>}
            {flagCount > 0 && <span className="ml-2" style={{ color: "#f59e0b" }}>· {flagCount} urgent{flagCount > 1 ? "s" : ""}</span>}
          </p>
        </div>
        <AnimatePresence>
          {xpFlash && (
            <motion.span key={Date.now()} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -20 }}
              exit={{ opacity: 0 }} transition={{ duration: 1.5 }}
              className="font-pixel text-game-gold neon-gold" style={{ fontSize: "10px" }}>
              {xpFlash}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Player HUD */}
      <div className="shrink-0">
        <PlayerHUD
          currentProfile={profile}
          partnerProfile={partner}
          inviteCode={inviteCode}
          activeUserId={effectiveUserId}
          onSwitchActive={(id) => setActiveUserId(id === user?.id ? null : id)}
        />
      </div>

      {/* Proxy mode banner */}
      <AnimatePresence>
        {isProxyMode && proxyProfile && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 overflow-hidden shrink-0"
          >
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl mb-1"
              style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)" }}>
              <p className="font-game text-xs" style={{ color: "#00d4ff" }}>
                🔄 Actions pour {proxyProfile.avatar_emoji} {proxyProfile.username}
              </p>
              <button
                onClick={() => setActiveUserId(null)}
                className="font-game text-xs" style={{ color: "#64748b" }}
              >
                Retour à moi
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-4 h-px bg-game-border shrink-0" />

      {/* Scroll area */}
      <div className="flex-1 overflow-y-auto pb-24">
        {loadingTasks ? (
          <p className="text-center font-pixel text-game-green text-xs py-10 animate-pulse">CHARGEMENT DES QUÊTES...</p>
        ) : tasksError ? (
          <div className="text-center py-10 px-4">
            <p className="font-game text-game-red font-bold text-sm">⚠️ {tasksError}</p>
            <button onClick={fetchTasks} className="mt-3 font-game font-bold text-xs px-3 py-2 rounded-xl"
              style={{ background: "rgba(0,255,136,0.12)", color: "#00ff88" }}>Réessayer</button>
          </div>
        ) : (
          <>
            {/* Active periodic tasks */}
            <div className="px-4 py-3">
              {activeTasks.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">🎉</div>
                  <p className="font-game text-game-green font-bold text-sm">TOUT EST FAIT !</p>
                  <p className="text-game-muted text-xs mt-1">Bravo, la maison est nickel.</p>
                </div>
              ) : (
                <>
                  <p className="font-game font-semibold text-game-muted text-xs tracking-wider uppercase mb-2">
                    QUÊTES · appui long pour valider
                  </p>
                  <div className="rounded-2xl overflow-hidden" style={{ background: "#12122a", border: "1px solid #1e1e4a" }}>
                    {activeTasks.map((task, i) => (
                      <div key={task.id}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                          <TaskCard
                            task={task} householdId={householdId}
                            isFlagged={flags.has(task.id)}
                            onCompleted={handleXPGained} onFlag={toggleFlag}
                            completingAsId={effectiveUserId}
                          />
                        </motion.div>
                        {i < activeTasks.length - 1 && <div className="ml-20 h-px" style={{ background: "#1e1e4a" }} />}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Early tasks (collapsible) */}
            {earlyTasks.length > 0 && (
              <div className="px-4 pb-3">
                <button
                  onClick={() => setEarlyExpanded((v) => !v)}
                  className="flex items-center gap-1.5 font-game font-semibold text-xs tracking-wider uppercase text-game-muted mb-2"
                >
                  <span style={{ display: "inline-block", transition: "transform 0.2s", transform: earlyExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                  Faire en avance ({earlyTasks.length})
                </button>
                <AnimatePresence>
                  {earlyExpanded && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="rounded-2xl overflow-hidden" style={{ background: "#12122a", border: "1px solid #1e1e4a", opacity: 0.7 }}>
                        {earlyTasks.map((task, i) => (
                          <div key={task.id}>
                            <TaskCard
                              task={task} householdId={householdId}
                              isFlagged={flags.has(task.id)}
                              onCompleted={handleXPGained} onFlag={toggleFlag}
                            />
                            {i < earlyTasks.length - 1 && <div className="ml-20 h-px" style={{ background: "#1e1e4a" }} />}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* One-shot tasks */}
            <div className="px-4 pt-2 pb-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-game font-semibold text-xs tracking-wider uppercase" style={{ color: "#f59e0b" }}>
                  À FAIRE{activeOneShotTasks.length > 0 && ` (${activeOneShotTasks.length})`}
                </h2>
                <button onClick={() => setShowModal(true)}
                  className="font-game font-bold text-xs px-2 py-1 rounded-lg"
                  style={{ color: "#f59e0b", background: "rgba(245,158,11,0.12)" }}>
                  + AJOUTER
                </button>
              </div>

              {activeOneShotTasks.length === 0 && completedOneShotTasks.length === 0 ? (
                <p className="text-game-muted text-xs text-center py-3 font-game">Aucune quête en cours</p>
              ) : (
                <div className="rounded-2xl overflow-hidden" style={{ background: "#12122a", border: "1px solid #1e1e4a" }}>
                  {activeOneShotTasks.map((task, i) => (
                    <div key={task.id}>
                      <OneShotCard
                        task={task} currentUserId={user.id} getProfileInfo={getProfileInfo}
                        onComplete={completeOneShotTask} onClaim={claimOneShotTask}
                        onUnclaim={unclaimOneShotTask} onDelete={deleteOneShotTask}
                      />
                      {(i < activeOneShotTasks.length - 1 || completedOneShotTasks.length > 0) && (
                        <div className="ml-16 h-px" style={{ background: "#1e1e4a" }} />
                      )}
                    </div>
                  ))}
                  {completedOneShotTasks.map((task, i) => (
                    <div key={task.id}>
                      <OneShotCard
                        task={task} currentUserId={user.id} getProfileInfo={getProfileInfo}
                        onComplete={completeOneShotTask} onClaim={claimOneShotTask}
                        onUnclaim={unclaimOneShotTask} onDelete={deleteOneShotTask}
                      />
                      {i < completedOneShotTasks.length - 1 && (
                        <div className="ml-16 h-px" style={{ background: "#1e1e4a" }} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add one-shot modal */}
      <AnimatePresence>
        {showModal && <AddOneShotModal onAdd={addOneShotTask} onClose={() => setShowModal(false)} />}
      </AnimatePresence>

      {/* Level up overlay */}
      <AnimatePresence>
        {levelUpVisible && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
            style={{ background: "rgba(0,0,0,0.75)" }}>
            <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }} transition={{ type: "spring", duration: 0.5 }} className="text-center">
              <div className="text-6xl mb-4">🏆</div>
              <p className="font-pixel text-game-gold neon-gold text-lg">LEVEL UP !</p>
              <p className="font-pixel text-game-green text-sm mt-2">Niveau {profile?.level}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
