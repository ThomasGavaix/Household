import { getLevelTitle, getXPProgress, getXPToNextLevel } from "@/lib/xpUtils";
import { motion } from "framer-motion";

function PlayerCard({ profile, isCurrentUser }) {
  if (!profile) {
    return (
      <div className="flex-1 bg-game-card border border-game-border rounded-xl p-3 opacity-50">
        <div className="text-center">
          <div className="text-2xl mb-1">❓</div>
          <p className="text-game-muted text-xs font-game">EN ATTENTE</p>
          <p className="text-game-muted" style={{ fontSize: "9px" }}>
            Partage le code d&apos;invitation
          </p>
        </div>
      </div>
    );
  }

  const progress = getXPProgress(profile.total_xp, profile.level);
  const toNext = getXPToNextLevel(profile.total_xp, profile.level);
  const title = getLevelTitle(profile.level);
  const color = isCurrentUser ? "#7c3aed" : "#00d4ff";
  const shadow = isCurrentUser
    ? "0 0 10px rgba(124,58,237,0.4)"
    : "0 0 10px rgba(0,212,255,0.4)";

  return (
    <div
      className="flex-1 bg-game-card border rounded-xl p-3 transition-all"
      style={{ borderColor: color, boxShadow: shadow }}
    >
      {/* Avatar + name */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl leading-none">{profile.avatar_emoji}</span>
        <div className="min-w-0">
          <p
            className="font-game font-bold text-xs truncate"
            style={{ color }}
          >
            {profile.username}
            {isCurrentUser && (
              <span className="ml-1 text-game-muted font-normal"> (toi)</span>
            )}
          </p>
          <p className="text-game-muted truncate" style={{ fontSize: "9px" }}>
            {title}
          </p>
        </div>
        {/* Level badge */}
        <div
          className="ml-auto text-xs font-pixel font-bold shrink-0"
          style={{ color }}
        >
          Lv.{profile.level}
        </div>
      </div>

      {/* XP bar */}
      <div className="bg-game-bg rounded-full h-2 overflow-hidden">
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
          {toNext} → Lv.{profile.level + 1}
        </span>
      </div>
    </div>
  );
}

export default function PlayerHUD({ currentProfile, partnerProfile }) {
  return (
    <div className="flex gap-3 px-4 pt-4 pb-2">
      <PlayerCard profile={currentProfile} isCurrentUser />
      <div className="flex items-center justify-center shrink-0">
        <span className="font-pixel text-game-muted text-xs">VS</span>
      </div>
      <PlayerCard profile={partnerProfile} isCurrentUser={false} />
    </div>
  );
}
