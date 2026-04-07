# P&L Dashboard — Grupo Temple

Dashboard financiero Next.js + Supabase + Vercel para Grupo Temple (TG, CDS, VA).

## Setup en 5 pasos

### 1. Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → New Project
2. Guardar las credenciales: URL del proyecto, `anon key` y `service_role key`
3. Ir a **SQL Editor** y ejecutar los dos archivos de migración en orden:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
4. Crear el usuario admin: **Authentication → Users → Invite user** (ingresá el email)
5. Asignar rol admin — en **SQL Editor**:
   ```sql
   UPDATE auth.users
   SET raw_user_meta_data = raw_user_meta_data || '{"app_role":"admin"}'
   WHERE email = 'tu@email.com';
   ```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env.local
# Editar .env.local con las credenciales de Supabase
```

### 4. Importar datos históricos (primer setup)

1. Exportar el Google Sheet (hoja P&L_RESUMEN) como CSV: **Archivo → Descargar → CSV**
2. Guardar el archivo en `scripts/data/pl-resumen.csv`
3. Ejecutar el script:
   ```bash
   npx ts-node --project tsconfig.json scripts/migrate-from-sheets.ts --year=2026
   ```

A partir de ahora, los datos nuevos se cargan desde el panel admin.

### 5. Deploy en Vercel

1. Subir el proyecto a GitHub: `git init && git add . && git commit -m "feat: initial setup" && git remote add origin <URL> && git push`
2. Ir a [vercel.com](https://vercel.com) → New Project → importar el repo
3. En **Settings → Environment Variables** agregar las mismas variables que `.env.local`
4. Deploy — cada push a `main` actualiza el dashboard automáticamente

---

## Uso diario — Cargar datos nuevos cada mes

1. Ir a `tu-app.vercel.app/admin` (requiere login de admin)
2. **Opción A — CSV completo:** Ir a "Cargar CSV", bajar el template, completar el mes nuevo, subir
3. **Opción B — Ingreso manual:** Ir a "Ingreso manual", completar empresa / mes / tipo / grupo / monto

El dashboard se actualiza automáticamente después de cada carga.

---

## Estructura del proyecto

```
src/
├── app/
│   ├── dashboard/          # Dashboard principal (Server Component)
│   ├── admin/              # Panel admin (protegido por auth)
│   │   ├── upload/         # Carga CSV
│   │   └── entry/          # Ingreso manual
│   └── login/              # Pantalla de login
├── components/
│   ├── dashboard/          # Componentes del dashboard
│   └── admin/              # Formularios del admin
├── lib/
│   ├── supabase/           # Clientes Supabase (server, client, middleware)
│   ├── data/               # Queries, tipos, estructura P&L
│   └── utils/              # Formato de números
└── styles/
    └── dashboard.css       # Todos los estilos del dashboard

supabase/
└── migrations/             # SQL para crear el schema en Supabase

scripts/
└── migrate-from-sheets.ts  # Script one-shot de migración desde Google Sheets

public/
└── templates/
    └── pl-template.csv     # Template descargable para carga de datos
```

---

## Vistas disponibles

| Vista | Descripción |
|---|---|
| Real | Datos reales |
| Presupuesto | Solo presupuesto |
| LE | Last Estimate |
| Real vs Ppto | Comparativa con delta % |
| Real vs LE | Comparativa real vs last estimate |
| LE vs Ppto | Comparativa last estimate vs presupuesto |
| YoY 2025 | Comparativa año anterior |

## Nota sobre la base de datos gratuita

Supabase pausa el proyecto tras **7 días sin actividad** (free tier). El primer acceso después de una pausa tarda ~30 segundos. Para evitarlo, podés actualizar a Pro ($25/mes) o agregar un ping programado.
