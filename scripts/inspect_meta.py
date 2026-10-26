"""Show Meta/effective configuration status. Never prints secret values."""

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
META_BASE_URL = "https://api.meta.ai/v1"


def load_dotenv(path: str) -> dict[str, str]:
    values: dict[str, str] = {}
    if not os.path.exists(path):
        return values
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip().strip("'\"")
    return values


def main() -> int:
    file_values = load_dotenv(os.path.join(ROOT, ".env"))

    def get(key: str, default: str = "") -> str:
        return os.environ.get(key, file_values.get(key, default))

    mode = get("BIDLAB_MODE", "demo")
    model = get("META_MODEL", "muse-spark-1.3")
    key_present = bool(get("MODEL_API_KEY", ""))
    print(f"mode={mode}")
    print(f"bind={get('BIDLAB_BIND_HOST', '127.0.0.1')}:{get('BIDLAB_PORT', '8000')}")
    print(f"storage={get('BIDLAB_STORAGE_DIR', './storage')}")
    print(f"history_enabled={get('BIDLAB_HISTORY_ENABLED', 'false')}")
    print(f"meta_budget_usd={get('BIDLAB_META_BUDGET_USD', '20.00')}")
    print(f"meta_base_url={META_BASE_URL}")
    print(f"meta_model={model}")
    print(f"model_key_present={'yes' if key_present else 'no'}")
    print(f"live_ready={'yes' if (mode == 'live' and key_present) else 'no'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
