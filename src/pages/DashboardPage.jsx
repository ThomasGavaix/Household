import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import PlayerHUD from "@/components/PlayerHUD";
import TaskGrid from "@/components/TaskGrid";
import { motion, AnimatePresence } from "framer-motion";
import { getLevelFromXP } from "@/lib/xpUtils";

export default function DashboardPage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [partner, setPartner] = useState(null);
  const [levelUpVisible, setLevelUpVisible] = useState(false);
  const [xpFlash, setXpFlash] = useState(null);
  const [prevLevel, setPrevLevel] = useState(profile?.level ?? 1);

  // Fetch partner profile
  useEffect(() => {
    if (!profile?.household_id) return;

    async function fetchPartner() {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("household_id", profile.household_id)
        .neq("id", user.id)
        .single();
      setPartner(data ?? null);
    }
    fetchPartner();

    // Realtime: update partner profile when their XP changes
    const channel = supabase
      .channel(`partner-${profile.household_id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `household_id=eq.${profile.household_id}`,
        },
        (payload) => {
          if (payload.new.id !== user.id) {
            setPartner(payload.new);
          } else {
            // Our own profile updated — check for level up
            const newLevel = payload.new.level;
            if (newLevel > prevLevel) {
              setLevelUpVisible(true);
              setTimeout(() => setLevelUpVisible(false), 3000);
            }
            setPrevLevel(newLevel);
            refreshProfile();
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [profile?.household_id, user.id, prevLevel, refreshProfile]);

  function handleXPGained(xp) {
    setXpFlash(`+${xp} XP ⚡`);
    setTimeout(() => setXpFlash(null), 2000);
  }

  const householdId = profile?.household_id;

  return (
    <div className="min-h-screen bg-game-bg grid-bg flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-game-border">
        <div>
          <h1 className="font-pixel text-game-green neon-green text-xs leading-loose">
            HOUSEHOLD
          </h1>
          <p className="text-game-muted" style={{ fontSize: "9px" }}>
            QUEST
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* XP flash */}
          <AnimatePresence>
            {xpFlash && (
              <motion.span
                key={xpFlash + Date.now()}
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: -20 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5 }}
                className="font-pixel text-game-gold neon-gold text-xs"
              >
                {xpFlash}
              </motion.span>
            )}
          </AnimatePresence>
          <button
            onClick={signOut}
            className="text-game-muted hover:text-game-red transition-colors text-xs"
            title="Déconnexion"
          >
            ⏻
          </button>
        </div>
      </header>

      {/* Player HUD */}
      <PlayerHUD currentProfile={profile} partnerProfile={partner} />

      {/* Divider */}
      <div className="mx-4 h-px bg-game-border mb-1" />

      {/* Task grid */}
      <div className="flex-1 overflow-y-auto">
        {householdId && (
          <TaskGrid householdId={householdId} onXPGained={handleXPGained} />
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
            style={{ background: "rgba(0,0,0,0.7)" }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 10 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="text-center"
            >
              <div className="text-6xl mb-4">🏆</div>
              <p className="font-pixel text-game-gold neon-gold text-xl mb-2">
                LEVEL UP !
              </p>
              <p className="font-pixel text-game-green text-sm">
                Niveau {profile?.level}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
