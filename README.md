# Rieck Glow Days & Nights — Deploy Unificado

## Estructura
```
/                    → Landing page estática (landing.html)
/reservar            → Wizard de reserva (Next.js)
/login               → Login / buscar reserva (Next.js)
/panel               → Panel admin/afiliado/cliente (Next.js)
/eventos.html        → Página de eventos (estática)
/partners.html       → Programa partners (estática)
/api/*               → APIs de reservas, admin, webhooks (Next.js)
```

## Deploy en Vercel

### 1. Subir a GitHub
```bash
git init
git add .
git commit -m "Rieck SaaS v5 - deploy unificado"
git remote add origin https://github.com/TU_USUARIO/rieck-glow-days.git
git push -u origin main
```

### 2. Conectar en Vercel
- Ir a vercel.com → New Project → Import desde GitHub
- Framework: **Next.js** (se autodetecta)
- Root Directory: **./** (raíz)

### 3. Variables de entorno (configurar en Vercel)
```
NEXT_PUBLIC_SUPABASE_URL=https://dvspbqrqubcndqyitdac.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_KEY=tu_service_role_key
```

### 4. SQL en Supabase
Ejecutar en orden en el SQL Editor de Supabase:
1. `schema.sql` (si es primera vez)
2. `schema-update-v3.sql`
3. `schema-update-v4.sql`
4. `schema-update-v5.sql`

### 5. Desactivar RLS para testing
```sql
ALTER TABLE packages DISABLE ROW LEVEL SECURITY;
ALTER TABLE package_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE discount_packs DISABLE ROW LEVEL SECURITY;
ALTER TABLE date_schedule_overrides DISABLE ROW LEVEL SECURITY;
```

## Stack
- Next.js 14 + Tailwind CSS v4
- Supabase (PostgreSQL + Auth)
- Vercel (hosting)
- Mercado Pago (pendiente)

## Admin
- Email: cafe@gmail.com (role='admin' en tabla users)
