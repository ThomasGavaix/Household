import { motion } from "framer-motion";

const TABS = [
  { id: "quests", label: "Quêtes", icon: "⚔️" },
  { id: "manage", label: "Gérer", icon: "⚙️" },
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-game-bg border-t border-game-border safe-area-bottom">
      <div className="flex max-w-lg mx-auto">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className="flex-1 flex flex-col items-center gap-1 py-3 relative transition-colors"
            >
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute top-0 left-4 right-4 h-0.5 rounded-full"
                  style={{ background: "#7c3aed" }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="text-xl leading-none">{tab.icon}</span>
              <span
                className={`text-xs font-game font-semibold tracking-wider transition-colors ${
                  isActive ? "text-game-purple" : "text-game-muted"
                }`}
                style={{ fontSize: "9px" }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
