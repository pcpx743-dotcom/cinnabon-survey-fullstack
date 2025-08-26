# Cinnabon Survey — Fullstack (Render-ready)

## Tuzilishi
- `backend/` — Flask API (Postgres/SQLite), CSV eksport, admin token bilan himoyalangan.
- `frontend/` — Vite + React + Tailwind; API bilan ulanadi.

## Render’da deploy (2 ta servis)
### 1) Backend (Web Service)
1. `backend/` papkasini alohida GitHub reposiga push qiling.
2. render.com → **New** → **Web Service** → repo’ni tanlang.
3. **Build Command:** `pip install -r requirements.txt`
4. **Start Command:** `gunicorn app:app`
5. **Environment → Add Environment**:
   - `ADMIN_TOKEN` — *sirli token* (frontend `.env` dagi `VITE_ADMIN_TOKEN` bilan bir xil bo‘lsin).
   - `CORS_ORIGINS` — `*` yoki `https://sizning-frontend.onrender.com`
   - (ixtiyoriy) `DATABASE_URL` — agar Render Postgres ulasangiz, avtomatik qo‘shiladi.
6. Deploy qiling. Backend URL: `https://<backend>.onrender.com`

### 2) Frontend (Static Site)
1. `frontend/` papkasini alohida repo sifatida push qiling.
2. render.com → **New** → **Static Site**.
3. **Build Command:** `npm install && npm run build`
4. **Publish Directory:** `dist`
5. **Environment → Add:** 
   - `VITE_API_BASE_URL` = `https://<backend>.onrender.com`
   - `VITE_ADMIN_TOKEN` = backend’dagi `ADMIN_TOKEN` bilan bir xil qiymat.
6. Deploy qiling.

## Mahalliy test
- Backend: `cd backend && python app.py` (8000 port)
- Frontend: `cd frontend && npm i && npm run dev` (VITE_API_BASE_URL ni `.env` orqali 8000 ga o‘rnating)

## API
- `POST /api/v1/responses` — javob yuborish (JSON body).
- `GET /api/v1/responses` — **admin** ko‘rish (`X-Admin-Token` header kerak).
- `GET /api/v1/responses.csv` — **admin** CSV eksport (`?token=` yoki header).

Omad! 🍩
