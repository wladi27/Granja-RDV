# GRV - Granja Raiz de Vida

Repositorio con dos aplicaciones:

- backend: API NestJS con reglas de negocio base.
- frontend: interfaz NextJS para dashboard y flujo inicial.

## Levantar backend

1. cd backend
2. npm run start:dev
3. API disponible en http://localhost:3002/api

## Levantar frontend

1. cd frontend
2. set NEXT_PUBLIC_API_URL=http://localhost:3002/api
3. npm run dev
4. Web disponible en http://localhost:3000

## Endpoints actuales

- POST /api/auth/register
- GET /api/catalog/products
- GET /api/users/:id/dashboard
- POST /api/orders
- PATCH /api/orders/:id/confirm-payment
- PATCH /api/orders/:id/confirm
- PATCH /api/orders/:id/assign-courier
- PATCH /api/orders/:id/courier-status
- GET /api/config
- PATCH /api/config

## Reglas implementadas en esta base

- Registro con sponsorCode opcional.
- Configuracion dinamica de niveles de comision y gracia.
- Membresia por corte mensual con extension en periodo de gracia.
- Pago mixto usando billetera y metodo externo.
- Delivery con evidencia obligatoria al estado delivered.
- Comisiones por niveles para patrocinadores activos al momento de entrega.

## Despliegue en Vercel

Este repo se despliega como 2 proyectos separados en Vercel:

- frontend (Next.js): `frontend/`
- backend (NestJS serverless): `backend/`

### 1) Frontend en Vercel

1. En Vercel crea un proyecto nuevo desde este repo.
2. En `Root Directory` selecciona `frontend`.
3. Build command: `npm run build`.
4. Output: automático (Next.js).
5. Variables de entorno:
	- `NEXT_PUBLIC_API_URL=https://TU_BACKEND.vercel.app/api`

### 2) Backend en Vercel

1. En Vercel crea otro proyecto desde el mismo repo.
2. En `Root Directory` selecciona `backend`.
3. Este proyecto usa `backend/vercel.json` y función `backend/api/index.ts`.
4. Variables de entorno (mínimas obligatorias):
	- `CORS_ORIGIN=https://TU_FRONTEND.vercel.app`
	- `DATABASE_URL`
	- `DB_HOST`
	- `DB_PORT`
	- `DB_NAME`
	- `DB_USER`
	- `DB_PASSWORD`
	- `DB_SSL=true` (recomendado en producción)
	- `JWT_ACCESS_SECRET`
	- `JWT_REFRESH_SECRET`
5. Puedes tomar el resto desde `backend/.env.example`.

Nota: en producción conviene usar Postgres gestionado (Neon/Supabase/Railway/Render DB) y pooling compatible con serverless.

## Subir a GitHub

En terminal (desde la raíz del repo):

```bash
git init
git add .
git commit -m "chore: prepare monorepo for vercel backend/frontend deployment"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

Si `origin` ya existe:

```bash
git remote set-url origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```
