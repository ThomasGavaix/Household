import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

async function runChecks(user, profile) {
  const results = [];
  const log = (label, data, error) =>
    results.push({ label, data, error: error?.message ?? null });

  // 1. Session
  const { data: session } = await supabase.auth.getSession();
  log("Session user_id", session?.session?.user?.id ?? null, null);

  // 2. Profile
  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("id, username, household_id, level, total_xp")
    .eq("id", user.id)
    .single();
  log("Profile", prof, profErr);

  // 3. task_types (all via RLS)
  const { data: allTasks, error: allErr } = await supabase
    .from("task_types")
    .select("id, name, household_id");
  log(`task_types RLS (${allTasks?.length ?? 0} lignes)`, allTasks?.map(t => `${t.name} [${t.household_id ?? "global"}]`), allErr);

  // 4. task_types global explicite
  const { data: globalTasks, error: globalErr } = await supabase
    .from("task_types")
    .select("id, name")
    .is("household_id", null);
  log(`task_types global explicite (${globalTasks?.length ?? 0})`, globalTasks?.map(t => t.name), globalErr);

  // 5. task_types custom explicite
  if (profile?.household_id) {
    const { data: customTasks, error: customErr } = await supabase
      .from("task_types")
      .select("id, name, household_id")
      .eq("household_id", profile.household_id);
    log(`task_types custom .eq(household_id) (${customTasks?.length ?? 0})`, customTasks?.map(t => t.name), customErr);
  }

  // 6. Household
  if (profile?.household_id) {
    const { data: hh, error: hhErr } = await supabase
      .from("households")
      .select("id, name, invite_code")
      .eq("id", profile.household_id)
      .single();
    log("Household", hh, hhErr);
  }

  return results;
}

export default function DebugPage() {
  const { user, profile } = useAuth();
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    const results = await runChecks(user, profile);
    setLogs(results);
    setRunning(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-game-border shrink-0 flex items-center justify-between">
        <div>
          <h1 className="font-game font-bold text-game-text text-base">🔍 Debug</h1>
          <p className="text-game-muted text-xs mt-0.5">Diagnostics Supabase</p>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="bg-game-purple text-white px-3 py-1.5 rounded-lg text-xs font-game font-bold disabled:opacity-50"
        >
          {running ? "..." : "LANCER"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-3">
        {/* Static info */}
        <div className="bg-game-card border border-game-border rounded-xl p-3 space-y-1">
          <p className="text-game-cyan text-xs font-game font-bold mb-2">CONTEXTE</p>
          <Row label="user.id" value={user?.id} />
          <Row label="profile.household_id" value={profile?.household_id} />
          <Row label="profile.username" value={profile?.username} />
          <Row label="profile.level" value={profile?.level} />
        </div>

        {/* Dynamic results */}
        {logs.map((entry, i) => (
          <div
            key={i}
            className="bg-game-card border rounded-xl p-3"
            style={{ borderColor: entry.error ? "rgba(255,59,48,0.4)" : "rgba(30,30,74,1)" }}
          >
            <p className="font-game font-bold text-xs mb-1.5" style={{ color: entry.error ? "#ff3b30" : "#00d4ff" }}>
              {entry.label}
            </p>
            {entry.error && (
              <p className="text-game-red text-xs mb-1">⚠️ {entry.error}</p>
            )}
            {entry.data === null || entry.data === undefined ? (
              <p className="text-game-muted text-xs italic">null</p>
            ) : Array.isArray(entry.data) ? (
              entry.data.length === 0
                ? <p className="text-game-muted text-xs italic">[] vide</p>
                : entry.data.map((d, j) => (
                  <p key={j} className="text-game-text text-xs font-mono">{typeof d === "object" ? JSON.stringify(d) : String(d)}</p>
                ))
            ) : (
              <p className="text-game-text text-xs font-mono">{typeof entry.data === "object" ? JSON.stringify(entry.data, null, 2) : String(entry.data)}</p>
            )}
          </div>
        ))}

        {logs.length === 0 && !running && (
          <p className="text-center text-game-muted text-xs font-game pt-10">
            Appuie sur LANCER pour diagnostiquer
          </p>
        )}
      </div>
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
