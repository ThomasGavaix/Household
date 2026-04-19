import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import PlayerHUD from "@/components/PlayerHUD";
import XPGainPopup from "@/components/XPGainPopup";
import {
  getUrgency,
  getUrgencyColor,
  formatTimeAgo,
} from "@/lib/xpUtils";

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
  const isDone     = !!task.completed_at;
  const isMine     = !isDone && task.claimed_by === myId;
  const isPartner  = !isDone && !!task.claimed_by && task.claimed_by !== myId;

  const [holdProgress, setHoldProgress] = useState(0);
  const intervalRef   = useRef(null);
  const firedRef      = useRef(false);

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

  const r            = 22;
  const CX           = 28;
  const CY           = 28;
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

// ── TaskCard — style Waze incident iOS ────────────────────────
function TaskCard({ task, householdId, onCompleted }) {
  const { user } = useAuth();
  const [completing, setCompleting] = useState(false);
  const [showXP, setShowXP] = useState(false);
  const [justDone, setJustDone] = useState(false);

  const urgency      = getUrgency(task.last_completed_at, task.frequency_hours);
  const urgencyColor = justDone ? "#00ff88" : getUrgencyColor(urgency);
  const isOverdue    = urgency >= 1;

  async function handleComplete() {
    if (completing || justDone) return;
    setCompleting(true);
    try {
      const { error } = await supabase.from("task_completions").insert({
        task_type_id: task.id,
        household_id: householdId,
        completed_by: user.id,
        xp_earned:    task.xp_value,
      });
      if (error) throw error;
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
    <motion.button
      onClick={handleComplete}
      disabled={completing}
      whileTap={{ scale: 0.98, opacity: 0.85 }}
      className="relative w-full flex items-center gap-3 text-left overflow-hidden px-4 py-3.5"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <div
        className="relative shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
        style={{
          background:  justDone ? "rgba(0,255,136,0.15)" : `${urgencyColor}18`,
          border:      `1.5px solid ${urgencyColor}44`,
          boxShadow:   isOverdue && !justDone ? `0 0 16px ${urgencyColor}33` : "none",
        }}
      >
        <motion.span
          animate={isOverdue && !justDone ? { scale: [1, 1.15, 1] } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          {justDone ? "✅" : task.emoji}
        </motion.span>

        {urgency >= 0.75 && !justDone && (
          <div
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-game-bg"
            style={{ background: urgencyColor }}
          />
        )}

        <AnimatePresence>
          {showXP && <XPGainPopup xp={task.xp_value} visible />}
        </AnimatePresence>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-game-text font-semibold text-sm leading-tight truncate">{task.name}</p>
        <p className="text-game-muted text-xs mt-0.5 truncate">
          {task.last_completed_username
            ? `${task.last_completed_avatar} ${task.last_completed_username} · ${formatTimeAgo(task.last_completed_at)}`
            : <span style={{ color: urgencyColor }}>Jamais fait</span>}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className="font-game font-bold px-2 py-0.5 rounded-lg"
          style={{ color: "#f59e0b", background: "rgba(245,158,11,0.12)", fontSize: "10px" }}
        >
          +{task.xp_value}
        </span>
        <span className="text-game-muted text-xs">›</span>
      </div>
    </motion.button>
  );
}

// ── Dashboard ─────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [partner,         setPartner]         = useState(null);
  const [tasks,           setTasks]           = useState([]);
  const [oneShotTasks,    setOneShotTasks]    = useState([]);
  const [loadingTasks,    setLoadingTasks]    = useState(true);
  const [earlyExpanded,   setEarlyExpanded]   = useState(false);
  const [showAddModal,    setShowAddModal]    = useState(false);
  const [levelUpVisible,  setLevelUpVisible]  = useState(false);
  const [xpFlash,         setXpFlash]         = useState(null);
  const [prevLevel,       setPrevLevel]       = useState(profile?.level ?? 1);

  const householdId = profile?.household_id;

  function getProfileInfo(userId) {
    if (!userId) return null;
    return userId === user.id ? profile : partner;
  }

  // ── Fetch tâches périodiques ──────────────────────────────
  const fetchTasks = useCallback(async () => {
    if (!householdId) return;

    const { data: taskTypes } = await supabase
      .from("task_types")
      .select("*")
      .order("sort_order")
      .order("created_at");

    const { data: completions } = await supabase
      .from("task_completions_latest")
      .select("*")
      .eq("household_id", householdId);

    const map = {};
    (completions ?? []).forEach((c) => { map[c.task_type_id] = c; });

    const enriched = (taskTypes ?? []).map((t) => {
      const c = map[t.id];
      return {
        ...t,
        last_completed_at:       c?.completed_at ?? null,
        last_completed_by:       c?.completed_by ?? null,
        last_completed_username: c?.username     ?? null,
        last_completed_avatar:   c?.avatar_emoji ?? null,
        urgency: getUrgency(c?.completed_at ?? null, t.frequency_hours),
      };
    });

    enriched.sort((a, b) => b.urgency - a.urgency);
    setTasks(enriched);
    setLoadingTasks(false);
  }, [householdId]);

  // ── Fetch missions ponctuelles ────────────────────────────
  const fetchOneShotTasks = useCallback(async () => {
    if (!householdId) return;
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("one_shot_tasks")
      .select("*")
      .eq("household_id", householdId)
      .or(`completed_at.is.null,completed_at.gte.${since24h}`)
      .order("created_at", { ascending: false });
    setOneShotTasks(data ?? []);
  }, [householdId]);

  useEffect(() => { fetchTasks(); fetchOneShotTasks(); }, [fetchTasks, fetchOneShotTasks]);

  // ── Fetch partenaire ──────────────────────────────────────
  useEffect(() => {
    if (!householdId) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("household_id", householdId)
      .neq("id", user.id)
      .single()
      .then(({ data }) => setPartner(data ?? null));
  }, [householdId, user.id]);

  // ── Realtime — completions + one_shot_tasks ───────────────
  useEffect(() => {
    if (!householdId) return;
    const ch = supabase
      .channel(`completions-${householdId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "task_completions",
        filter: `household_id=eq.${householdId}`,
      }, () => fetchTasks())
      .on("postgres_changes", {
        event: "*", schema: "public", table: "one_shot_tasks",
        filter: `household_id=eq.${householdId}`,
      }, () => fetchOneShotTasks())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [householdId, fetchTasks, fetchOneShotTasks]);

  // ── Realtime profiles ─────────────────────────────────────
  useEffect(() => {
    if (!householdId) return;
    const ch = supabase
      .channel(`profiles-${householdId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "profiles",
        filter: `household_id=eq.${householdId}`,
      }, (payload) => {
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
  }, [householdId, user.id, prevLevel, refreshProfile]);

  // ── Actions one-shot ──────────────────────────────────────
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
      .update({ completed_by: user.id, completed_at: now, claimed_by: null, claimed_at: null })
      .eq("id", task.id);
    setOneShotTasks((p) => p.map((t) =>
      t.id === task.id
        ? { ...t, completed_by: user.id, completed_at: now, claimed_by: null, claimed_at: null }
        : t
    ));
    handleXPGained(task.xp_value);
  }

  async function deleteOneShotTask(id) {
    await supabase.from("one_shot_tasks").delete().eq("id", id);
    setOneShotTasks((p) => p.filter((t) => t.id !== id));
  }

  async function addOneShotTask({ name, emoji, xpValue }) {
    const { data } = await supabase
      .from("one_shot_tasks")
      .insert({ household_id: householdId, name, emoji, xp_value: xpValue, created_by: user.id })
      .select()
      .single();
    if (data) setOneShotTasks((p) => [data, ...p]);
  }

  function handleXPGained(xp) {
    setXpFlash(`+${xp} XP ⚡`);
    setTimeout(() => setXpFlash(null), 2000);
  }

  const activeTasks  = tasks.filter((t) => t.urgency > 0.25);
  const earlyTasks   = tasks.filter((t) => t.urgency <= 0.25);
  const overdueCount = tasks.filter((t) => t.urgency >= 1).length;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-game-border shrink-0">
        <div>
          <h1 className="font-pixel text-game-green neon-green" style={{ fontSize: "10px" }}>
            HOUSEHOLD QUEST
          </h1>
          <p className="text-game-muted" style={{ fontSize: "10px" }}>
            v{__APP_VERSION__}
            {overdueCount > 0 && (
              <span className="text-game-red ml-2">· {overdueCount} en retard</span>
            )}
          </p>
        </div>
        <AnimatePresence>
          {xpFlash && (
            <motion.span
              key={xpFlash + Date.now()}
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -20 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5 }}
              className="font-pixel text-game-gold neon-gold"
              style={{ fontSize: "10px" }}
            >
              {xpFlash}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Player HUD ── */}
      <div className="shrink-0">
        <PlayerHUD currentProfile={profile} partnerProfile={partner} />
      </div>

      <div className="mx-4 h-px bg-game-border shrink-0" />

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto pb-24">
        {loadingTasks ? (
          <p className="text-center font-pixel text-game-green text-xs py-10 animate-pulse">
            CHARGEMENT DES QUÊTES...
          </p>
        ) : (
          <div className="px-4 py-3 flex flex-col gap-4">

            {/* ── Tâches actives (urgency > 0.25) ── */}
            {activeTasks.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🎉</div>
                <p className="font-game text-game-green font-bold">TOUT EST FAIT !</p>
                <p className="text-game-muted text-xs mt-1">Vous êtes des légendes 🏆</p>
              </div>
            ) : (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: "#12122a", border: "1px solid #1e1e4a" }}
              >
                {activeTasks.map((task, i) => (
                  <div key={task.id}>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <TaskCard task={task} householdId={householdId} onCompleted={handleXPGained} />
                    </motion.div>
                    {i < activeTasks.length - 1 && (
                      <div className="ml-20 h-px" style={{ background: "#1e1e4a" }} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Faire en avance (urgency ≤ 0.25, pliées) ── */}
            {earlyTasks.length > 0 && (
              <div>
                <button
                  onClick={() => setEarlyExpanded((v) => !v)}
                  className="flex items-center gap-2 w-full text-left"
                >
                  <motion.span
                    animate={{ rotate: earlyExpanded ? 90 : 0 }}
                    transition={{ duration: 0.18 }}
                    className="text-game-muted text-xs inline-block"
                  >
                    ▶
                  </motion.span>
                  <span className="text-game-muted text-xs font-semibold">
                    Faire en avance ({earlyTasks.length})
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {earlyExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      style={{ overflow: "hidden" }}
                    >
                      <div
                        className="mt-2 rounded-2xl overflow-hidden"
                        style={{ background: "#12122a", border: "1px solid #1e1e4a" }}
                      >
                        {earlyTasks.map((task, i) => (
                          <div key={task.id}>
                            <TaskCard task={task} householdId={householdId} onCompleted={handleXPGained} />
                            {i < earlyTasks.length - 1 && (
                              <div className="ml-20 h-px" style={{ background: "#1e1e4a" }} />
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ── Missions ponctuelles ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-pixel text-game-muted" style={{ fontSize: "10px" }}>
                  MISSIONS PONCTUELLES
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={{
                    background: "rgba(124,58,237,0.15)",
                    color: "#a78bfa",
                    border: "1px solid rgba(124,58,237,0.35)",
                  }}
                >
                  + AJOUTER
                </button>
              </div>

              {oneShotTasks.length === 0 ? (
                <p className="text-game-muted text-xs text-center py-5" style={{ opacity: 0.55 }}>
                  Aucune mission — ajoutez une tâche ponctuelle
                </p>
              ) : (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: "#12122a", border: "1px solid #1e1e4a" }}
                >
                  {oneShotTasks.map((task, i) => (
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
                      {i < oneShotTasks.length - 1 && (
                        <div className="ml-20 h-px" style={{ background: "#1e1e4a" }} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* ── Level up overlay ── */}
      <AnimatePresence>
        {levelUpVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
            style={{ background: "rgba(0,0,0,0.75)" }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="text-center"
            >
              <div className="text-6xl mb-4">🏆</div>
              <p className="font-pixel text-game-gold neon-gold text-lg">LEVEL UP !</p>
              <p className="font-pixel text-game-green text-sm mt-2">Niveau {profile?.level}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal ajout mission ── */}
      <AddOneShotModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={addOneShotTask}
      />
    </div>
  );
}
