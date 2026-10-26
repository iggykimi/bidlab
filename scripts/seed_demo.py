"""Seed the local demo database. Idempotent; reset only in demo mode.

T05: applies schemas/schema.sql to a fresh DB. T07 adds the Tías seed rows.
"""

import os
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA_PATH = os.path.join(ROOT, "schemas", "schema.sql")


def storage_dir() -> str:
    d = os.environ.get("BIDLAB_STORAGE_DIR", os.path.join(ROOT, "storage"))
    return d if os.path.isabs(d) else os.path.join(ROOT, d)


def main(argv: list[str]) -> int:
    reset = "--reset" in argv
    mode = os.environ.get("BIDLAB_MODE", "demo")
    db_path = os.path.join(storage_dir(), "bidlab.sqlite3")
    if reset:
        if mode != "demo":
            print(f"refusing reset: BIDLAB_MODE={mode!r} (reset only in demo mode)",
                  file=sys.stderr)
            return 2
        for suffix in ("", "-wal", "-shm"):
            p = db_path + suffix
            if os.path.exists(p):
                os.remove(p)
                print(f"removed {p}")
    if os.path.exists(db_path) and not reset:
        print(f"exists, skip: {db_path} (use --reset in demo mode to rebuild)")
        return 0
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    with open(SCHEMA_PATH, encoding="utf-8") as f:
        schema = f.read()
    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(schema)
        conn.commit()
    finally:
        conn.close()
    print(f"seeded schema at {db_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
