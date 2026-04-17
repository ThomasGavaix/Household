# Secrets GitHub requis

À ajouter dans **Settings → Secrets and variables → Actions** du repo.

## Supabase (migrations automatiques)

| Secret | Où le trouver |
|--------|--------------|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens |
| `SUPABASE_PROJECT_ID` | Supabase → Settings → General → Reference ID |

## Build Vercel

| Secret | Où le trouver |
|--------|--------------|
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API → Publishable key |

> Les variables `VITE_*` sont aussi à ajouter dans **Vercel → Project → Settings → Environment Variables**.
