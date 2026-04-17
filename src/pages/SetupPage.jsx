import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

export default function SetupPage() {
  const { user, refreshProfile, signOut } = useAuth();
  const [step, setStep] = useState("choice"); // "choice" | "create" | "join"
  const [householdName, setHouseholdName] = useState("Notre Foyer");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [createdCode, setCreatedCode] = useState(null);

  function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const code = generateCode();
      const { data: household, error: hErr } = await supabase
        .from("households")
        .insert({ name: householdName.trim(), invite_code: code })
        .select()
        .single();
      if (hErr) throw hErr;

      const { error: pErr } = await supabase
        .from("profiles")
        .update({ household_id: household.id })
        .eq("id", user.id);
      if (pErr) throw pErr;

      setCreatedCode(code);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data: household, error: hErr } = await supabase
        .from("households")
        .select("id, name")
        .eq("invite_code", inviteCode.trim().toUpperCase())
        .single();
      if (hErr || !household) throw new Error("Code invalide");

      const { error: pErr } = await supabase
        .from("profiles")
        .update({ household_id: household.id })
        .eq("id", user.id);
      if (pErr) throw pErr;

      await refreshProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDone() {
    await refreshProfile();
  }

  return (
    <main className="min-h-screen grid-bg flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏰</div>
          <h1 className="font-pixel text-game-gold neon-gold text-sm leading-loose">
            CONFIGURE TON FOYER
          </h1>
        </div>

        <AnimatePresence mode="wait">
          {/* CHOICE */}
          {step === "choice" && (
            <motion.div
              key="choice"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="space-y-4"
            >
              <button
                onClick={() => setStep("create")}
                className="w-full p-5 bg-game-card border border-game-border rounded-xl hover:border-game-green hover:shadow-neon-green transition-all text-left group"
              >
                <div className="text-2xl mb-2">🏗️</div>
                <div className="font-game font-bold text-game-green group-hover:neon-green">
                  CRÉER UN FOYER
                </div>
                <div className="text-game-muted text-sm mt-1">
                  Créez votre espace et invitez votre partenaire
                </div>
              </button>

              <button
                onClick={() => setStep("join")}
                className="w-full p-5 bg-game-card border border-game-border rounded-xl hover:border-game-cyan hover:shadow-neon-cyan transition-all text-left group"
              >
                <div className="text-2xl mb-2">🔗</div>
                <div className="font-game font-bold text-game-cyan">
                  REJOINDRE UN FOYER
                </div>
                <div className="text-game-muted text-sm mt-1">
                  Entrez le code d&apos;invitation de votre partenaire
                </div>
              </button>

              <button
                onClick={signOut}
                className="w-full py-2 text-game-muted text-sm hover:text-game-text transition-colors"
              >
                Se déconnecter
              </button>
            </motion.div>
          )}

          {/* CREATE */}
          {step === "create" && !createdCode && (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="bg-game-card border border-game-border rounded-xl p-6"
            >
              <button
                onClick={() => setStep("choice")}
                className="text-game-muted text-sm mb-4 hover:text-game-text flex items-center gap-1"
              >
                ← Retour
              </button>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs text-game-muted mb-1 font-game tracking-wider">
                    NOM DU FOYER
                  </label>
                  <input
                    type="text"
                    value={householdName}
                    onChange={(e) => setHouseholdName(e.target.value)}
                    required
                    maxLength={30}
                    className="w-full bg-game-bg border border-game-border rounded-lg px-4 py-3 text-game-text focus:outline-none focus:border-game-green transition-all"
                  />
                </div>
                {error && (
                  <p className="text-game-red text-sm">⚠️ {error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-game-green text-game-bg font-game font-bold text-sm rounded-xl hover:shadow-neon-green transition-all disabled:opacity-50"
                >
                  {loading ? "CRÉATION..." : "🏗️ CRÉER"}
                </button>
              </form>
            </motion.div>
          )}

          {/* INVITE CODE REVEALED */}
          {step === "create" && createdCode && (
            <motion.div
              key="code"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-game-card border border-game-green rounded-xl p-6 text-center shadow-neon-green"
            >
              <div className="text-3xl mb-3">🎉</div>
              <p className="text-game-muted text-sm mb-4">
                Partagez ce code avec votre partenaire
              </p>
              <div className="bg-game-bg border border-game-border rounded-xl p-4 mb-6">
                <p className="font-pixel text-game-green neon-green text-2xl tracking-[0.3em]">
                  {createdCode}
                </p>
              </div>
              <button
                onClick={handleDone}
                className="w-full py-4 bg-game-purple text-white font-game font-bold text-sm rounded-xl shadow-neon-purple hover:shadow-neon-cyan transition-all"
              >
                ▶ COMMENCER
              </button>
            </motion.div>
          )}

          {/* JOIN */}
          {step === "join" && (
            <motion.div
              key="join"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="bg-game-card border border-game-border rounded-xl p-6"
            >
              <button
                onClick={() => setStep("choice")}
                className="text-game-muted text-sm mb-4 hover:text-game-text flex items-center gap-1"
              >
                ← Retour
              </button>
              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <label className="block text-xs text-game-muted mb-1 font-game tracking-wider">
                    CODE D&apos;INVITATION (6 caractères)
                  </label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    required
                    maxLength={6}
                    placeholder="ABC123"
                    className="w-full bg-game-bg border border-game-border rounded-lg px-4 py-3 text-game-text text-center font-pixel text-lg tracking-[0.3em] focus:outline-none focus:border-game-cyan transition-all"
                  />
                </div>
                {error && (
                  <p className="text-game-red text-sm">⚠️ {error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading || inviteCode.length !== 6}
                  className="w-full py-4 bg-game-cyan text-game-bg font-game font-bold text-sm rounded-xl hover:shadow-neon-cyan transition-all disabled:opacity-50"
                >
                  {loading ? "CONNEXION..." : "🔗 REJOINDRE"}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}
