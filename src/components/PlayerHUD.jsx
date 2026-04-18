import { useState } from "react";
import { getLevelTitle, getXPProgress, getXPToNextLevel } from "@/lib/xpUtils";
import { motion, AnimatePresence } from "framer-motion";

function InviteSlot({ inviteCode }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!inviteCode) return;
    navigator.clipboard?.writeText(inviteCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="flex-1 bg-game-card border border-dashed border-game-border rounded-xl p-3 flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
      style={{ minHeight: 72 }}
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.div key="copied" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }} className="text-center">
            <p className="text-game-green text-xs font-game font-bold">✓ Copié !</p>
            <p className="text-game-green font-mono font-bold" style={{ fontSize: "13px" }}>{inviteCode}</p>
          </motion.div>
        ) : (
          <motion.div key="invite" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }} className="text-center">
            <p className="text-game-muted text-xs font-game">+ Inviter</p>
            {inviteCode && (
              <p className="text-game-muted font-mono font-bold" style={{ fontSize: "13px" }}>{inviteCode}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

function PlayerCard({ profile, isCurrentUser }) {
  if (!profile) return null;

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

export default function PlayerHUD({ currentProfile, partnerProfile, inviteCode }) {
  return (
    <div className="flex gap-2 px-4 pt-3 pb-2">
      <PlayerCard profile={currentProfile} isCurrentUser />
      {partnerProfile
        ? <PlayerCard profile={partnerProfile} isCurrentUser={false} />
        : <InviteSlot inviteCode={inviteCode} />}
    </div>
  );
}
