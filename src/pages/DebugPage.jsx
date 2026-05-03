import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const TEST_EMOJIS = ["🤖", "👾", "🦊", "🐼", "🦁", "🐸", "🦄", "🎭"];

// ── Diagnostics ──────────────────────────────────────────────────────────────
async function runChecks(user, profile) {
  const results = [];
  const log = (label, data, error) =>
    results.push({ label, data, error: error?.message ?? null });

  const { data: session } = await supabase.auth.getSession();
  log("Session user_id", session?.session?.user?.id ?? null, null);

  const { data: prof, error: profErr } = await supabase
    .from("profiles").select("id, username, household_id, level, total_xp").eq("id", user.id).single();
  log("Profile", prof, profErr);

  const { data: allTasks, error: allErr } = await supabase.from("task_types").select("id, name");
  log(`task_types (${allTasks?.length ?? 0})`, allTasks?.map((t) => t.name), allErr);

  if (profile?.household_id) {
    const { data: hh, error: hhErr } = await supabase
      .from("households").select("id, name, invite_code").eq("id", profile.household_id).single();
    log("Household", hh, hhErr);

    const { data: members, error: membersErr } = await supabase
      .from("profiles").select("id, username, avatar_emoji, level, total_xp").eq("household_id", profile.household_id);
    log(`Membres du foyer (${members?.length ?? 0})`, members?.map((m) => `${m.avatar_emoji} ${m.username} lv.${m.level}`), membersErr);
  }

  return results;
}

