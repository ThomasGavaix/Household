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

// ── Task Card ────────────────────────────────────────────────
function TaskCard({ task, householdId, isFlagged, onCompleted, onFlag }) {
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
        completed_by: user.id,
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
      {/* Hold-to-complete icon */}
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
        {/* Progress ring */}
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

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-game-text font-semibold text-sm leading-tight truncate">{task.name}</p>
        <p className="text-game-muted text-xs mt-0.5 truncate">
          {isFlagged && !justDone && <span style={{ color: "#f59e0b" }}>⚡ urgent · </span>}
          {task.last_completed_username
            ? `${task.last_completed_avatar} ${task.last_completed_username} · ${formatTimeAgo(task.last_completed_at)}`
            : <span style={{ color: urgencyColor }}>Jamais fait</span>}
        </p>
      </div>

      {/* Right: XP + flag */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className="font-game font-bold px-2 py-0.5 rounded-lg"
          style={{ color: "#f59e0b", background: "rgba(245,158,11,0.12)", fontSize: "10px" }}>
          +{task.xp_value}
        </span>
        <button
          onClick={() => onFlag?.(task.id, !isFlagged)}
          className="text-base leading-none transition-all active:scale-110"
          style={{ opacity: isFlagged ? 1 : 0.25 }}
          title={isFlagged ? "Retirer le signalement" : "Signaler à faire"}
        >
          ⚡
        </button>
      </div>
    </div>
  );
}

// ── Emojis rapides pour le picker ─────────────────────────────
const QUICK_EMOJIS = [
  "🧹","🛒","💊","📦","🐕","🌿","🚗","📮","🔧","💡",
  "🍳","🧺","🗑️","📞","✂️","🪥","🧴","🪣","🧽","🔑",
  "📝","💻","🧊","🪟","🛁","🚽","🧻","🪴","🎁","✨",
];

