import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

const AVATAR_OPTIONS = ["🦸", "🧙", "🥷", "🧝", "🧛", "🤖", "👾", "🐉"];

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("🦸");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // App.jsx will redirect automatically via auth state change
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.user) {
          setSuccess("Vérifiez votre email pour confirmer votre compte !");
          return;
        }
        await supabase.from("profiles").insert({
          id: data.user.id,
          username: username.trim(),
          avatar_emoji: avatar,
        });
        // App.jsx will redirect to /setup automatically
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Stars */}
      {Array.from({ length: 25 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-0.5 h-0.5 rounded-full bg-white"
          style={{
            left: `${(i * 37 + 7) % 100}%`,
            top: `${(i * 53 + 13) % 100}%`,
            opacity: 0.1 + (i % 5) * 0.1,
            animation: `pulse ${2 + (i % 3)}s ease-in-out infinite`,
            animationDelay: `${(i * 0.3) % 3}s`,
          }}
        />
      ))}

      {/* Corner labels */}
      <div className="absolute top-4 left-4 text-game-green opacity-30 font-pixel text-xs pointer-events-none">
        v1.0
      </div>
      <div className="absolute top-4 right-4 text-game-green opacity-30 font-pixel text-xs pointer-events-none">
        PWA
      </div>

      {/* Logo */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.6 }}
        className="mb-10 text-center"
      >
        <div className="text-6xl mb-5">🏠</div>
        <h1 className="font-pixel text-game-green neon-green text-lg leading-loose">
          HOUSEHOLD
        </h1>
        <h2 className="font-pixel text-game-cyan neon-cyan text-lg leading-loose">
          QUEST
        </h2>
        <p className="text-game-muted text-sm mt-3">
          Gérez vos corvées. Gagnez de l&apos;XP. ⚔️
        </p>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="w-full max-w-sm bg-game-card border border-game-border rounded-2xl p-6"
      >
        {/* Tabs */}
        <div className="flex mb-6 border border-game-border rounded-lg overflow-hidden">
          {["login", "register"].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); }}
              className={`flex-1 py-3 text-xs font-game font-semibold uppercase tracking-wider transition-all ${
                mode === m
                  ? "bg-game-purple text-white shadow-neon-purple"
                  : "text-game-muted hover:text-game-text"
              }`}
            >
              {m === "login" ? "Connexion" : "Inscription"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence>
            {mode === "register" && (
              <motion.div
                key="reg"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 overflow-hidden"
              >
                {/* Username */}
                <div>
                  <label className="block text-xs text-game-muted mb-1 font-game tracking-wider">
                    PSEUDO
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required={mode === "register"}
                    maxLength={20}
                    placeholder="TonPseudo"
                    className="w-full bg-game-bg border border-game-border rounded-lg px-4 py-3 text-game-text placeholder-game-muted focus:outline-none focus:border-game-cyan transition-all"
                  />
                </div>

                {/* Avatar */}
                <div>
                  <label className="block text-xs text-game-muted mb-2 font-game tracking-wider">
                    TON HÉROS
                  </label>
                  <div className="grid grid-cols-8 gap-1.5">
                    {AVATAR_OPTIONS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setAvatar(e)}
                        className={`text-xl p-1 rounded-lg transition-all ${
                          avatar === e
                            ? "bg-game-purple scale-110 shadow-neon-purple"
                            : "bg-game-bg hover:bg-game-border"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email */}
          <div>
            <label className="block text-xs text-game-muted mb-1 font-game tracking-wider">
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="hero@household.quest"
              className="w-full bg-game-bg border border-game-border rounded-lg px-4 py-3 text-game-text placeholder-game-muted focus:outline-none focus:border-game-cyan transition-all"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs text-game-muted mb-1 font-game tracking-wider">
              MOT DE PASSE
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              className="w-full bg-game-bg border border-game-border rounded-lg px-4 py-3 text-game-text placeholder-game-muted focus:outline-none focus:border-game-cyan transition-all"
            />
          </div>

          {/* Messages */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-game-red text-sm bg-red-900/20 border border-game-red/30 rounded-lg px-3 py-2"
              >
                ⚠️ {error}
              </motion.p>
            )}
            {success && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-game-green text-sm bg-green-900/20 border border-game-green/30 rounded-lg px-3 py-2"
              >
                ✅ {success}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-game-purple rounded-xl font-game font-bold text-sm uppercase tracking-widest text-white shadow-neon-purple hover:bg-game-cyan hover:text-game-bg hover:shadow-neon-cyan transition-all duration-200 disabled:opacity-50"
          >
            {loading
              ? "⚙️ CHARGEMENT..."
              : mode === "login"
              ? "▶ DÉMARRER"
              : "⚔️ CRÉER MON HÉROS"}
          </button>
        </form>
      </motion.div>

      <p className="mt-8 text-game-muted text-xs font-pixel opacity-40">
        INSERT COIN TO CONTINUE
      </p>
    </main>
  );
}
