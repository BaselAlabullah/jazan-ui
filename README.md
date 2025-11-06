# Jazan Dashboard Workspace

This repository now separates the client and API implementations so each stack can evolve independently while living in a single workspace.

## Directory Layout
- `frontend/` – React + Vite application (source in `src/`, static assets in `public/`, build output in `dist/`)
- `backend/` – FastAPI service along with generated data artifacts under `outputs/`
- `.venv/` – Optional local Python virtual environment (not required, but kept for convenience)

## Frontend (React + Vite)
```bash
cd frontend
npm install          # only once
npm run dev          # start the Vite dev server on http://localhost:5173
npm run build        # emit production assets into frontend/dist
```

The dev server proxies `/api` requests to the FastAPI backend. By default it targets `http://127.0.0.1:8100` (matching the default `uvicorn server:app --port 8100` we recommend), but you can override that without code changes:

The UI now talks to the API directly using an absolute URL resolver. You can control it via the following environment variables (place them in `frontend/.env.local` for convenience):

```
VITE_BACKEND_URL=https://api.example.com      # takes priority when provided
VITE_BACKEND_PROTOCOL=http                   # defaults to the current page protocol
VITE_BACKEND_HOST=127.0.0.1                  # defaults to the current page host
VITE_BACKEND_PORT=8100                       # defaults to 8100
```

For example, if your API runs on port 8000 locally:

```powershell
$env:VITE_BACKEND_PORT = 8000
npm run dev
```

In production builds the same variables can be baked in at build time to point the SPA to the correct API host.

## Backend (FastAPI)
```bash
cd backend
python -m venv .venv          # optional, create a new env if needed
.venv\Scripts\activate        # or source .venv/bin/activate on Unix
pip install -r requirements.txt
uvicorn backend.server:app --reload
```

The service reads mock artifacts from `backend/outputs/` and exposes them under `/api`. Any generated files are written back into the same directory tree.

## Automation Scripts
- `backend/update_return.py` rewrites the main dashboard return block in `frontend/src/App.jsx`. It automatically resolves the new folder structure, so you can continue running it from within the `backend` folder.
- Legacy commands such as `uvicorn server:app` or `python server.py` still succeed because small shims remain at the repository root; they simply forward to the relocated backend package.

## Notes
- Update your IDE run configurations to reference the new `frontend/` and `backend/` roots.
- Existing Git ignores (`node_modules/`, `dist/`, virtualenvs) continue to work with the relocated folders.