// ── Debug Page ────────────────────────────────────────────────────────────────
export default function DebugPage() {
  const { user, profile, proxyUserId, setProxyUserId } = useAuth();
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);

  // ── Household members for proxy sim ──
  const [members, setMembers] = useState([]);
  useEffect(() => {
    if (!profile?.household_id) return;
    supabase.from("profiles").select("id, username, avatar_emoji, level, total_xp")
      .eq("household_id", profile.household_id)
      .then(({ data }) => setMembers(data ?? []));
  }, [profile?.household_id]);

  // ── Create test account ──
  const [testName, setTestName] = useState("TestBot");
  const [testEmoji, setTestEmoji] = useState("🤖");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState(null);

  async function createTestUser() {
    if (!profile?.household_id) return;
    setCreating(true);
    setCreateMsg(null);

    // Fetch invite code
    const { data: hh } = await supabase.from("households")
      .select("invite_code").eq("id", profile.household_id).single();
    if (!hh?.invite_code) {
      setCreateMsg({ ok: false, text: "Impossible de récupérer le code du foyer." });
      setCreating(false);
      return;
    }

    // Save current session
    const { data: { session: currentSession } } = await supabase.auth.getSession();

    // Sign up as test user
    const ts = Date.now();
    const testEmail = `debug-${ts}@household-test.com`;
    const testPass = `Test${ts}!`;
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: testEmail,
      password: testPass,
      options: { data: { username: testName.trim() || "TestBot", avatar_emoji: testEmoji } },
    });

    if (signUpErr || !signUpData.user) {
      setCreateMsg({ ok: false, text: signUpErr?.message ?? "Échec de la création." });
      // Restore original session
      if (currentSession) await supabase.auth.setSession({ access_token: currentSession.access_token, refresh_token: currentSession.refresh_token });
      setCreating(false);
      return;
    }

    // While logged in as test user: join the household
    await supabase.rpc("join_household", { p_invite_code: hh.invite_code });

    // Restore original session
    await supabase.auth.setSession({
      access_token: currentSession.access_token,
      refresh_token: currentSession.refresh_token,
    });

    // Refresh members list
    const { data: updated } = await supabase.from("profiles").select("id, username, avatar_emoji, level, total_xp")
      .eq("household_id", profile.household_id);
    setMembers(updated ?? []);

    setCreateMsg({ ok: true, text: `${testEmoji} ${testName} créé et ajouté au foyer.` });
    setCreating(false);
  }

  async function run() {
    setRunning(true);
    setLogs(await runChecks(user, profile));
    setRunning(false);
  }

  async function clearCustomTasks() {
    if (!profile?.household_id) return;
    if (!confirm("Supprimer TOUTES les tâches custom du foyer ?")) return;
    const { error } = await supabase.from("task_types").delete().eq("household_id", profile.household_id);
    if (error) alert("Erreur : " + error.message);
    else run();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-game-border shrink-0">
        <h1 className="font-game font-bold text-game-text text-base">🔍 Debug</h1>
        <p className="text-game-muted text-xs mt-0.5">Outils de test et diagnostics</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 space-y-4">

        {/* ── Simuler un profil ── */}
        <Section title="SIMULER UN PROFIL" color="#00d4ff">
          <p className="text-game-muted text-xs mb-3 font-game">
            Les actions (complétions, claims) seront enregistrées pour ce profil.
          </p>
          {proxyUserId && proxyUserId !== user?.id && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl mb-3"
              style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.3)" }}>
              <p className="font-game text-xs" style={{ color: "#00d4ff" }}>
                🔄 Simulation active
              </p>
              <button onClick={() => setProxyUserId(null)}
                className="font-game text-xs px-2 py-1 rounded-lg"
                style={{ background: "rgba(100,116,139,0.2)", color: "#94a3b8" }}>
                Désactiver
              </button>
            </div>
          )}
          <div className="space-y-2">
            {members.map((m) => {
              const isMe = m.id === user?.id;
              const isActive = (proxyUserId ?? user?.id) === m.id;
              return (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: isActive ? "rgba(0,255,136,0.06)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isActive ? "rgba(0,255,136,0.25)" : "rgba(30,30,74,1)"}`,
                  }}>
                  <span className="text-2xl leading-none">{m.avatar_emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-game font-bold text-xs text-game-text truncate">
                      {m.username} {isMe && <span style={{ color: "#64748b" }}>(moi)</span>}
                    </p>
                    <p className="text-game-muted" style={{ fontSize: "9px" }}>
                      Lv.{m.level} · {m.total_xp} XP
                    </p>
                  </div>
                  {isActive ? (
                    <span className="font-game text-xs px-2 py-1 rounded-lg shrink-0"
                      style={{ background: "rgba(0,255,136,0.12)", color: "#00ff88" }}>
                      Actif
                    </span>
                  ) : (
                    <button
                      onClick={() => setProxyUserId(m.id)}
                      className="font-game text-xs px-2 py-1 rounded-lg shrink-0 transition-all active:scale-95"
                      style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.3)" }}>
                      Simuler
                    </button>
                  )}
                </div>
              );
            })}
            {members.length === 0 && (
              <p className="text-game-muted text-xs font-game text-center py-2">Aucun membre trouvé</p>
            )}
          </div>
        </Section>

        {/* ── Créer un compte test ── */}
        <Section title="CRÉER UN COMPTE TEST" color="#a78bfa">
          <p className="text-game-muted text-xs mb-3 font-game">
            Crée un vrai compte Supabase et l'ajoute au foyer. La session courante est restaurée automatiquement.
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {TEST_EMOJIS.map((e) => (
              <button key={e} onClick={() => setTestEmoji(e)}
                className="text-xl p-2 rounded-xl transition-all active:scale-95"
                style={{ background: testEmoji === e ? "rgba(167,139,250,0.25)" : "rgba(255,255,255,0.04)", border: testEmoji === e ? "1px solid rgba(167,139,250,0.5)" : "1px solid transparent" }}>
                {e}
              </button>
            ))}
          </div>
          <input
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            placeholder="Nom du compte test"
            maxLength={20}
            className="w-full bg-game-bg border border-game-border rounded-xl px-3 py-2.5 text-sm text-game-text placeholder-game-muted focus:outline-none mb-3"
            style={{ borderColor: "rgba(30,30,74,1)" }}
          />
          {createMsg && (
            <p className="text-xs font-game mb-2" style={{ color: createMsg.ok ? "#00ff88" : "#ef4444" }}>
              {createMsg.ok ? "✓" : "⚠️"} {createMsg.text}
            </p>
          )}
          <button
            onClick={createTestUser}
            disabled={creating || !testName.trim()}
            className="w-full font-game font-bold text-sm py-3 rounded-xl transition-all active:scale-95 disabled:opacity-40"
            style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}>
            {creating ? "Création en cours..." : `Créer ${testEmoji} ${testName || "..."}`}
          </button>
          <p className="text-game-muted text-xs mt-2 font-game" style={{ fontSize: "9px" }}>
            ⚠️ Nécessite que la confirmation email soit désactivée dans Supabase Auth
          </p>
        </Section>

        {/* ── Diagnostics ── */}
        <Section title="DIAGNOSTICS" color="#00d4ff"
          actions={
            <div className="flex gap-2">
              <button onClick={clearCustomTasks}
                className="font-game text-xs px-2 py-1.5 rounded-lg"
                style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
                🗑️ RESET
              </button>
              <button onClick={run} disabled={running}
                className="font-game font-bold text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
                style={{ background: "rgba(124,58,237,0.25)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.4)" }}>
                {running ? "..." : "LANCER"}
              </button>
            </div>
          }>
          <div className="space-y-1 mb-3">
            <Row label="user.id" value={user?.id} />
            <Row label="household_id" value={profile?.household_id} />
            <Row label="username" value={profile?.username} />
            <Row label="level" value={profile?.level} />
            <Row label="proxy actif" value={proxyUserId ? proxyUserId : "—"} />
          </div>
          {logs.map((entry, i) => (
            <div key={i} className="rounded-xl p-3 mb-2"
              style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${entry.error ? "rgba(239,68,68,0.3)" : "rgba(30,30,74,1)"}` }}>
              <p className="font-game font-bold text-xs mb-1" style={{ color: entry.error ? "#ef4444" : "#00d4ff" }}>
                {entry.label}
              </p>
              {entry.error && <p className="text-xs mb-1" style={{ color: "#ef4444" }}>⚠️ {entry.error}</p>}
              {entry.data == null ? (
                <p className="text-game-muted text-xs italic">null</p>
              ) : Array.isArray(entry.data) ? (
                entry.data.length === 0 ? <p className="text-game-muted text-xs italic">[] vide</p>
                  : entry.data.map((d, j) => (
                    <p key={j} className="text-game-text text-xs font-mono">{typeof d === "object" ? JSON.stringify(d) : String(d)}</p>
                  ))
              ) : (
                <p className="text-game-text text-xs font-mono">
                  {typeof entry.data === "object" ? JSON.stringify(entry.data, null, 2) : String(entry.data)}
                </p>
              )}
            </div>
          ))}
          {logs.length === 0 && !running && (
            <p className="text-center text-game-muted text-xs font-game py-4">Appuie sur LANCER pour diagnostiquer</p>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, color = "#00d4ff", actions, children }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#12122a", border: "1px solid #1e1e4a" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#1e1e4a" }}>
        <p className="font-game font-bold text-xs tracking-wider" style={{ color }}>{title}</p>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-game-muted font-game shrink-0">{label}:</span>
      <span className="text-game-text font-mono truncate">{value ?? "—"}</span>
    </div>
  );
}
