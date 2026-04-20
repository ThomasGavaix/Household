import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatTimeAgo } from "@/lib/xpUtils";

export default function ScorePage() {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [weekStats, setWeekStats] = useState({});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const householdId = profile?.household_id;

  const fetchData = useCallback(async () => {
    if (!householdId) return;
    setLoading(true);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: profilesData }, { data: weekData }, { data: historyData }] = await Promise.all([
      supabase.from("profiles").select("id, username, avatar_emoji, level, total_xp").eq("household_id", householdId),
      supabase.from("task_completions").select("completed_by, xp_earned").eq("household_id", householdId).gte("completed_at", weekAgo),
      supabase.from("task_completions")
        .select("id, completed_at, xp_earned, completed_by, task_type_id, task_types(name, emoji)")
        .eq("household_id", householdId)
        .order("completed_at", { ascending: false })
        .limit(30),
    ]);

    // Weekly stats per user
    const stats = {};
    (weekData ?? []).forEach((c) => {
      if (!stats[c.completed_by]) stats[c.completed_by] = { xp: 0, count: 0 };
      stats[c.completed_by].xp += c.xp_earned;
      stats[c.completed_by].count++;
    });
    setWeekStats(stats);

    // Enrich history with profile info
    const profileMap = {};
    (profilesData ?? []).forEach((p) => { profileMap[p.id] = p; });
    const enrichedHistory = (historyData ?? []).map((c) => ({
      ...c,
      profile: profileMap[c.completed_by],
    }));

    setProfiles(profilesData ?? []);
    setHistory(enrichedHistory);
    setLoading(false);
  }, [householdId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalWeekXP = Object.values(weekStats).reduce((s, v) => s + v.xp, 0);
  const sorted = [...profiles].sort((a, b) => (weekStats[b.id]?.xp ?? 0) - (weekStats[a.id]?.xp ?? 0));
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-game-border shrink-0">
        <h1 className="font-game font-bold text-game-text text-base">📊 Score</h1>
        <p className="text-game-muted text-xs mt-0.5">Cette semaine · {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-5">
        {loading ? (
          <p className="text-center font-pixel text-game-green text-xs py-10 animate-pulse">CHARGEMENT...</p>
        ) : (
          <>
            {/* Leaderboard */}
            <section>
              <h2 className="font-game font-semibold text-game-cyan text-xs tracking-wider uppercase mb-3">
                CLASSEMENT DE LA SEMAINE
              </h2>
              {sorted.length === 0 ? (
                <p className="text-game-muted text-xs text-center py-4">Aucune complétion cette semaine</p>
              ) : (
                <div className="space-y-2">
                  {sorted.map((p, i) => {
                    const stat = weekStats[p.id] ?? { xp: 0, count: 0 };
                    const pct = totalWeekXP > 0 ? stat.xp / totalWeekXP : 0;
                    const color = i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : "#a78bfa";
                    return (
                      <div key={p.id} className="bg-game-card border border-game-border rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg">{medals[i] ?? "·"}</span>
                          <span className="text-xl">{p.avatar_emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-game font-bold text-sm truncate" style={{ color }}>
                              {p.username}
                            </p>
                            <p className="text-game-muted text-xs">{stat.count} tâche{stat.count > 1 ? "s" : ""} · Lv.{p.level}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-game font-bold text-sm" style={{ color }}>{stat.xp} XP</p>
                            <p className="text-game-muted text-xs">{Math.round(pct * 100)}%</p>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="bg-game-bg rounded-full h-1.5 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct * 100}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* All-time total */}
            {profiles.length > 0 && (
              <section>
                <h2 className="font-game font-semibold text-game-muted text-xs tracking-wider uppercase mb-3">
                  TOTAL ALL-TIME
                </h2>
                <div className="flex gap-2">
                  {[...profiles].sort((a, b) => b.total_xp - a.total_xp).map((p) => (
                    <div key={p.id} className="flex-1 bg-game-card border border-game-border rounded-xl px-3 py-2 text-center">
                      <p className="text-xl">{p.avatar_emoji}</p>
                      <p className="font-game font-bold text-xs text-game-text mt-1 truncate">{p.username}</p>
                      <p className="font-game font-bold text-xs mt-0.5" style={{ color: "#f59e0b" }}>{p.total_xp} XP</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* History */}
            <section>
              <h2 className="font-game font-semibold text-game-cyan text-xs tracking-wider uppercase mb-3">
                HISTORIQUE
              </h2>
              {history.length === 0 ? (
                <p className="text-game-muted text-xs text-center py-4">Aucune complétion enregistrée</p>
              ) : (
                <div className="rounded-2xl overflow-hidden" style={{ background: "#12122a", border: "1px solid #1e1e4a" }}>
                  {history.map((c, i) => (
                    <div key={c.id}>
                      <div className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-xl shrink-0">{c.task_types?.emoji ?? "✅"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-game-text text-xs font-semibold truncate">{c.task_types?.name ?? "Tâche"}</p>
                          <p className="text-game-muted text-xs truncate">
                            {c.profile?.avatar_emoji} {c.profile?.username} · {formatTimeAgo(c.completed_at)}
                          </p>
                        </div>
                        <span className="font-game text-xs shrink-0" style={{ color: "#f59e0b" }}>+{c.xp_earned}</span>
                      </div>
                      {i < history.length - 1 && <div className="ml-14 h-px" style={{ background: "#1e1e4a" }} />}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
