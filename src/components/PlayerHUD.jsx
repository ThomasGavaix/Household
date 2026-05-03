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

function PlayerCard({ profile, isCurrentUser, isActive, onSelect }) {
  if (!profile) return null;

  const progress = getXPProgress(profile.total_xp, profile.level);
  const toNext = getXPToNextLevel(profile.total_xp, profile.level);
  const title = getLevelTitle(profile.level);
  const baseColor = isCurrentUser ? "#7c3aed" : "#00d4ff";
  const color = isActive ? "#00ff88" : baseColor;

  return (
    <button
      onClick={onSelect}
      className="flex-1 bg-game-card border rounded-xl p-3 transition-all text-left active:scale-95"
      style={{
        borderColor: isActive ? "rgba(0,255,136,0.5)" : `${baseColor}44`,
        boxShadow: isActive ? "0 0 14px rgba(0,255,136,0.2)" : "none",
        opacity: isActive ? 1 : 0.65,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl leading-none">{profile.avatar_emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="font-game font-bold text-xs truncate" style={{ color }}>
            {profile.username}
          </p>
          <p className="truncate" style={{ fontSize: "9px", color: isActive ? "rgba(0,255,136,0.7)" : "#64748b" }}>
            {isActive ? "● actif" : title}
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
        <span className="text-game-muted" style={{ fontSize: "8px" }}>{profile.total_xp} XP</span>
        <span className="text-game-muted" style={{ fontSize: "8px" }}>+{toNext} → Lv.{profile.level + 1}</span>
      </div>
    </button>
  );
}

export default function PlayerHUD({ currentProfile, partnerProfile, inviteCode, activeUserId, onSwitchActive }) {
  return (
    <div className="flex gap-2 px-4 pt-3 pb-2">
      <PlayerCard
        profile={currentProfile}
        isCurrentUser
        isActive={activeUserId === currentProfile?.id}
        onSelect={() => onSwitchActive?.(currentProfile?.id)}
      />
      {partnerProfile ? (
        <PlayerCard
          profile={partnerProfile}
          isCurrentUser={false}
          isActive={activeUserId === partnerProfile?.id}
          onSelect={() => onSwitchActive?.(partnerProfile?.id)}
        />
      ) : (
        <InviteSlot inviteCode={inviteCode} />
      )}
    </div>
  );
}