// ── Modal bottom-sheet : ajouter une mission ponctuelle ────────
function AddOneShotModal({ visible, onClose, onAdd }) {
  const [emoji, setEmoji] = useState("✨");
  const [name, setName] = useState("");
  const [xpValue, setXpValue] = useState(10);

  function handleClose() {
    setEmoji("✨");
    setName("");
    setXpValue(10);
    onClose();
  }

  async function handleAdd() {
    if (!name.trim()) return;
    await onAdd({ name: name.trim(), emoji, xpValue });
    handleClose();
  }

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.65)" }}
            onClick={handleClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl px-5 pt-4 pb-10"
            style={{ background: "#12122a", border: "1px solid #1e1e4a" }}
          >
            <div className="w-10 h-1 rounded-full bg-game-border mx-auto mb-4" />
            <p className="font-pixel text-game-green text-xs mb-4">NOUVELLE MISSION</p>

            {/* Emoji grid */}
            <div className="grid grid-cols-10 gap-1.5 mb-4">
              {QUICK_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className="text-xl h-8 w-full rounded-lg flex items-center justify-center"
                  style={{
                    background: emoji === e ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.05)",
                    border: emoji === e ? "1px solid #7c3aed" : "1px solid transparent",
                  }}
                >
                  {e}
                </button>
              ))}
            </div>

            {/* Preview + nom */}
            <div className="flex gap-3 items-center mb-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                style={{ background: "rgba(255,255,255,0.07)" }}
              >
                {emoji}
              </div>
              <input
                type="text"
                placeholder="Nom de la mission..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="flex-1 px-4 py-3 rounded-xl text-sm"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid #1e1e4a",
                  outline: "none",
                  color: "#e2e8f0",
                }}
                autoFocus
              />
            </div>

            {/* Sélecteur XP */}
            <div className="flex gap-2 mb-5">
              {[5, 10, 20, 50, 100].map((v) => (
                <button
                  key={v}
                  onClick={() => setXpValue(v)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold"
                  style={{
                    background: xpValue === v ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)",
                    color: xpValue === v ? "#f59e0b" : "#888",
                    border: xpValue === v ? "1px solid rgba(245,158,11,0.5)" : "1px solid transparent",
                  }}
                >
                  {v} XP
                </button>
              ))}
            </div>

            <button
              onClick={handleAdd}
              disabled={!name.trim()}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm"
              style={{
                background: name.trim() ? "#7c3aed" : "rgba(124,58,237,0.25)",
                color: name.trim() ? "#fff" : "#888",
              }}
            >
              Ajouter
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── OneShotCard — 4 états ─────────────────────────────────────
function OneShotCard({ task, myId, getProfileInfo, onClaim, onUnclaim, onComplete, onDelete }) {
  const isDone    = !!task.completed_at;
  const isMine    = !isDone && task.claimed_by === myId;
  const isPartner = !isDone && !!task.claimed_by && task.claimed_by !== myId;

  const [holdProgress, setHoldProgress] = useState(0);
  const intervalRef = useRef(null);
  const firedRef    = useRef(false);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function startHold() {
    if (!isMine || firedRef.current) return;
    firedRef.current = false;
    intervalRef.current = setInterval(() => {
      setHoldProgress((p) => {
        const next = p + 100 / 30; // ~1.5 s à 50 ms
        if (next >= 100) {
          clearInterval(intervalRef.current);
          if (!firedRef.current) { firedRef.current = true; onComplete(task); }
          return 0;
        }
        return next;
      });
    }, 50);
  }

  function stopHold() {
    clearInterval(intervalRef.current);
    setHoldProgress(0);
  }

  const r             = 22;
  const CX            = 28;
  const CY            = 28;
  const circumference = 2 * Math.PI * r;

  const partnerInfo   = isPartner ? getProfileInfo(task.claimed_by) : null;
  const completerInfo = isDone    ? getProfileInfo(task.completed_by) : null;

  // ── Complété ──────────────────────────────────────────────
  if (isDone) {
    return (
      <div className="flex items-center gap-3 px-4 py-3" style={{ opacity: 0.4 }}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
          style={{ background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.15)" }}
        >
          ✅
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-game-text text-sm font-semibold truncate line-through">{task.name}</p>
          <p className="text-game-muted text-xs mt-0.5">
            {completerInfo?.username ?? "Complété"} · {formatTimeAgo(task.completed_at)}
          </p>
        </div>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-lg shrink-0"
          style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)" }}
        >
          +{task.xp_value}
        </span>
      </div>
    );
  }

  // ── Pris par moi → appui long ─────────────────────────────
  if (isMine) {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="relative shrink-0 cursor-pointer select-none"
          style={{ width: 56, height: 56, touchAction: "none", WebkitUserSelect: "none" }}
          onPointerDown={startHold}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
        >
          <svg width="56" height="56" style={{ position: "absolute", inset: 0 }}>
            <circle cx={CX} cy={CY} r={r} fill="none" stroke="#1e1e4a" strokeWidth="3" />
            <circle
              cx={CX} cy={CY} r={r}
              fill="none"
              stroke="#7c3aed"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - holdProgress / 100)}
              transform={`rotate(-90 ${CX} ${CY})`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-2xl pointer-events-none">
            {task.emoji}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-game-text text-sm font-semibold truncate">{task.name}</p>
          <p className="text-game-muted text-xs mt-0.5">
            {holdProgress > 0 ? "Maintenir pour terminer…" : "Appuyer longuement"}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
            style={{ color: "#f59e0b", background: "rgba(245,158,11,0.12)" }}>
            +{task.xp_value}
          </span>
          <button onClick={() => onUnclaim(task.id)} className="text-game-muted text-xs">
            Annuler
          </button>
        </div>
      </div>
    );
  }

  // ── Pris par le partenaire ────────────────────────────────
  if (isPartner) {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid #1e1e4a",
            opacity: 0.55,
            filter: "grayscale(0.6)",
          }}
        >
          {task.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-game-text text-sm font-semibold truncate">{task.name}</p>
          <p className="text-game-muted text-xs mt-0.5">
            {partnerInfo?.avatar_emoji} {partnerInfo?.username ?? "Partenaire"} s'en occupe
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
            style={{ color: "#f59e0b", background: "rgba(245,158,11,0.12)" }}>
            +{task.xp_value}
          </span>
          <button onClick={() => onUnclaim(task.id)} className="text-game-muted text-xs">
            Annuler
          </button>
        </div>
      </div>
    );
  }

  // ── Libre ─────────────────────────────────────────────────
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
        style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)" }}
      >
        {task.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-game-text text-sm font-semibold truncate">{task.name}</p>
        <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
          style={{ color: "#f59e0b", background: "rgba(245,158,11,0.12)" }}>
          +{task.xp_value}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onClaim(task.id)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{
            background: "rgba(124,58,237,0.2)",
            color: "#a78bfa",
            border: "1px solid rgba(124,58,237,0.4)",
          }}
        >
          Je m'en occupe
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-lg leading-none"
          style={{ background: "rgba(255,255,255,0.06)", color: "#64748b" }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [partner, setPartner] = useState(null);
  const [inviteCode, setInviteCode] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [flags, setFlags] = useState(new Set());
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [levelUpVisible, setLevelUpVisible] = useState(false);
  const [xpFlash, setXpFlash] = useState(null);
  const [prevLevel, setPrevLevel] = useState(profile?.level ?? 1);
  const [oneShotTasks, setOneShotTasks] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [tasksError, setTasksError] = useState(null);
  const [showCompletedOneShot, setShowCompletedOneShot] = useState(false);
  const [completedOneShotTasks, setCompletedOneShotTasks] = useState([]);
  const [loadingCompleted, setLoadingCompleted] = useState(false);

  const householdId = profile?.household_id;

  // ── Fetch periodic tasks ──
  const fetchTasks = useCallback(async () => {
    if (!householdId) return;
    const [{ data: taskTypes, error: taskTypesError }, { data: completions }] = await Promise.all([
      supabase.from("task_types").select("*").order("sort_order"),
      supabase.from("task_completions_latest").select("*").eq("household_id", householdId),
    ]);
    if (taskTypesError) {
      console.error("fetchTasks error:", taskTypesError);
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

  // ── Fetch one-shot tasks ──
  const fetchOneShotTasks = useCallback(async () => {
    if (!householdId) return;
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("one_shot_tasks").select("*").eq("household_id", householdId)
      .or(`completed_at.is.null,completed_at.gte.${since24h}`)
      .order("created_at", { ascending: false });
    if (!error) setOneShotTasks(data ?? []);
  }, [householdId]);

  useEffect(() => { fetchOneShotTasks(); }, [fetchOneShotTasks]);

  async function addOneShotTask({ name, emoji, xpValue }) {
    if (!householdId) return;
    const { data, error } = await supabase.from("one_shot_tasks")
      .insert({ name, emoji, xp_value: xpValue, household_id: householdId, created_by: user.id })
      .select().single();
    if (!error && data) setOneShotTasks((prev) => [data, ...prev]);
  }

  async function claimOneShotTask(id) {
    const now = new Date().toISOString();
    await supabase.from("one_shot_tasks")
      .update({ claimed_by: user.id, claimed_at: now })
      .eq("id", id);
    setOneShotTasks((p) => p.map((t) =>
      t.id === id ? { ...t, claimed_by: user.id, claimed_at: now } : t
    ));
  }

  async function unclaimOneShotTask(id) {
    await supabase.from("one_shot_tasks")
      .update({ claimed_by: null, claimed_at: null })
      .eq("id", id);
    setOneShotTasks((p) => p.map((t) =>
      t.id === id ? { ...t, claimed_by: null, claimed_at: null } : t
    ));
  }

  async function completeOneShotTask(task) {
    const now = new Date().toISOString();
    await supabase.from("one_shot_tasks")
      .update({ completed_at: now, completed_by: user.id, claimed_by: null, claimed_at: null })
      .eq("id", task.id);
    setOneShotTasks((p) => p.map((t) =>
      t.id === task.id
        ? { ...t, completed_at: now, completed_by: user.id, claimed_by: null, claimed_at: null }
        : t
    ));
    handleXPGained(task.xp_value);
  }

  async function deleteOneShotTask(id) {
    await supabase.from("one_shot_tasks").delete().eq("id", id);
    setOneShotTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function getProfileInfo(userId) {
    if (!userId) return null;
    return userId === user.id ? profile : partner;
  }

  const fetchCompletedOneShotTasks = useCallback(async () => {
    if (!householdId) return;
    setLoadingCompleted(true);
    const { data, error } = await supabase
      .from("one_shot_tasks").select("*").eq("household_id", householdId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false }).limit(30);
    if (!error) setCompletedOneShotTasks(data ?? []);
    else console.error("fetchCompletedOneShotTasks error:", error);
    setLoadingCompleted(false);
  }, [householdId]);

  function toggleCompletedOneShot() {
    const next = !showCompletedOneShot;
    setShowCompletedOneShot(next);
    if (next && completedOneShotTasks.length === 0) fetchCompletedOneShotTasks();
  }

  // ── Fetch partner + invite code ──
  useEffect(() => {
    if (!householdId) return;
    supabase.from("profiles").select("*").eq("household_id", householdId).neq("id", user.id).single()
      .then(({ data }) => setPartner(data ?? null));
    supabase.from("households").select("invite_code").eq("id", householdId).single()
      .then(({ data }) => setInviteCode(data?.invite_code ?? null));
  }, [householdId, user.id]);

  // ── Realtime: completions, profiles, flags, one_shot_tasks ──
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

  const overdueCount = tasks.filter((t) => t.urgency >= 1).length;
  const flagCount = flags.size;

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
        <PlayerHUD currentProfile={profile} partnerProfile={partner} inviteCode={inviteCode} />
      </div>
      <div className="mx-4 h-px bg-game-border shrink-0" />

      {/* Scroll area */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Periodic tasks */}
        {loadingTasks ? (
          <p className="text-center font-pixel text-game-green text-xs py-10 animate-pulse">CHARGEMENT DES QUÊTES...</p>
        ) : tasksError ? (
          <div className="text-center py-10 px-4">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="font-game text-game-red font-bold text-sm">Erreur de chargement</p>
            <p className="text-game-muted text-xs mt-1">{tasksError}</p>
            <button onClick={fetchTasks} className="mt-3 font-game font-bold text-xs px-3 py-2 rounded-xl"
              style={{ background: "rgba(0,255,136,0.12)", color: "#00ff88" }}>Réessayer</button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-game text-game-muted font-bold">Aucune tâche configurée</p>
          </div>
        ) : (
          <div className="px-4 py-3">
            <p className="font-game font-semibold text-game-muted text-xs tracking-wider uppercase mb-2">
              QUÊTES · appui long pour valider
            </p>
            <div className="rounded-2xl overflow-hidden" style={{ background: "#12122a", border: "1px solid #1e1e4a" }}>
              {tasks.map((task, i) => (
                <div key={task.id}>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                    <TaskCard
                      task={task}
                      householdId={householdId}
                      isFlagged={flags.has(task.id)}
                      onCompleted={handleXPGained}
                      onFlag={toggleFlag}
                    />
                  </motion.div>
                  {i < tasks.length - 1 && <div className="ml-20 h-px" style={{ background: "#1e1e4a" }} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* One-shot tasks */}
        <div className="px-4 pt-2 pb-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-game font-semibold text-xs tracking-wider uppercase" style={{ color: "#f59e0b" }}>À FAIRE</h2>
            <button onClick={() => setShowAddModal(true)}
              className="font-game font-bold text-xs px-2 py-1 rounded-lg"
              style={{ color: "#f59e0b", background: "rgba(245,158,11,0.12)" }}>
              + AJOUTER
            </button>
          </div>

          {oneShotTasks.filter((t) => !t.completed_at).length > 0 ? (
            <div className="rounded-2xl overflow-hidden" style={{ background: "#12122a", border: "1px solid #1e1e4a" }}>
              <AnimatePresence>
                {oneShotTasks.filter((t) => !t.completed_at).map((task, i, arr) => (
                  <div key={task.id}>
                    <OneShotCard
                      task={task}
                      myId={user.id}
                      getProfileInfo={getProfileInfo}
                      onClaim={claimOneShotTask}
                      onUnclaim={unclaimOneShotTask}
                      onComplete={completeOneShotTask}
                      onDelete={deleteOneShotTask}
                    />
                    {i < arr.length - 1 && <div className="ml-16 h-px" style={{ background: "#1e1e4a" }} />}
                  </div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <p className="text-game-muted text-xs text-center py-3 font-game">Aucune quête en cours</p>
          )}

          {/* Completed one-shot tasks history */}
          <div className="mt-3">
            <button
              onClick={toggleCompletedOneShot}
              className="font-game text-xs font-semibold tracking-wider"
              style={{ color: "#6b7280" }}
            >
              {showCompletedOneShot ? "▾" : "▸"} TERMINÉES
              {completedOneShotTasks.length > 0 && ` (${completedOneShotTasks.length})`}
            </button>
            <AnimatePresence>
              {showCompletedOneShot && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-2">
                  {loadingCompleted ? (
                    <p className="text-game-muted text-xs text-center py-3 font-game animate-pulse">Chargement...</p>
                  ) : completedOneShotTasks.length === 0 ? (
                    <p className="text-game-muted text-xs text-center py-3 font-game">Aucune quête terminée</p>
                  ) : (
                    <div className="rounded-2xl overflow-hidden" style={{ background: "#12122a", border: "1px solid #1e1e4a" }}>
                      {completedOneShotTasks.map((task, i) => (
                        <div key={task.id}>
                          <div className="flex items-center gap-3 px-4 py-2.5 opacity-60">
                            <span className="text-xl shrink-0">{task.emoji}</span>
                            <p className="flex-1 text-game-text text-xs truncate line-through">{task.name}</p>
                            <span className="text-game-muted text-xs shrink-0">{formatTimeAgo(task.completed_at)}</span>
                          </div>
                          {i < completedOneShotTasks.length - 1 && <div className="ml-14 h-px" style={{ background: "#1e1e4a" }} />}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

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

      {/* Add one-shot modal */}
      <AddOneShotModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={addOneShotTask}
      />
    </div>
  );
}
