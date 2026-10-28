"""Orchestrate the TEST_STRATEGY gates. Stops at the first failure.

Usage: python scripts/verify.py [--skip-e2e]
Exit code is the first failing step's code (0 when all pass).
"""

import subprocess
import sys

STEPS: list[tuple[str, str]] = [
    ("deps-python", "uv sync --frozen --all-packages"),
    ("pytest-unit", "uv run pytest apps/api/tests/unit apps/api/tests/evaluation -q"),
    (
        "pytest-integration-contracts",
        "uv run pytest apps/api/tests/integration apps/api/tests/contracts -q",
    ),
    ("npm-lint", "npm run lint"),
    ("npm-typecheck", "npm run typecheck"),
    ("npm-build", "npm run build"),
    ("npm-test-unit", "npm run test:unit"),
    ("ruff", "uv run ruff check ."),
    ("mypy", "uv run mypy apps/api/bidlab"),
]

E2E_STEP = ("playwright-e2e", "npm run test:e2e")


def main(argv: list[str]) -> int:
    steps = list(STEPS)
    if "--skip-e2e" not in argv:
        steps.append(E2E_STEP)
    for name, cmd in steps:
        print(f"=== {name}: {cmd} ===", flush=True)
        rc = subprocess.call(cmd, shell=True)
        print(f"--- {name}: exit {rc} ---", flush=True)
        if rc != 0:
            return rc
    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
