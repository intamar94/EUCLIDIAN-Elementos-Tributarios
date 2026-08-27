"""Catálogo de acceso al histórico DIAN.

Mantiene un índice local ligero de documentos descubiertos. No sustituye la
fuente oficial: cada registro conserva la URL y la raíz DIAN de procedencia.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Iterable

SCHEMA = """
CREATE TABLE IF NOT EXISTS documentos (
    url TEXT PRIMARY KEY,
    raiz TEXT NOT NULL,
    titulo TEXT DEFAULT '',
    primera_deteccion TEXT NOT NULL,
    ultima_comprobacion TEXT NOT NULL,
    huella TEXT DEFAULT '',
    estado TEXT NOT NULL DEFAULT 'descubierto'
);
CREATE INDEX IF NOT EXISTS idx_documentos_raiz ON documentos(raiz);
CREATE INDEX IF NOT EXISTS idx_documentos_estado ON documentos(estado);
"""


def abrir(ruta: str = "euclidian_historico.db") -> sqlite3.Connection:
    db = sqlite3.connect(ruta)
    db.executescript(SCHEMA)
    return db


def importar(db: sqlite3.Connection, registros: Iterable[dict], ahora: str) -> int:
    n = 0
    for item in registros:
        url = item.get("url", "").strip()
        raiz = item.get("raiz", "").strip()
        if not url or not raiz:
            continue
        db.execute(
            """INSERT INTO documentos(url, raiz, titulo, primera_deteccion,
               ultima_comprobacion, huella, estado)
               VALUES(?,?,?,?,?,?,?)
               ON CONFLICT(url) DO UPDATE SET
                 raiz=excluded.raiz,
                 titulo=excluded.titulo,
                 ultima_comprobacion=excluded.ultima_comprobacion,
                 huella=CASE WHEN excluded.huella <> '' THEN excluded.huella ELSE documentos.huella END,
                 estado=excluded.estado""",
            (url, raiz, item.get("titulo", ""), ahora, ahora,
             item.get("huella_contenido", ""), item.get("estado", "descubierto")),
        )
        n += 1
    db.commit()
    return n


def exportar(db: sqlite3.Connection, salida: str) -> int:
    filas = db.execute(
        "SELECT url, raiz, titulo, primera_deteccion, ultima_comprobacion, huella, estado "
        "FROM documentos ORDER BY ultima_comprobacion DESC"
    ).fetchall()
    Path(salida).write_text(json.dumps([
        {"url": f[0], "raiz": f[1], "titulo": f[2], "primera_deteccion": f[3],
         "ultima_comprobacion": f[4], "huella": f[5], "estado": f[6]} for f in filas
    ], ensure_ascii=False, indent=2), encoding="utf-8")
    return len(filas)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--entrada", default="descubrimiento_fuentes.json")
    ap.add_argument("--db", default="euclidian_historico.db")
    ap.add_argument("--salida", default="historico_index.json")
    args = ap.parse_args()
    data = json.loads(Path(args.entrada).read_text(encoding="utf-8"))
    from datetime import datetime, timezone
    ahora = datetime.now(timezone.utc).isoformat()
    db = abrir(args.db)
    n = importar(db, data.get("documentos", []), ahora)
    total = exportar(db, args.salida)
    print(f"HISTORICO_OK: {n} registros importados; {total} documentos en índice")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
