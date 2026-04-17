import { motion } from "framer-motion";

export default function XPGainPopup({ xp, visible }) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -60, scale: 1.3 }}
      transition={{ duration: 0.9, ease: "easeOut" }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
    >
      <div className="font-pixel text-game-gold neon-gold text-sm whitespace-nowrap">
        +{xp} XP ⚡
      </div>
    </motion.div>
  );
}
