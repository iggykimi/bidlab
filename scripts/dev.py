"""Start the BidLab API on loopback (dev). Multiplatform, no make/bash needed."""

import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main() -> int:
    host = os.environ.get("BIDLAB_BIND_HOST", "127.0.0.1")
    port = os.environ.get("BIDLAB_PORT", "8000")
    if host not in ("127.0.0.1", "localhost", "::1"):
        print(f"refusing non-loopback bind host: {host}", file=sys.stderr)
        return 2
    cmd = [
        "uv", "run", "uvicorn", "bidlab.main:app",
        "--host", host, "--port", str(port),
    ]
    print(f"starting API: {' '.join(cmd)} (cwd={ROOT})")
    return subprocess.call(cmd, cwd=ROOT)


if __name__ == "__main__":
    sys.exit(main())
