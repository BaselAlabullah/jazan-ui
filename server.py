"""Compatibility entry point for the FastAPI backend.

This shim keeps the original `uvicorn server:app` invocation working after
moving the actual application into `backend/server.py`.
"""

from backend.server import app  # re-export for `uvicorn server:app`


if __name__ == "__main__":
    # Allow `python server.py` to keep working as well.
    import uvicorn

    uvicorn.run("backend.server:app", host="127.0.0.1", port=8000, reload=True)
