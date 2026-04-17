import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { getUrgency } from "@/lib/xpUtils";
import TaskCard from "./TaskCard";
import { motion } from "framer-motion";

export default function TaskGrid({ householdId, onXPGained }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    // Fetch all task types
    const { data: taskTypes } = await supabase
      .from("task_types")
      .select("*")
      .order("sort_order");

    if (!taskTypes) return;

    // Fetch latest completion per task_type for this household
    const { data: completions } = await supabase
      .from("task_completions_latest")
      .select("*")
      .eq("household_id", householdId);

    const completionMap = {};
    (completions || []).forEach((c) => {
      completionMap[c.task_type_id] = c;
    });

    const enriched = taskTypes.map((t) => {
      const c = completionMap[t.id];
      return {
        ...t,
        last_completed_at: c?.completed_at ?? null,
        last_completed_by: c?.completed_by ?? null,
        last_completed_username: c?.username ?? null,
        last_completed_avatar: c?.avatar_emoji ?? null,
        urgency: getUrgency(c?.completed_at ?? null, t.frequency_hours),
      };
    });

    // Sort by urgency desc (most urgent first)
    enriched.sort((a, b) => b.urgency - a.urgency);
    setTasks(enriched);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Realtime: listen for new completions in this household
  useEffect(() => {
    const channel = supabase
      .channel(`household-${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "task_completions",
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [householdId, fetchTasks]);

  function handleCompleted(taskId, xp) {
    fetchTasks();
    if (onXPGained) onXPGained(xp);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="font-pixel text-game-green text-xs animate-pulse">
          CHARGEMENT DES QUÊTES...
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="font-game font-bold text-game-text uppercase tracking-wider text-sm">
          ⚔️ Quêtes du jour
        </h2>
        <div className="flex-1 h-px bg-game-border" />
        <span className="text-game-muted text-xs">
          {tasks.filter((t) => t.urgency >= 1).length} en retard
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-3">
        {tasks.map((task, i) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, type: "spring", stiffness: 300 }}
          >
            <TaskCard
              task={task}
              householdId={householdId}
              onCompleted={handleCompleted}
            />
          </motion.div>
        ))}
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-10">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-game-green font-game text-sm">TOUT EST FAIT !</p>
          <p className="text-game-muted text-xs mt-1">
            Vous êtes des légendes 🏆
          </p>
        </div>
      )}
    </div>
  );
}
