"""Reset the demo DB (demo mode only) and start the API. Usage: demo.py --reset-demo."""

import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main(argv: list[str]) -> int:
    os.environ.setdefault("BIDLAB_MODE", "demo")
    seed_cmd = ["uv", "run", "python", os.path.join(ROOT, "scripts", "seed_demo.py")]
    if "--reset-demo" in argv:
        rc = subprocess.call([*seed_cmd, "--reset"], cwd=ROOT)
        if rc != 0:
            return rc
    else:
        rc = subprocess.call(seed_cmd, cwd=ROOT)
        if rc != 0:
            return rc
    return subprocess.call([sys.executable, os.path.join(ROOT, "scripts", "dev.py")], cwd=ROOT)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
