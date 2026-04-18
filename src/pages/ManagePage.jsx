import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const EMOJI_OPTIONS = [
  "🍽️","🧼","👕","🧺","🌀","🧹","🗑️","🛒","🚽","🛁","🍳","🌿",
  "🪟","🛏️","📦","🧴","🚿","🥘","🍞","🐾","🪴","🧽","🫧","🔧",
];

const FREQUENCY_OPTIONS = [
  { label: "Quotidien", hours: 24 },
  { label: "Tous les 2 jours", hours: 48 },
  { label: "Hebdomadaire", hours: 168 },
  { label: "2× par semaine", hours: 72 },
  { label: "Mensuel", hours: 720 },
];

function AddTaskModal({ householdId, onClose, onAdded }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📋");
  const [xp, setXp] = useState(15);
  const [freq, setFreq] = useState(48);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.from("task_types").insert({
      name: name.trim(),
      emoji,
      xp_value: xp,
      frequency_hours: freq,
      household_id: householdId,
      description: "",
      sort_order: 999,
    }).select().single();
    setLoading(false);
    if (error) { setError(`${error.message} (${error.code})`); return; }
    onAdded(data);
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-game-card border-t border-game-border rounded-t-3xl p-6 pb-10"
      >
        <div className="w-12 h-1 bg-game-border rounded-full mx-auto mb-6" />
        <h2 className="font-game font-bold text-game-text text-base mb-6">
          Nouvelle tâche
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Emoji picker */}
          <div>
            <label className="block text-xs text-game-muted mb-2 font-game tracking-wider">ICÔNE</label>
            <div className="grid grid-cols-8 gap-2">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e} type="button"
                  onClick={() => setEmoji(e)}
                  className={`text-2xl p-1.5 rounded-xl transition-all ${
                    emoji === e ? "bg-game-purple scale-110 shadow-neon-purple" : "bg-game-bg hover:bg-game-border"
                  }`}
                >
                  {e}
                </button>
              ))}
              {/* Custom emoji input */}
              <input
                type="text"
                maxLength={2}
                placeholder="✏️"
                value={EMOJI_OPTIONS.includes(emoji) ? "" : emoji}
                onChange={(e) => e.target.value && setEmoji(e.target.value)}
                className="text-xl p-1.5 rounded-xl bg-game-bg border border-game-border text-center col-span-1 text-game-text focus:outline-none focus:border-game-cyan"
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs text-game-muted mb-1 font-game tracking-wider">NOM</label>
            <input
              type="text" value={name}
              onChange={(e) => setName(e.target.value)}
              required maxLength={40}
              placeholder="Nom de la tâche"
              className="w-full bg-game-bg border border-game-border rounded-xl px-4 py-3 text-game-text placeholder-game-muted focus:outline-none focus:border-game-cyan transition-all"
            />
          </div>

          {/* XP + Fréquence */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-game-muted mb-1 font-game tracking-wider">XP</label>
              <input
                type="number" value={xp}
                onChange={(e) => setXp(Number(e.target.value))}
                min={5} max={100} step={5}
                className="w-full bg-game-bg border border-game-border rounded-xl px-4 py-3 text-game-gold font-game font-bold focus:outline-none focus:border-game-gold transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-game-muted mb-1 font-game tracking-wider">FRÉQUENCE</label>
              <select
                value={freq} onChange={(e) => setFreq(Number(e.target.value))}
                className="w-full bg-game-bg border border-game-border rounded-xl px-3 py-3 text-game-text focus:outline-none focus:border-game-cyan transition-all"
              >
                {FREQUENCY_OPTIONS.map((f) => (
                  <option key={f.hours} value={f.hours}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3" style={{ background: "rgba(255,59,48,0.15)", border: "1px solid rgba(255,59,48,0.4)" }}>
              <p className="text-game-red text-sm font-game font-semibold">⚠️ {error}</p>
            </div>
          )}

          <button
            type="submit" disabled={loading || !name.trim()}
            className="w-full py-4 bg-game-green text-game-bg font-game font-bold rounded-xl hover:shadow-neon-green transition-all disabled:opacity-50"
          >
            {loading ? "CRÉATION..." : `${emoji} AJOUTER LA TÂCHE`}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default function ManagePage() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const householdId = profile?.household_id;

  async function fetchTasks() {
    const { data } = await supabase
      .from("task_types")
      .select("*")
      .order("sort_order")
      .order("created_at", { ascending: false });
    setTasks(data ?? []);
    setLoading(false);
  }

  function handleTaskAdded(newTask) {
    if (newTask) {
      setTasks((prev) => [...prev, newTask]);
    } else {
      fetchTasks();
    }
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  async function deleteTask(id) {
    await supabase.rpc("delete_custom_task", { p_task_id: id });
    setTasks((t) => t.filter((x) => x.id !== id));
  }

  const globalTasks = tasks.filter((t) => !t.household_id);
  const customTasks = tasks.filter((t) => t.household_id);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-game-border">
        <h1 className="font-game font-bold text-game-text text-base">⚙️ Gérer les tâches</h1>
        <p className="text-game-muted text-xs mt-0.5">Crée tes propres quêtes</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 pb-24">
        {/* Custom tasks */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-game font-semibold text-game-cyan text-xs tracking-wider uppercase">
              Tâches personnalisées
            </h2>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 bg-game-purple text-white px-3 py-1.5 rounded-lg text-xs font-game font-bold shadow-neon-purple hover:shadow-neon-cyan transition-all"
            >
              + AJOUTER
            </button>
          </div>

          {customTasks.length === 0 ? (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full border-2 border-dashed border-game-border rounded-2xl py-8 text-center text-game-muted hover:border-game-purple hover:text-game-purple transition-all"
            >
              <div className="text-3xl mb-2">✨</div>
              <p className="font-game text-xs">Crée ta première tâche custom</p>
            </button>
          ) : (
            <div className="space-y-2">
              {customTasks.map((task) => (
                <TaskRow key={task.id} task={task} onDelete={() => deleteTask(task.id)} canDelete />
              ))}
            </div>
          )}
        </section>

        {/* Global tasks */}
        <section>
          <h2 className="font-game font-semibold text-game-muted text-xs tracking-wider uppercase mb-3">
            Tâches par défaut
          </h2>
          {loading ? (
            <p className="text-game-muted text-sm text-center py-4 animate-pulse font-pixel text-xs">
              CHARGEMENT...
            </p>
          ) : (
            <div className="space-y-2">
              {globalTasks.map((task) => (
                <TaskRow key={task.id} task={task} canDelete={false} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Version footer */}
      <div className="shrink-0 py-4 text-center">
        <p className="text-game-muted font-game" style={{ fontSize: "10px" }}>
          HOUSEHOLD QUEST · v{__APP_VERSION__}
        </p>
      </div>

      {/* Add modal */}
      <AnimatePresence>
        {showAdd && (
          <AddTaskModal
            householdId={householdId}
            onClose={() => setShowAdd(false)}
            onAdded={handleTaskAdded}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TaskRow({ task, onDelete, canDelete }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex items-center gap-3 bg-game-card border border-game-border rounded-2xl px-4 py-3"
    >
      <span className="text-2xl leading-none shrink-0">{task.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-game-text font-semibold text-sm truncate">{task.name}</p>
        <p className="text-game-muted text-xs">
          +{task.xp_value} XP · {task.frequency_hours >= 168
            ? `${task.frequency_hours / 168}sem`
            : task.frequency_hours >= 24
            ? `${task.frequency_hours / 24}j`
            : `${task.frequency_hours}h`}
        </p>
      </div>
      {canDelete && (
        <button
          onClick={onDelete}
          className="shrink-0 text-game-muted hover:text-game-red transition-colors p-1"
        >
          🗑️
        </button>
      )}
    </motion.div>
  );
}
