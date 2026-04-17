import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUrgency,
  getUrgencyColor,
  getUrgencyLabel,
  formatTimeAgo,
} from "@/lib/xpUtils";
import XPGainPopup from "./XPGainPopup";

export default function TaskCard({ task, householdId, onCompleted }) {
  const { user } = useAuth();
  const [completing, setCompleting] = useState(false);
  const [showXP, setShowXP] = useState(false);
  const [justDone, setJustDone] = useState(false);

  const urgency = getUrgency(task.last_completed_at, task.frequency_hours);
  const urgencyColor = getUrgencyColor(urgency);
  const urgencyLabel = getUrgencyLabel(urgency);
  const timeAgo = formatTimeAgo(task.last_completed_at);
  const isOverdue = urgency >= 1;

  async function handleComplete() {
    if (completing) return;
    setCompleting(true);
    try {
      await supabase.from("task_completions").insert({
        task_type_id: task.id,
        household_id: householdId,
        completed_by: user.id,
        xp_earned: task.xp_value,
      });
      setShowXP(true);
      setJustDone(true);
      setTimeout(() => setShowXP(false), 1000);
      setTimeout(() => setJustDone(false), 3000);
      if (onCompleted) onCompleted(task.id, task.xp_value);
    } catch (err) {
      console.error("Erreur complétion tâche:", err);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <motion.button
      onClick={handleComplete}
      disabled={completing}
      whileTap={{ scale: 0.93 }}
      className={`relative w-full aspect-square flex flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-all duration-300 overflow-hidden select-none ${
        justDone
          ? "border-game-green bg-green-900/20"
          : "bg-game-card active:bg-game-border"
      }`}
      style={{
        borderColor: justDone ? "#00ff88" : urgencyColor,
        boxShadow: justDone
          ? "0 0 20px rgba(0,255,136,0.4)"
          : isOverdue
          ? `0 0 15px ${urgencyColor}55, inset 0 0 15px ${urgencyColor}11`
          : `0 0 6px ${urgencyColor}33`,
      }}
    >
      {/* XP badge */}
      <div
        className="absolute top-2 right-2 text-xs font-game font-bold px-1.5 py-0.5 rounded-md"
        style={{ color: "#f59e0b", background: "rgba(245,158,11,0.15)" }}
      >
        +{task.xp_value}
      </div>

      {/* Urgency badge */}
      {urgency >= 0.5 && (
        <div
          className="absolute top-2 left-2 text-xs font-game font-bold"
          style={{ color: urgencyColor, fontSize: "8px" }}
        >
          {urgencyLabel}
        </div>
      )}

      {/* Emoji */}
      <motion.div
        animate={isOverdue && !justDone ? { scale: [1, 1.1, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.5 }}
        className="text-4xl leading-none"
      >
        {justDone ? "✅" : task.emoji}
      </motion.div>

      {/* Task name */}
      <div className="text-xs font-ui font-semibold text-game-text text-center px-2 leading-tight">
        {task.name}
      </div>

      {/* Last done */}
      <div className="text-game-muted text-center px-1" style={{ fontSize: "9px" }}>
        {task.last_completed_username ? (
          <>
            {task.last_completed_avatar} {task.last_completed_username}
            <br />
            {timeAgo}
          </>
        ) : (
          <span style={{ color: urgencyColor }}>Jamais fait</span>
        )}
      </div>

      {/* Pulse ring for overdue */}
      {isOverdue && !justDone && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{ opacity: [0, 0.3, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          style={{ border: `2px solid ${urgencyColor}` }}
        />
      )}

      {/* XP popup */}
      <AnimatePresence>
        {showXP && <XPGainPopup xp={task.xp_value} visible />}
      </AnimatePresence>

      {/* Completing overlay */}
      {completing && (
        <div className="absolute inset-0 bg-game-bg/60 flex items-center justify-center rounded-2xl">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
            className="text-2xl"
          >
            ⚙️
          </motion.div>
        </div>
      )}
    </motion.button>
  );
}
