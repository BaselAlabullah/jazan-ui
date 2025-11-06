"""Compatibility shim for the historical update_return helper.

The implementation now lives in `backend/update_return.py`, but some scripts
and documentation may still invoke this module from the repository root.
"""

from backend.update_return import *  # noqa: F401,F403
