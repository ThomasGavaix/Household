import { motion } from "framer-motion";

const TABS = [
  { id: "quests", label: "Quêtes", icon: "⚔️" },
  { id: "score", label: "Score", icon: "📊" },
  { id: "manage", label: "Gérer", icon: "⚙️" },
  { id: "debug", label: "Debug", icon: "🔍" },
];

export default function BottomNav({ active, onChange }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: "rgba(10, 10, 26, 0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex max-w-lg mx-auto h-14">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className="flex-1 flex flex-col items-center justify-center gap-1 relative"
            >
              {/* Active background pill */}
              {isActive && (
                <motion.div
                  layoutId="tab-bg"
                  className="absolute inset-x-6 inset-y-1.5 rounded-xl"
                  style={{ background: "rgba(124,58,237,0.2)" }}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}

              <span
                className="relative text-xl leading-none transition-all duration-200"
                style={{ filter: isActive ? "none" : "grayscale(0.5) opacity(0.5)" }}
              >
                {tab.icon}
              </span>
              <span
                className="relative font-game font-bold transition-colors duration-200"
                style={{
                  fontSize: "9px",
                  letterSpacing: "0.05em",
                  color: isActive ? "#7c3aed" : "#64748b",
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
