import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "⚠️ Variables Supabase manquantes. Copiez .env.example vers .env.local et renseignez vos clés."
  );
}

// Stockage cookie plutôt que localStorage — fix pour iOS PWA
// Sur iOS, localStorage est isolé par contexte mais les cookies sont partagés sur le même domaine
const cookieStorage = {
  getItem(key) {
    const cookies = document.cookie.split("; ");
    const found = cookies.find((c) => c.startsWith(`${key}=`));
    return found ? decodeURIComponent(found.split("=")[1]) : null;
  },
  setItem(key, value) {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `${key}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  },
  removeItem(key) {
    document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  },
};

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder",
  {
    auth: {
      storage: cookieStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);
