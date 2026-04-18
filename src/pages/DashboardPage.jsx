import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import PlayerHUD from "@/components/PlayerHUD";
import XPGainPopup from "@/components/XPGainPopup";
import {
  getUrgency,
  getUrgencyColor,
  getUrgencyLabel,
  formatTimeAgo,
} from "@/lib/xpUtils";

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

// ── One-shot task card ───────────────────────────────────────
const ONE_SHOT_EMOJIS = ["📋","📬","🏛️","🧾","💊","🔑","🛠️","🎁","📞","🗂️","🚗","✈️"];

function OneShotCard({ task, onComplete, onDelete }) {
  const [completing, setCompleting] = useState(false);
  const [showXP, setShowXP] = useState(false);

  async function handleComplete() {
    if (completing) return;
    setCompleting(true);
    setShowXP(true);
    setTimeout(() => setShowXP(false), 900);
    setTimeout(() => onComplete(task), 1000);
  }

  return (
    <motion.div
      layout
      exit={{ opacity: 0, x: 40 }}
      className="flex items-center gap-3 px-4 py-3"
    >
      <button
        onClick={handleComplete}
        disabled={completing}
        className="relative shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all active:scale-90"
        style={{ background: completing ? "rgba(0,255,136,0.15)" : "rgba(124,58,237,0.12)", border: `1.5px solid ${completing ? "#00ff88" : "#7c3aed"}44` }}
      >
        {completing ? "✅" : task.emoji}
        <AnimatePresence>{showXP && <XPGainPopup xp={task.xp_value} visible />}</AnimatePresence>
      </button>
      <p className="flex-1 text-game-text text-sm font-semibold truncate">{task.name}</p>
      <span className="font-game text-xs shrink-0" style={{ color: "#f59e0b" }}>+{task.xp_value}</span>
      <button onClick={() => onDelete(task.id)} className="shrink-0 text-game-muted hover:text-game-red transition-colors text-sm ml-1">×</button>
    </motion.div>
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
  const [oneShotTasks, setOneShotTasks] = useState([]);
  const [showAddOneShot, setShowAddOneShot] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📋");

  const householdId = profile?.household_id;

  // ── Fetch tasks ──
  const fetchTasks = useCallback(async () => {
    if (!householdId) return;

    const { data: taskTypes } = await supabase
      .from("task_types")
      .select("*")
      .order("sort_order");

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

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── One-shot tasks ──
  const fetchOneShotTasks = useCallback(async () => {
    if (!householdId) return;
    const { data, error } = await supabase
      .from("one_shot_tasks")
      .select("*")
      .eq("household_id", householdId)
      .is("completed_at", null)
      .order("created_at");
    if (!error) setOneShotTasks(data ?? []);
  }, [householdId]);

  useEffect(() => { fetchOneShotTasks(); }, [fetchOneShotTasks]);

  async function addOneShotTask() {
    if (!newName.trim()) return;
    const { data, error } = await supabase
      .from("one_shot_tasks")
      .insert({ name: newName.trim(), emoji: newEmoji, xp_value: 15, household_id: householdId })
      .select().single();
    if (!error && data) {
      setOneShotTasks((prev) => [...prev, data]);
      setNewName("");
      setNewEmoji("📋");
      setShowAddOneShot(false);
    }
  }

  async function completeOneShotTask(task) {
    await supabase.from("one_shot_tasks")
      .update({ completed_at: new Date().toISOString(), completed_by: user.id })
      .eq("id", task.id);
    setOneShotTasks((prev) => prev.filter((t) => t.id !== task.id));
    handleXPGained(task.xp_value);
  }

  async function deleteOneShotTask(id) {
    await supabase.from("one_shot_tasks").delete().eq("id", id);
    setOneShotTasks((prev) => prev.filter((t) => t.id !== id));
  }

  // ── Fetch partner + invite code ──
  const [inviteCode, setInviteCode] = useState(null);
  useEffect(() => {
    if (!householdId) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("household_id", householdId)
      .neq("id", user.id)
      .single()
      .then(({ data }) => setPartner(data ?? null));
    supabase
      .from("households")
      .select("invite_code")
      .eq("id", householdId)
      .single()
      .then(({ data }) => setInviteCode(data?.invite_code ?? null));
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
        <PlayerHUD currentProfile={profile} partnerProfile={partner} inviteCode={inviteCode} />
      </div>

      <div className="mx-4 h-px bg-game-border shrink-0" />

      {/* Task list */}
      <div className="flex-1 overflow-y-auto pb-24">
        {loadingTasks ? (
          <p className="text-center font-pixel text-game-green text-xs py-10 animate-pulse">
            CHARGEMENT DES QUÊTES...
          </p>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🎉</div>
            <p className="font-game text-game-green font-bold">TOUT EST FAIT !</p>
            <p className="text-game-muted text-xs mt-1">Vous êtes des légendes 🏆</p>
          </div>
        ) : (
          /* Grouped list iOS style */
          <div className="px-4 py-3">
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
                      onCompleted={handleXPGained}
                    />
                  </motion.div>
                  {/* iOS-style separator (pas sur le dernier) */}
                  {i < tasks.length - 1 && (
                    <div className="ml-20 h-px" style={{ background: "#1e1e4a" }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Quêtes uniques ── */}
        <div className="px-4 pt-2 pb-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-game font-semibold text-xs tracking-wider uppercase" style={{ color: "#f59e0b" }}>
              À FAIRE
            </h2>
            <button
              onClick={() => setShowAddOneShot((v) => !v)}
              className="font-game font-bold text-xs px-2 py-1 rounded-lg transition-all"
              style={{ color: "#f59e0b", background: "rgba(245,158,11,0.12)" }}
            >
              {showAddOneShot ? "✕" : "+ AJOUTER"}
            </button>
          </div>

          {/* Formulaire rapide */}
          <AnimatePresence>
            {showAddOneShot && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-3"
              >
                <div className="rounded-2xl p-3 space-y-2" style={{ background: "#12122a", border: "1px solid #1e1e4a" }}>
                  {/* Emoji picker */}
                  <div className="flex flex-wrap gap-1.5">
                    {ONE_SHOT_EMOJIS.map((e) => (
                      <button key={e} onClick={() => setNewEmoji(e)}
                        className="text-lg p-1 rounded-lg transition-all"
                        style={{ background: newEmoji === e ? "rgba(245,158,11,0.25)" : "transparent" }}
                      >{e}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addOneShotTask()}
                      placeholder="Nom de la quête..."
                      maxLength={50}
                      className="flex-1 bg-game-bg border border-game-border rounded-xl px-3 py-2 text-sm text-game-text placeholder-game-muted focus:outline-none focus:border-game-gold"
                    />
                    <button
                      onClick={addOneShotTask}
                      disabled={!newName.trim()}
                      className="font-game font-bold text-xs px-3 py-2 rounded-xl disabled:opacity-40"
                      style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}
                    >
                      OK
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Liste */}
          {oneShotTasks.length > 0 ? (
            <div className="rounded-2xl overflow-hidden" style={{ background: "#12122a", border: "1px solid #1e1e4a" }}>
              <AnimatePresence>
                {oneShotTasks.map((task, i) => (
                  <div key={task.id}>
                    <OneShotCard
                      task={task}
                      onComplete={completeOneShotTask}
                      onDelete={deleteOneShotTask}
                    />
                    {i < oneShotTasks.length - 1 && (
                      <div className="ml-16 h-px" style={{ background: "#1e1e4a" }} />
                    )}
                  </div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            !showAddOneShot && (
              <p className="text-game-muted text-xs text-center py-3 font-game">
                Aucune quête en cours
              </p>
            )
          )}
        </div>
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
    </div>
  );
}
