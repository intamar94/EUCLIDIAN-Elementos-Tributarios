"""Registra el estado de la automatización de actualización DIAN en Supabase."""
from __future__ import annotations

import argparse
import os
from datetime import datetime, timezone

from supabase import create_client


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--estado", choices=["iniciado", "exitoso", "error"], required=True)
    ap.add_argument("--run-id", default="")
    ap.add_argument("--mensaje", default="")
    args = ap.parse_args()

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")

    now = datetime.now(timezone.utc).isoformat()
    row = {
        "fuente": "automatizacion_github",
        "url_objetivo": f"github-actions:{args.run_id or 'desconocido'}",
        "estado": args.estado,
        "mensaje_error": args.mensaje[:1000] if args.mensaje else None,
        "timestamp_inicio": now,
        "timestamp_fin": None if args.estado == "iniciado" else now,
    }
    create_client(url, key).table("logs_scraping").insert(row).execute()
    print(f"AUTOMATIZACION_{args.estado.upper()} run={args.run_id or 'desconocido'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
