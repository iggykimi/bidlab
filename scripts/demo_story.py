"""Export four real engine runs and a comparison from an isolated demo DB.

Usage: uv run python scripts/demo_story.py --output test-results/demo-story
No external provider, no user's storage, no invented extraction run.
"""

import argparse
import copy
import datetime as dt
import json
import os
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


def _write(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def export_story(output: Path) -> None:
    # A fresh process is intentional: settings/engine caches never point at a
    # user's running database. Do not import this helper into the API process.
    with tempfile.TemporaryDirectory(prefix="bidlab-demo-story-") as storage:
        os.environ["BIDLAB_STORAGE_DIR"] = storage
        os.environ["BIDLAB_MODE"] = "demo"
        os.environ["MODEL_API_KEY"] = ""
        os.environ["META_API_KEY"] = ""
        from bidlab.main import app
        from fastapi.testclient import TestClient

        output.mkdir(parents=True, exist_ok=True)
        base = json.loads((ROOT / "examples/evaluation_request.json").read_text(encoding="utf-8"))
        base["pricing_rule_id"] = "tias-price-r1"
        headers = {"X-BidLab-Client": "local-ui"}
        cases = [
            ("01-mismos-puntos-10", "Mismos puntos · rebaja 10 %", "0.1000", True),
            ("02-mismos-puntos-15", "Mismos puntos · rebaja 15 %", "0.1500", True),
            ("03-beneficio-y-alerta", "Rebaja 30 % · revisar consecuencias", "0.3000", True),
            ("04-faltan-datos", "Conjunto incompleto · puntos sin determinar", "0.1000", False),
        ]
        saved: dict[str, str] = {}
        records = []
        with TestClient(app) as client:
            demo = client.post(
                "/api/v1/demo/sessions",
                json={},
                headers={**headers, "Idempotency-Key": "demo-story-session"},
            )
            demo.raise_for_status()
            for slug, name, discount, complete in cases:
                payload = copy.deepcopy(base)
                payload["discount_rate"] = discount
                payload["rivals"]["complete"] = complete
                response = client.post(
                    "/api/v1/scenarios",
                    json={"name": name, "input": payload},
                    headers={**headers, "Idempotency-Key": slug},
                )
                response.raise_for_status()
                scenario = response.json()
                saved[slug] = scenario["id"]
                _write(output / f"{slug}.json", scenario)
                report = client.post(
                    "/api/v1/reports",
                    json={
                        "scenario_id": scenario["id"],
                        "decision": "study",
                        "note": (
                            "Ejemplo controlado. Empresa y rivales hipotéticos; "
                            "revisión documental curada."
                        ),
                    },
                    headers={**headers, "Idempotency-Key": f"report-{slug}"},
                )
                report.raise_for_status()
                html = client.get(f"/api/v1/reports/{report.json()['id']}/html")
                html.raise_for_status()
                (output / f"{slug}.html").write_text(html.text, encoding="utf-8")
                result = scenario["result"]
                records.append(
                    {
                        "case": slug,
                        "discount_rate": discount,
                        "complete": complete,
                        "price_net": result["price_net"],
                        "profit_net": result["profit_net"],
                        "score": result["score"],
                        "anomaly_status": result["anomaly"]["status"],
                        "snapshot_sha256": scenario["snapshot_sha256"],
                    }
                )
            ids = [saved["02-mismos-puntos-15"], saved["01-mismos-puntos-10"]]
            comparison = client.post(
                "/api/v1/scenarios/compare",
                json={"scenario_ids": ids, "primary_id": ids[0]},
                headers=headers,
            )
            comparison.raise_for_status()
            _write(output / "05-comparacion.json", comparison.json())
            _write(
                output / "RESUMEN.json",
                {
                    "generated_at": dt.datetime.now(dt.UTC).isoformat(),
                    "source": "Current application API, ASGI TestClient, fresh demo seed",
                    "synthetic_company_and_rivals": True,
                    "document_interpretation": "curated fixture",
                    "new_meta_invocations": 0,
                    "user_database_touched": False,
                    "cases": records,
                },
            )
        # Windows keeps the SQLite file locked until the pool closes; dispose
        # before TemporaryDirectory cleanup removes the isolated storage.
        from bidlab.db.session import get_engine

        get_engine().dispose()
        print(f"Demo: 4 escenarios, 4 informes y comparación exportados a {output.resolve()}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    export_story(args.output)


if __name__ == "__main__":
    main()
