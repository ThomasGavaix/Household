import { getLevelTitle, getXPProgress, getXPToNextLevel } from "@/lib/xpUtils";
import { motion } from "framer-motion";

function PlayerCard({ profile, isCurrentUser }) {
  if (!profile) {
    return (
      <div
        className="flex-1 bg-game-card border border-dashed border-game-border rounded-xl p-3 flex items-center justify-center"
        style={{ minHeight: 72 }}
      >
        <div className="text-center">
          <p className="text-game-muted text-xs font-game">+ Inviter</p>
          <p className="text-game-muted" style={{ fontSize: "9px" }}>
            partage le code foyer
          </p>
        </div>
      </div>
    );
  }

  const progress = getXPProgress(profile.total_xp, profile.level);
  const toNext = getXPToNextLevel(profile.total_xp, profile.level);
  const title = getLevelTitle(profile.level);
  const color = isCurrentUser ? "#7c3aed" : "#00d4ff";

  return (
    <div
      className="flex-1 bg-game-card border rounded-xl p-3 transition-all"
      style={{ borderColor: `${color}66` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl leading-none">{profile.avatar_emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="font-game font-bold text-xs truncate" style={{ color }}>
            {profile.username}
          </p>
          <p className="text-game-muted truncate" style={{ fontSize: "9px" }}>
            {title}
          </p>
        </div>
        <div className="text-xs font-pixel font-bold shrink-0" style={{ color }}>
          Lv.{profile.level}
        </div>
      </div>

      <div className="bg-game-bg rounded-full h-1.5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-game-muted" style={{ fontSize: "8px" }}>
          {profile.total_xp} XP
        </span>
        <span className="text-game-muted" style={{ fontSize: "8px" }}>
          +{toNext} → Lv.{profile.level + 1}
        </span>
      </div>
    </div>
  );
}

export default function PlayerHUD({ currentProfile, partnerProfile }) {
  return (
    <div className="flex gap-2 px-4 pt-3 pb-2">
      <PlayerCard profile={currentProfile} isCurrentUser />
      <PlayerCard profile={partnerProfile} isCurrentUser={false} />
    </div>
  );
}
