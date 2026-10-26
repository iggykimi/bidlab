"""CLI wrapper around bidlab.services.seed (thin; logic lives in services).

Run with: uv run python scripts/seed_demo.py [--reset]
"""

import os
import sys
from pathlib import Path

from bidlab.services import seed as seed_service
from bidlab.settings import get_settings


def main(argv: list[str]) -> int:
    reset = "--reset" in argv
    mode = os.environ.get("BIDLAB_MODE", "demo")
    settings = get_settings()
    db_path = settings.storage_path / "bidlab.sqlite3"
    if reset:
        if mode != "demo":
            print(
                f"refusing reset: BIDLAB_MODE={mode!r} (reset only in demo mode)",
                file=sys.stderr,
            )
            return 2
        for suffix in ("", "-wal", "-shm"):
            p = Path(str(db_path) + suffix)
            if p.exists():
                p.unlink()
                print(f"removed {p}")
    seed_service.seed()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
