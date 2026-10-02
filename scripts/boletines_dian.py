"""Boletines PDF enlazados por Novedades → portal DIAN → publicación.

Se conserva el boletín completo como publicación institucional. Sus conceptos
citados no se convierten en normas nuevas ni en interpretaciones de EUCLIDIAN.
"""
from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from urllib.parse import urljoin, urlsplit
import argparse
import os

from bs4 import BeautifulSoup

from fuente_documental import canonica, capturar, descargar, url_oficial

RAIZ = "https://normograma.dian.gov.co/dian/compilacion/novedades_boletines.html"
PORTAL = "nyb_novedades_juridicas_portal_web_dian.html"
PUBLICACIONES = {
    "doctriflash.aspx": "doctriflash",
    "boletin-actualidad-juridica-dian.aspx": "boletin_actualidad_juridica",
    "boletinestributarios.aspx": "boletin_tributario_historico",
    "boletinesaduaneros.aspx": "boletin_aduanero_historico",
}


def enlaces(html, base):
    soup = BeautifulSoup(html, "html.parser")
    seen = set()
    for a in soup.select("a[href]"):
        url = canonica(urljoin(base, a["href"]))
        if url in seen or not url_oficial(url):
            continue
        seen.add(url)
        yield url, a.get_text(" ", strip=True).replace("\u200b", "").strip()


def descubrir_publicaciones(session, raiz_html=None, historico=False):
    """Sólo sigue enlaces presentes en la cadena de procedencia autorizada."""
    if raiz_html is None:
        raiz_html, _, _ = descargar(session, RAIZ)
    portal = next((url for url, _ in enlaces(raiz_html, RAIZ)
                   if urlsplit(url).path.endswith("/" + PORTAL)), None)
    if not portal:
        raise ValueError("La raíz no enlaza Novedades jurídicas en el portal DIAN")
    portal_html, portal, _ = descargar(session, portal)
    queue = [(url, PUBLICACIONES[urlsplit(url).path.rsplit("/", 1)[-1].lower()])
             for url, _ in enlaces(portal_html, portal)
             if urlsplit(url).path.rsplit("/", 1)[-1].lower() in PUBLICACIONES]
    if {kind for _, kind in queue} < {"doctriflash", "boletin_actualidad_juridica"}:
        raise ValueError("No se localizaron ambos índices Doctriflash y Actualidad Jurídica")
    seen, documents, uncovered = set(), {}, []
    while queue:
        page, kind = queue.pop(0)
        if page in seen:
            continue
        seen.add(page)
        html, final, _ = descargar(session, page)
        count = 0
        for url, title in enlaces(html, final):
            path = urlsplit(url).path.lower()
            if path.endswith(".pdf") and "/normatividad/" in path:
                count += 1
                if url not in documents:
                    documents[url] = {"url": url, "titulo": title or urlsplit(url).path.rsplit("/", 1)[-1],
                                      "fuente_indice": final, "subtipo": kind}
            filename = path.rsplit("/", 1)[-1]
            if historico and filename in PUBLICACIONES and url not in seen:
                queue.append((url, PUBLICACIONES[filename]))
        if not count:
            # SharePoint puede mostrar sus archivos mediante una lista dinámica.
            # Reportar esta brecha evita afirmar cobertura histórica completa.
            if "historico" in kind:
                uncovered.append(final)
            else:
                raise ValueError(f"Índice de boletines sin PDF visibles: {final}")
    return list(documents.values()), uncovered


def registro_publicacion(item, capture=None):
    url = item["url"]
    title = item["titulo"]
    now = datetime.now(timezone.utc).isoformat()
    year = re.search(r"\b(?:19|20)\d{2}\b", title)
    record = {
        "numero_resolucion": "DIAN-BOLETIN-" + hashlib.sha256(url.encode()).hexdigest()[:24].upper(),
        "tipo_documento": "boletin", "subtipo": item["subtipo"],
        "titulo": title[:500], "contenido": title,
        "enlace_oficial": url,
        "anio_publicacion": int(year.group()) if year else None,
        "estado_vigencia": "desconocido", "clasificacion_obligatoriedad": "orientativo",
        "temas": ["boletin_mensual", item["subtipo"]],
        "hash_contenido": hashlib.sha256(title.encode()).hexdigest(),
        "fecha_scraped": now,
        "notas_verificacion": (
            "Publicación informativa DIAN; el período del título no es fecha de expedición ni acredita vigencia de las normas citadas. "
            f"Procedencia DIAN | raiz: {RAIZ} | indice: {item['fuente_indice']}"
        ),
    }
    if capture:
        record.update({"texto_completo": capture.texto, "hash_contenido": capture.huella,
                       "enriquecido_en": now,
                       "notas_verificacion": record["notas_verificacion"] +
                       f" | captura: {capture.estado}; paginas: {capture.paginas or 0}; URL verificada: {capture.url}"})
    return record


def recolectar(session, historico=False, anio_corte=None):
    items, uncovered = descubrir_publicaciones(session, historico=historico)
    records, errors = [], []
    for item in items:
        record = registro_publicacion(item)
        if not historico and anio_corte and record["anio_publicacion"] and record["anio_publicacion"] < anio_corte:
            continue
        try:
            capture = capturar(session, item["url"])
            record = registro_publicacion(item, capture)
            if capture.estado != "completo":
                errors.append({"url": item["url"], "error": f"PDF con extracción {capture.estado}; consultar original"})
        except Exception as exc:
            # Conservar registro y URL incluso si no hay texto; no borrar una
            # captura previa ni registrar una descarga fallida como verificada.
            errors.append({"url": item["url"], "error": str(exc)[:300]})
            record["notas_verificacion"] += " | captura pendiente por error de acceso"
        records.append(record)
    return records, errors, uncovered


def main():
    """Ingesta los PDF que la raíz Novedades enlaza realmente.

    Es un flujo separado del scraper de documentos individuales: un boletín
    es una publicación institucional y no debe convertirse en una norma.
    """
    ap = argparse.ArgumentParser()
    ap.add_argument('--historico', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--anio-corte', type=int, default=2024)
    args = ap.parse_args()
    import requests
    session = requests.Session()
    records, errors, uncovered = recolectar(session, historico=args.historico,
                                            anio_corte=None if args.historico else args.anio_corte)
    print(f'BOLETINES_DESCUBIERTOS={len(records)} ERRORES={len(errors)} SIN_COBERTURA={len(uncovered)}')
    for error in errors[:20]:
        print(f"BOLETIN_ERROR {error['url']} {error['error']}")
    if args.dry_run:
        return 1 if errors else 0
    url, key = os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY')
    if not url or not key:
        raise SystemExit('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
    from supabase import create_client
    db = create_client(url, key)
    for start in range(0, len(records), 50):
        db.table('documentos_tributarios').upsert(
            records[start:start + 50], on_conflict='numero_resolucion').execute()
    if errors or uncovered:
        raise SystemExit('La captura de boletines fue parcial; revisar antes de afirmar cobertura completa.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
