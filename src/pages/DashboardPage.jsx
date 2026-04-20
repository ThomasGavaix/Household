import { useState, useEffect, useCallback } from "react";
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

const ONESHOT_EMOJIS = [
  "⭐","🛒","💊","🐶","🌿","📦","🔧","🪟","🚗","📞","🎁","🧾",
];

const XP_OPTIONS = [5, 10, 20, 50, 100];

// ── Task Card — style Waze incident iOS ─────────────────────
function TaskCard({ task, householdId, onCompleted }) {
  const { user } = useAuth();
  const [completing, setCompleting] = useState(false);
  const [showXP, setShowXP] = useState(false);
  const [justDone, setJustDone] = useState(false);

  const urgency = getUrgency(task.last_completed_at, task.frequency_hours);
  const urgencyColor = justDone ? "#00ff88" : getUrgencyColor(urgency);
  const isOverdue = urgency >= 1;

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
      {/* Waze-style incident icon (cercle coloré) */}
      <div
        className="relative shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
        style={{
          background: justDone
            ? "rgba(0,255,136,0.15)"
            : `${urgencyColor}18`,
          border: `1.5px solid ${urgencyColor}44`,
          boxShadow: isOverdue && !justDone ? `0 0 16px ${urgencyColor}33` : "none",
        }}
      >
        <motion.span
          animate={isOverdue && !justDone ? { scale: [1, 1.15, 1] } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          {justDone ? "✅" : task.emoji}
        </motion.span>

        {/* Pastille urgence */}
        {urgency >= 0.75 && !justDone && (
          <div
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-game-bg"
            style={{ background: urgencyColor }}
          />
        )}

        {/* XP popup */}
        <AnimatePresence>
          {showXP && <XPGainPopup xp={task.xp_value} visible />}
        </AnimatePresence>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-game-text font-semibold text-sm leading-tight truncate">
          {task.name}
        </p>
        <p className="text-game-muted text-xs mt-0.5 truncate">
          {task.last_completed_username
            ? `${task.last_completed_avatar} ${task.last_completed_username} · ${formatTimeAgo(task.last_completed_at)}`
            : <span style={{ color: urgencyColor }}>Jamais fait</span>}
        </p>
      </div>

      {/* Right: XP + chevron */}
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

// ── One-shot task row ─────────────────────────────────────────
function OneShotCard({ task, onClaimed, onXPGained }) {
  const { user } = useAuth();
  const [claiming, setClaiming] = useState(false);
  const [showXP, setShowXP] = useState(false);
  const isClaimed = !!task.claimed_by;
  const isMineClaimed = task.claimed_by === user.id;

  async function handleClaim() {
    if (claiming || isClaimed) return;
    setClaiming(true);
    try {
      const { error } = await supabase
        .from("oneshot_tasks")
        .update({ claimed_by: user.id, completed_at: new Date().toISOString() })
        .eq("id", task.id);
      if (error) throw error;
      setShowXP(true);
      setTimeout(() => setShowXP(false), 1000);
      onXPGained?.(task.xp_value);
      onClaimed?.();
    } catch (err) {
      console.error(err);
    } finally {
      setClaiming(false);
    }
  }

  return (
    <motion.button
      onClick={handleClaim}
      disabled={claiming || isClaimed}
      whileTap={isClaimed ? {} : { scale: 0.98, opacity: 0.85 }}
      className="relative w-full flex items-center gap-3 text-left overflow-hidden px-4 py-3.5"
      style={{ WebkitTapHighlightColor: "transparent", opacity: isClaimed ? 0.55 : 1 }}
    >
      <div
        className="relative shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
        style={{
          background: isMineClaimed ? "rgba(0,255,136,0.15)" : "rgba(139,92,246,0.12)",
          border: `1.5px solid ${isMineClaimed ? "#00ff8844" : "#8b5cf644"}`,
        }}
      >
        {isMineClaimed ? "✅" : task.emoji}
        <AnimatePresence>
          {showXP && <XPGainPopup xp={task.xp_value} visible />}
        </AnimatePresence>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-game-text font-semibold text-sm leading-tight truncate">
          {task.name}
        </p>
        <p className="text-game-muted text-xs mt-0.5">
          {isClaimed
            ? <span style={{ color: "#00ff88" }}>Fait · {formatTimeAgo(task.completed_at)}</span>
            : "À faire"}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className="font-game font-bold px-2 py-0.5 rounded-lg"
          style={{ color: "#f59e0b", background: "rgba(245,158,11,0.12)", fontSize: "10px" }}
        >
          +{task.xp_value}
        </span>
        {!isClaimed && <span className="text-game-muted text-xs">›</span>}
      </div>
    </motion.button>
  );
}

// ── Add one-shot modal ────────────────────────────────────────
function AddOneShotModal({ householdId, onClose, onAdded }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("⭐");
  const [xp, setXp] = useState(20);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("oneshot_tasks").insert({
        household_id: householdId,
        created_by: user.id,
        name: name.trim(),
        emoji,
        xp_value: xp,
      });
      if (error) throw error;
      onAdded();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-game-card border-t border-game-border rounded-t-3xl p-6 pb-10"
      >
        <div className="w-12 h-1 bg-game-border rounded-full mx-auto mb-6" />
        <h2 className="font-game font-bold text-game-text text-base mb-6">
          Nouvelle tâche ponctuelle
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Emoji picker */}
          <div>
            <label className="block text-xs text-game-muted mb-2 font-game tracking-wider">ICÔNE</label>
            <div className="flex gap-2 flex-wrap">
              {ONESHOT_EMOJIS.map((e) => (
                <button
                  key={e} type="button"
                  onClick={() => setEmoji(e)}
                  className={`text-2xl p-1.5 rounded-xl transition-all ${
                    emoji === e ? "bg-game-purple scale-110 shadow-neon-purple" : "bg-game-bg hover:bg-game-border"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs text-game-muted mb-1 font-game tracking-wider">NOM</label>
            <input
              type="text" value={name}
              onChange={(e) => setName(e.target.value)}
              required maxLength={40}
              placeholder="Nom de la tâche"
              className="w-full bg-game-bg border border-game-border rounded-xl px-4 py-3 text-game-text placeholder-game-muted focus:outline-none focus:border-game-cyan transition-all"
            />
          </div>

          {/* XP buttons */}
          <div>
            <label className="block text-xs text-game-muted mb-2 font-game tracking-wider">XP</label>
            <div className="flex gap-2">
              {XP_OPTIONS.map((v) => (
                <button
                  key={v} type="button"
                  onClick={() => setXp(v)}
                  className={`flex-1 py-2 rounded-xl font-game font-bold text-sm transition-all ${
                    xp === v
                      ? "bg-game-gold text-game-bg shadow-neon-gold"
                      : "bg-game-bg text-game-gold border border-game-border hover:border-game-gold"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit" disabled={loading || !name.trim()}
            className="w-full py-4 bg-game-green text-game-bg font-game font-bold rounded-xl hover:shadow-neon-green transition-all disabled:opacity-50"
          >
            {loading ? "AJOUT..." : `${emoji} Ajouter`}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Grouped task list ─────────────────────────────────────────
function TaskGroup({ tasks, householdId, onCompleted }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "#12122a", border: "1px solid #1e1e4a" }}
    >
      {tasks.map((task, i) => (
        <div key={task.id}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.03 }}
          >
            <TaskCard
              task={task}
              householdId={householdId}
              onCompleted={onCompleted}
            />
          </motion.div>
          {i < tasks.length - 1 && (
            <div className="ml-20 h-px" style={{ background: "#1e1e4a" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [partner, setPartner] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [levelUpVisible, setLevelUpVisible] = useState(false);
  const [xpFlash, setXpFlash] = useState(null);
  const [prevLevel, setPrevLevel] = useState(profile?.level ?? 1);
  const [earlyOpen, setEarlyOpen] = useState(false);
  const [oneShotTasks, setOneShotTasks] = useState([]);
  const [showAddOneShot, setShowAddOneShot] = useState(false);

  const householdId = profile?.household_id;

  // ── Fetch periodic tasks ──
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
        last_completed_at: c?.completed_at ?? null,
        last_completed_by: c?.completed_by ?? null,
        last_completed_username: c?.username ?? null,
        last_completed_avatar: c?.avatar_emoji ?? null,
        urgency: getUrgency(c?.completed_at ?? null, t.frequency_hours),
      };
    });

    enriched.sort((a, b) => b.urgency - a.urgency);
    setTasks(enriched);
    setLoadingTasks(false);
  }, [householdId]);

  // ── Fetch one-shot tasks ──
  const fetchOneShotTasks = useCallback(async () => {
    if (!householdId) return;
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("oneshot_tasks")
      .select("*")
      .eq("household_id", householdId)
      .or(`completed_at.is.null,completed_at.gte.${since24h}`)
      .order("created_at", { ascending: false });
    setOneShotTasks(data ?? []);
  }, [householdId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useEffect(() => { fetchOneShotTasks(); }, [fetchOneShotTasks]);

  // ── Fetch partner ──
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

  // ── Realtime completions ──
  useEffect(() => {
    if (!householdId) return;
    const ch = supabase
      .channel(`completions-${householdId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "task_completions",
        filter: `household_id=eq.${householdId}`,
      }, () => fetchTasks())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [householdId, fetchTasks]);

  // ── Realtime one-shot tasks ──
  useEffect(() => {
    if (!householdId) return;
    const ch = supabase
      .channel(`oneshot-${householdId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "oneshot_tasks",
        filter: `household_id=eq.${householdId}`,
      }, () => fetchOneShotTasks())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [householdId, fetchOneShotTasks]);

  // ── Realtime profiles ──
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

  function handleXPGained(xp) {
    setXpFlash(`+${xp} XP ⚡`);
    setTimeout(() => setXpFlash(null), 2000);
  }

  const overdueCount = tasks.filter((t) => t.urgency >= 1).length;
  const activeTasks = tasks.filter((t) => t.urgency > 0.25);
  const earlyTasks = tasks.filter((t) => t.urgency <= 0.25);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-game-border shrink-0">
        <div>
          <h1 className="font-pixel text-game-green neon-green" style={{ fontSize: "10px" }}>
            HOUSEHOLD QUEST
          </h1>
          <p className="text-game-muted" style={{ fontSize: "10px" }}>
            v{__APP_VERSION__}
            {overdueCount > 0 && (
              <span className="text-game-red ml-2">
                · {overdueCount} en retard
              </span>
            )}
          </p>
        </div>
        <AnimatePresence>
          {xpFlash && (
            <motion.span
              key={Date.now()}
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

      {/* Player HUD */}
      <div className="shrink-0">
        <PlayerHUD currentProfile={profile} partnerProfile={partner} />
      </div>

      <div className="mx-4 h-px bg-game-border shrink-0" />

      {/* Task list */}
      <div className="flex-1 overflow-y-auto pb-24">
        {loadingTasks ? (
          <p className="text-center font-pixel text-game-green text-xs py-10 animate-pulse">
            CHARGEMENT DES QUÊTES...
          </p>
        ) : (
          <div className="px-4 py-3 space-y-4">
            {/* ── Periodic tasks ── */}
            {activeTasks.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-3">🎉</div>
                <p className="font-game text-game-green font-bold">TOUT EST FAIT !</p>
                <p className="text-game-muted text-xs mt-1">Vous êtes des légendes 🏆</p>
              </div>
            ) : (
              <TaskGroup
                tasks={activeTasks}
                householdId={householdId}
                onCompleted={handleXPGained}
              />
            )}

            {/* ── Early tasks (collapsed) ── */}
            {earlyTasks.length > 0 && (
              <div>
                <button
                  onClick={() => setEarlyOpen((o) => !o)}
                  className="w-full flex items-center gap-2 text-game-muted text-xs font-game py-1 hover:text-game-text transition-colors"
                >
                  <motion.span
                    animate={{ rotate: earlyOpen ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="inline-block"
                  >
                    ▶
                  </motion.span>
                  Faire en avance ({earlyTasks.length})
                </button>
                <AnimatePresence>
                  {earlyOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden mt-2"
                    >
                      <TaskGroup
                        tasks={earlyTasks}
                        householdId={householdId}
                        onCompleted={handleXPGained}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ── One-shot tasks ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-game font-semibold text-game-cyan text-xs tracking-wider uppercase">
                  Tâches ponctuelles
                </h2>
                <button
                  onClick={() => setShowAddOneShot(true)}
                  className="flex items-center gap-1 bg-game-purple text-white px-3 py-1.5 rounded-lg text-xs font-game font-bold shadow-neon-purple hover:shadow-neon-cyan transition-all"
                >
                  + AJOUTER
                </button>
              </div>

              {oneShotTasks.length > 0 ? (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: "#12122a", border: "1px solid #1e1e4a" }}
                >
                  {oneShotTasks.map((task, i) => (
                    <div key={task.id}>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <OneShotCard
                          task={task}
                          onClaimed={fetchOneShotTasks}
                          onXPGained={handleXPGained}
                        />
                      </motion.div>
                      {i < oneShotTasks.length - 1 && (
                        <div className="ml-20 h-px" style={{ background: "#1e1e4a" }} />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setShowAddOneShot(true)}
                  className="w-full border-2 border-dashed border-game-border rounded-2xl py-6 text-center text-game-muted hover:border-game-purple hover:text-game-purple transition-all"
                >
                  <div className="text-2xl mb-1">✨</div>
                  <p className="font-game text-xs">Ajoute une tâche ponctuelle</p>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Level up overlay */}
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
              <p className="font-pixel text-game-green text-sm mt-2">
                Niveau {profile?.level}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add one-shot modal */}
      <AnimatePresence>
        {showAddOneShot && (
          <AddOneShotModal
            householdId={householdId}
            onClose={() => setShowAddOneShot(false)}
            onAdded={fetchOneShotTasks}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
