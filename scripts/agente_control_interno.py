"""Agente de integridad documental de EUCLIDIAN.

Convierte los hallazgos del inspector en una cola trazable. Corrige solamente
datos recuperables de forma literal desde la fuente DIAN; tras la corrección,
la siguiente inspección decide si el caso se cierra. Todo lo interpretativo se
conserva para análisis y nunca se publica como dato completo por inferencia.
"""
from __future__ import annotations

import argparse
import hashlib
import logging
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from supabase import create_client

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from inspector_euclidian import run as run_inspector
from inspector_euclidian import canonical_identity, check_link, official_url, source_dates, source_text, trusted_source
from verificador_aprobacion import discover_official_url
from lectores_dian import Lectores
from patrones_dian import limpiar
from plazos_dian import complete_deadlines

LOG = logging.getLogger("agente_control_interno")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
PAGE = 300
FIELDS = "id,numero_resolucion,tipo_documento,titulo,enlace_oficial,fecha_publicacion,fecha_publicacion_web,fecha_es_real,texto_completo,fuentes_formales,plazos_mencionados,tiene_efectos_retroactivos,anos_afectados,publicado_cliente,notas_verificacion"

SAFE_DATE_CODES = {"fecha_imposible", "orden_fechas", "fecha_centinal"}
ANALYSIS_CODES = {
    "duplicado", "plazo_cortado", "cita_incompleta", "ficha_escasa",
    "fecha_no_verificada", "anio_incoherente", "retroactividad_sin_periodo",
    "identificacion", "fuente", "fecha_sin_valor",
}
QUARANTINE_CODES = {
    "duplicado", "fuente", "identificacion", "fecha_imposible",
    "fecha_sin_valor", "orden_fechas", "anio_incoherente",
    "plazo_cortado", "cita_incompleta", "retroactividad_sin_periodo", "fuente_centinal",
    "cita_centinal", "pregunta_respuesta_centinal", "zona_centinal",
    "ambito_centinal", "plazo_centinal", "fecha_web_centinal",
}


def normalized_sources(text):
    """Une citas que el HTML del Normograma parte en líneas distintas."""
    lines = Lectores()._bloque(limpiar(str(text or "")), r"Fuentes Formales")
    joined = []
    for line in lines:
        line = line.strip(" .,;·-")
        previous = joined[-1] if joined else ""
        continuation = bool(previous) and (
            re.fullmatch(r"art[ií]culos?", previous, re.IGNORECASE)
            or re.search(r"\b(?:del|de la|de|y|arts?)$", previous, re.IGNORECASE)
            or (re.search(r"\b(?:art[ií]culos?|ley|decreto|resoluci[oó]n)\s+\d+[.-]?\d*$", previous, re.IGNORECASE)
                and re.match(r"^(?:\d+|del|de la|de)\b", line, re.IGNORECASE))
        )
        if continuation:
            joined[-1] = f"{previous} {line}"
        elif line:
            joined.append(line)
    valid = []
    for item in joined:
        item = re.sub(r"\s+", " ", item).strip(" .,;·-")
        if not (8 <= len(item) <= 240):
            continue
        if not re.search(r"art[ií]culo|ley|decreto|resoluci[oó]n|estatuto|c[oó]digo|constituci[oó]n|sentencia", item, re.IGNORECASE):
            continue
        if not re.fullmatch(r"(?:art[ií]culos?|art[ií]culo|ley|decreto|resoluci[oó]n|estatuto|c[oó]digo)", item, re.IGNORECASE) and item not in valid:
            valid.append(item)
    return valid[:15]


def issue_codes(hallazgos):
    return {str(item.get("codigo")) for item in (hallazgos or []) if item.get("codigo")}


def priority(codes):
    return "alta" if codes & (SAFE_DATE_CODES | QUARANTINE_CODES | {"enlace_roto"}) else "media"


def date_correction(row, official_text):
    """Corrige solo las fechas expresas del encabezado DIAN."""
    dates = source_dates(official_text)
    changes = {}
    evidence_fields = {}
    for key, column in (("documento", "fecha_publicacion"), ("web", "fecha_publicacion_web")):
        candidate = dates.get(key)
        current = str(row.get(column) or "")
        if not candidate:
            continue
        evidence_fields[column] = {"antes": current or None, "despues": candidate}
        if candidate != current:
            changes[column] = candidate
            if key == "documento":
                changes["fecha_es_real"] = True
    if evidence_fields:
        evidence = {
            "campos": evidence_fields,
            "fuente": row.get("enlace_oficial"),
            "texto_sha256": hashlib.sha256(official_text.encode("utf-8")).hexdigest(),
            "consultada_en": datetime.now(timezone.utc).isoformat(),
        }
        return changes, evidence
    return None, None


def read_all(query):
    rows, offset = [], 0
    while True:
        batch = query.range(offset, offset + PAGE - 1).execute().data or []
        rows.extend(batch)
        if len(batch) < PAGE:
            return rows
        offset += len(batch)


def latest_inspection(db):
    rows = (db.table("inspector_ejecuciones").select("*")
            .in_("estado", ["alerta", "correcto"])
            .order("iniciado_en", desc=True).limit(1).execute().data or [])
    return rows[0] if rows else None


def verify_cycle(db, source_inspection_id):
    """Ejecuta el segundo control y conserva el identificador de su evidencia."""
    run_inspector(link_sample=500, persist=True)
    verified = latest_inspection(db)
    if not verified or verified["id"] == source_inspection_id:
        raise RuntimeError("La reinspección no produjo una evidencia independiente")
    if verified.get("revisados") != verified.get("total") or not verified.get("total"):
        raise RuntimeError("La reinspección no alcanzó cobertura completa")
    return verified


def documents_by_id(db, ids):
    out = {}
    for start in range(0, len(ids), 120):
        batch = ids[start:start + 120]
        rows = db.table("documentos_tributarios").select(FIELDS).in_("id", batch).execute().data or []
        out.update({row["id"]: row for row in rows})
    return out


def requeue_after_change(db, row, changes):
    """A corrected primary datum must pass downstream validation again."""
    payload = dict(changes)
    payload.update({"revisado_fiscal_en": None, "publicado_cliente": False,
                    "aprobado_para_email": False})
    db.table("documentos_tributarios").update(payload).eq("id", row["id"]).execute()


def source_quarantine_changes():
    """Un documento sin fuente DIAN accesible no puede seguir visible."""
    return {"publicado_cliente": False, "aprobado_para_email": False}


def resolve_link(session, row):
    try:
        _text, final, discovered = discover_official_url(session, row)
    except Exception:
        return None
    original = canonical_identity(row)
    replacement = canonical_identity({"enlace_oficial": discovered}) if discovered else None
    if discovered and final and original and replacement == original and discovered != row.get("enlace_oficial"):
        return discovered
    return None


def live_official_text(session, row):
    """Lee el HTML actual, con saltos de línea y huella para cada decisión."""
    if not official_url(row.get("enlace_oficial")):
        raise ValueError("No hay una URL individual verificable en el Normograma")
    response = session.get(row["enlace_oficial"], timeout=20, allow_redirects=True)
    response.raise_for_status()
    if not official_url(response.url):
        raise ValueError("La fuente redirigió fuera del Normograma DIAN")
    soup = BeautifulSoup(response.content, "html.parser")
    for tag in soup(["script", "style", "nav", "footer"]):
        tag.decompose()
    text = soup.get_text("\n", strip=True)
    if len(text) < 200:
        raise ValueError("La fuente no devolvió texto suficiente para contrastar")
    evidence = {"fuente": response.url,
                "sha256": hashlib.sha256(response.content).hexdigest(),
                "consultada_en": datetime.now(timezone.utc).isoformat()}
    return text, evidence


def build_case(inspeccion_id, run_id, row, code, estado, detalle, evidencia):
    return {
        "ejecucion_id": run_id,
        "inspeccion_id": inspeccion_id,
        "documento_id": row.get("id") if row else None,
        "codigo": code,
        "prioridad": priority({code}),
        "estado": estado,
        "detalle": detalle[:2000],
        "evidencia": evidencia,
        "actualizado_en": datetime.now(timezone.utc).isoformat(),
    }


def case_key(case):
    if case.get("documento_id"):
        return f"{case['documento_id']}:{case['codigo']}"
    origin = str((case.get("evidencia") or {}).get("fuente") or
                 (case.get("evidencia") or {}).get("documento_id") or
                 (case.get("evidencia") or {}).get("nombre") or "sin_origen")
    return f"sin_documento:{hashlib.sha256(origin.encode()).hexdigest()}:{case['codigo']}"


def verified_codes(db, verification, ids):
    by_doc = {}
    for start in range(0, len(ids), 120):
        rows = (db.table("inspector_resultados").select("documento_id,hallazgos")
                .eq("ejecucion_id", verification["id"])
                .in_("documento_id", ids[start:start + 120]).execute().data or [])
        by_doc.update({row["documento_id"]: issue_codes(row.get("hallazgos")) for row in rows})
    for sentinel in verification.get("casos") or []:
        if sentinel.get("documento_id"):
            by_doc.setdefault(sentinel["documento_id"], set()).update(sentinel.get("codigos") or [])
    return by_doc


def case_action(code, state):
    if state == "correccion_verificada":
        return "Cotejar la ficha completa con la fuente DIAN y decidir su nueva publicación."
    if state == "en_cuarentena":
        return "Corregir con fuente oficial y reinspeccionar antes de volver a publicar."
    actions = {
        "duplicado": "Comparar ambas fichas y conservar un único registro canónico.",
        "fecha_no_verificada": "Buscar fecha explícita en el acto o conservar solo el año identificable.",
        "ficha_escasa": "Redactar una síntesis precisa con alcance, sujetos, período y cita DIAN.",
        "retroactividad_sin_periodo": "Identificar el período afectado o retirar la alerta no sustentada.",
        "enlace_roto": "Localizar y comprobar el mismo documento en una URL oficial DIAN.",
    }
    return actions.get(code, "Contrastar el campo señalado con el documento DIAN y reinspeccionar.")


def reconcile_cases(db, session, cases, verification):
    """Un cambio escrito no es cierre: exige ausencia del motivo y fuente cotejada."""
    ids = sorted({c["documento_id"] for c in cases if c.get("documento_id")})
    current = documents_by_id(db, ids)
    found = verified_codes(db, verification, ids)
    keys = [case_key(c) for c in cases]
    previous = {}
    for start in range(0, len(keys), 120):
        rows = (db.table("control_interno_expedientes").select("clave,primera_deteccion,inspeccion_origen,intentos")
                .in_("clave", keys[start:start + 120]).execute().data or [])
        previous.update({row["clave"]: row for row in rows})
    now = datetime.now(timezone.utc).isoformat()
    dossiers, states = [], {}
    for case, key in zip(cases, keys):
        doc_id, code = case.get("documento_id"), case["codigo"]
        row = current.get(doc_id)
        persists = code in found.get(doc_id, set())
        if code == "enlace_roto" and row:
            _, error = check_link(row)
            persists = bool(error)
        applied = case["estado"] == "corregido"
        source = (case.get("evidencia") or {}).get("fuente")
        proven = bool(source and (official_url(source) or
            (row and source == row.get("enlace_oficial") and trusted_source(row))))
        if applied and proven and not persists and row:
            state = "resuelto_verificado" if row.get("publicado_cliente") else "correccion_verificada"
        elif case["estado"] == "en_cuarentena" or (row and not row.get("publicado_cliente") and code in QUARANTINE_CODES):
            state = "en_cuarentena"
        else:
            state = "abierto"
        states[key] = state
        before = previous.get(key) or {}
        dossiers.append({
            "clave": key, "documento_id": doc_id, "codigo": code,
            "prioridad": case["prioridad"], "estado": state,
            "primera_deteccion": before.get("primera_deteccion") or now,
            "ultima_deteccion": now, "ultimo_control_en": now,
            "inspeccion_origen": before.get("inspeccion_origen") or case["inspeccion_id"],
            "inspeccion_ultima": case["inspeccion_id"],
            "verificacion_id": verification["id"],
            "resuelto_en": now if state == "resuelto_verificado" else None,
            "intentos": int(before.get("intentos") or 0) + 1,
            "detalle": ("La reinspección conserva el hallazgo después del ajuste. " + case["detalle"])
                       if applied and persists else case["detalle"],
            "accion_requerida": case_action(code, state),
            "fuente_url": source or (row or {}).get("enlace_oficial"),
            "evidencia": case["evidencia"],
        })
    for start in range(0, len(dossiers), PAGE):
        db.table("control_interno_expedientes").upsert(
            dossiers[start:start + PAGE], on_conflict="clave").execute()
    # Un expediente ya corregido se cierra solo cuando vuelve a estar
    # publicado y el control integral sigue sin detectar su motivo.
    prior = read_all(db.table("control_interno_expedientes")
                     .select("id,clave,documento_id,codigo")
                     .eq("estado", "correccion_verificada").order("id"))
    prior = [p for p in prior if p["clave"] not in states and p.get("documento_id")]
    prior_ids = sorted({p["documento_id"] for p in prior})
    prior_rows = documents_by_id(db, prior_ids)
    prior_codes = verified_codes(db, verification, prior_ids)
    for p in prior:
        row = prior_rows.get(p["documento_id"])
        if row and row.get("publicado_cliente") and p["codigo"] not in prior_codes.get(p["documento_id"], set()):
            db.table("control_interno_expedientes").update({
                "estado": "resuelto_verificado", "resuelto_en": now,
                "ultimo_control_en": now, "verificacion_id": verification["id"],
                "accion_requerida": "Sin acción: ficha publicada y motivo ausente en el control completo."
            }).eq("id", p["id"]).execute()
    return Counter(d["estado"] for d in dossiers), states


def process_document(db, session, inspection_id, run_id, row, codes):
    cases = []
    # La cuarentena precede a cualquier intento de corrección. Si la fuente
    # falla, el código del motivo puede consumirse, pero la ficha ya salió.
    if row.get("publicado_cliente") and codes & QUARANTINE_CODES:
        requeue_after_change(db, row, {})
    live_text, live_evidence, live_error = None, None, None
    if codes & {"plazo_cortado", "cita_incompleta"}:
        try:
            live_text, live_evidence = live_official_text(session, row)
        except Exception as exc:
            live_error = str(exc)[:180]
    # Un plazo partido se retira o recompone solo contra el HTML DIAN actual.
    if "plazo_cortado" in codes:
        before = row.get("plazos_mencionados") or []
        if live_text is None:
            cases.append(build_case(inspection_id, run_id, row, "plazo_cortado", "pendiente_evidencia",
                "No se modificó el plazo: falta contraste con el texto DIAN actual.",
                {"fuente": row.get("enlace_oficial"), "error": live_error}))
        else:
            deadlines = complete_deadlines(live_text)
            if deadlines != before:
                requeue_after_change(db, row, {"plazos_mencionados": deadlines})
            status = "corregido" if deadlines != before else "requiere_analisis"
            detail = ("Se conservaron solo frases completas halladas en el HTML DIAN actual."
                      if deadlines else "Se retiró el fragmento porque no hay plazo completo comprobable.")
            cases.append(build_case(inspection_id, run_id, row, "plazo_cortado", status, detail,
                {**live_evidence, "campo": "plazos_mencionados", "antes": before, "despues": deadlines}))
        codes = codes - {"plazo_cortado"}
    # El Normograma divide algunas fuentes jurídicas entre renglones. Solo se
    # unen referencias con una continuidad gramatical y una figura jurídica.
    if "cita_incompleta" in codes:
        before = row.get("fuentes_formales") or []
        if live_text is None:
            cases.append(build_case(inspection_id, run_id, row, "cita_incompleta", "pendiente_evidencia",
                "No se modificó la cita: falta contraste con el texto DIAN actual.",
                {"fuente": row.get("enlace_oficial"), "error": live_error}))
        else:
            sources = normalized_sources(live_text)
            if sources != before:
                requeue_after_change(db, row, {"fuentes_formales": sources})
            cases.append(build_case(inspection_id, run_id, row, "cita_incompleta",
                "corregido" if sources != before else "requiere_analisis",
                "Se recompuso o retiró la cita usando el bloque Fuentes Formales de la DIAN.",
                {**live_evidence, "campo": "fuentes_formales", "antes": before, "despues": sources}))
        codes = codes - {"cita_incompleta"}
    # Primero una fecha inequívoca. Si DIAN no permite determinarla, no se toca.
    if codes & SAFE_DATE_CODES and trusted_source(row):
        try:
            text = source_text(session, row["enlace_oficial"])
            changes, evidence = date_correction(row, text)
            if changes:
                requeue_after_change(db, row, changes)
                for code in sorted(codes & SAFE_DATE_CODES):
                    cases.append(build_case(inspection_id, run_id, row, code, "corregido",
                        "Se ajustaron las fechas expresas del encabezado DIAN.", evidence))
                codes = codes - SAFE_DATE_CODES
            elif evidence:
                for code in sorted(codes & SAFE_DATE_CODES):
                    cases.append(build_case(inspection_id, run_id, row, code, "requiere_analisis",
                        "La fecha coincide, pero el motivo original exige una comprobación adicional.", evidence))
                codes = codes - SAFE_DATE_CODES
            else:
                for code in sorted(codes & SAFE_DATE_CODES):
                    cases.append(build_case(inspection_id, run_id, row, code, "pendiente_evidencia",
                        "La fuente DIAN no permitió confirmar una fecha documental de forma inequívoca.",
                        {"fuente": row.get("enlace_oficial")}))
                codes = codes - SAFE_DATE_CODES
        except Exception as exc:
            for code in sorted(codes & SAFE_DATE_CODES):
                cases.append(build_case(inspection_id, run_id, row, code, "pendiente_evidencia",
                    "No se modificó la fecha porque la fuente DIAN no estuvo disponible para corroborarla.",
                    {"fuente": row.get("enlace_oficial"), "error": str(exc)[:180]}))
            codes = codes - SAFE_DATE_CODES
    # Años citados en antecedentes no son prueba de efecto retroactivo.
    # Solo se retira una atribución anterior si el HTML DIAN carece incluso
    # de lenguaje de retroactividad; cualquier mención exige análisis.
    if "retroactividad_sin_periodo" in codes and official_url(row.get("enlace_oficial")):
        try:
            text, evidence = live_official_text(session, row)
            explicit_term = re.search(r"retroactiv|efectos?\s+hacia\s+atr[aá]s", text, re.IGNORECASE)
            if not explicit_term and row.get("tiene_efectos_retroactivos"):
                before = {"tiene_efectos_retroactivos": True,
                          "anos_afectados": row.get("anos_afectados") or []}
                requeue_after_change(db, row, {
                    "tiene_efectos_retroactivos": False, "anos_afectados": []})
                cases.append(build_case(inspection_id, run_id, row, "retroactividad_sin_periodo",
                    "corregido", "Se retiró la atribución retroactiva: no aparece en el documento DIAN.",
                    {**evidence, "antes": before,
                     "despues": {"tiene_efectos_retroactivos": False, "anos_afectados": []}}))
            else:
                cases.append(build_case(inspection_id, run_id, row, "retroactividad_sin_periodo",
                    "requiere_analisis", "La fuente menciona retroactividad o no permite retirar el dato sin interpretación.",
                    evidence))
        except Exception as exc:
            cases.append(build_case(inspection_id, run_id, row, "retroactividad_sin_periodo",
                "pendiente_evidencia", "No se modificó el alcance: falta contraste con el texto DIAN actual.",
                {"fuente": row.get("enlace_oficial"), "error": str(exc)[:180]}))
        codes = codes - {"retroactividad_sin_periodo"}
    for code in sorted(codes):
        quarantined = bool(row.get("publicado_cliente") and code in QUARANTINE_CODES)
        cases.append(build_case(inspection_id, run_id, row, code,
            "en_cuarentena" if quarantined else "requiere_analisis",
            "La ficha salió de la publicación hasta contrastar este hallazgo con el documento DIAN."
            if quarantined else "El hallazgo requiere contraste documental; no se modifica por inferencia.",
            {"fuente": row.get("enlace_oficial"), "numero": row.get("numero_resolucion")}))
    return cases


def run(dry_run=False):
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
    db = create_client(url, key)
    inspection = latest_inspection(db)
    if not inspection:
        raise RuntimeError("No existe una inspección completa para gestionar")
    last_management = (db.table("control_interno_ejecuciones")
                       .select("inspeccion_id,verificacion_id,estado")
                       .order("iniciado_en", desc=True).limit(1).execute().data or [])
    if (last_management and last_management[0]["estado"] != "fallo" and
            inspection["id"] in (last_management[0]["inspeccion_id"],
                                 last_management[0].get("verificacion_id"))):
        # Ejecución manual: empezar por una fotografía nueva, no reciclar la
        # reinspección generada por el propio agente en la vuelta anterior.
        run_inspector(link_sample=500, persist=True)
        inspection = latest_inspection(db)
    if inspection.get("revisados") != inspection.get("total") or not inspection.get("total"):
        raise RuntimeError("La inspección más reciente no tiene cobertura completa")
    started = datetime.now(timezone.utc).isoformat()
    created = None
    if not dry_run:
        created = db.table("control_interno_ejecuciones").insert({
            "inspeccion_id": inspection["id"], "estado": "en_curso", "iniciado_en": started,
        }).execute().data[0]
    run_id = created["id"] if created else "00000000-0000-0000-0000-000000000000"
    try:
        # También gestionamos avisos: la severidad ordena la prioridad, pero no
        # deja deuda documental fuera del ciclo por no ser crítica todavía.
        results = read_all(db.table("inspector_resultados").select("documento_id,hallazgos")
                           .eq("ejecucion_id", inspection["id"]).order("documento_id"))
        by_doc = {item["documento_id"]: codes for item in results
                  if (codes := issue_codes(item.get("hallazgos")))}
        # Los casos centinela hacen comparaciones más profundas que el barrido
        # por fila. Sus discrepancias de fecha se incorporan a la misma cola.
        orphan_cases = []
        for sentinel in inspection.get("casos") or []:
            document_id = sentinel.get("documento_id")
            findings = " ".join(sentinel.get("hallazgos") or [])
            if document_id:
                by_doc.setdefault(document_id, set()).update(sentinel.get("codigos") or [])
            elif sentinel.get("estado") == "fallo":
                for code in sentinel.get("codigos") or ["registro_centinal"]:
                    orphan_cases.append(build_case(inspection["id"], run_id, None, code,
                        "pendiente_evidencia", "El caso centinela no tiene una ficha única para contrastar.",
                        {"fuente": sentinel.get("fuente"), "nombre": sentinel.get("nombre")}))
            if document_id and "Fecha del documento:" in findings:
                by_doc.setdefault(document_id, set()).add("fecha_centinal")
            if document_id and "aparece duplicado" in findings:
                by_doc.setdefault(document_id, set()).add("duplicado")
        broken = ((inspection.get("enlaces") or {}).get("fallidos") or
                  (inspection.get("enlaces") or {}).get("muestra") or [])
        for item in broken:
            if item.get("id"):
                by_doc.setdefault(item["id"], set()).add("enlace_roto")
        docs = documents_by_id(db, list(by_doc))
        session = requests.Session()
        session.headers.update({"User-Agent": "EUCLIDIAN-Agente-Integridad/1.0", "Accept-Language": "es-CO,es;q=0.9"})
        cases = list(orphan_cases)
        for document_id, codes in by_doc.items():
            row = docs.get(document_id)
            if not row:
                cases.append(build_case(inspection["id"], run_id, None, "registro_no_encontrado", "pendiente_evidencia",
                    "El resultado del inspector no pudo asociarse a un registro vigente.", {"documento_id": document_id}))
                continue
            if "enlace_roto" in codes:
                replacement = resolve_link(session, row)
                if replacement and not dry_run:
                    before = row.get("enlace_oficial")
                    requeue_after_change(db, row, {"enlace_oficial": replacement})
                    cases.append(build_case(inspection["id"], run_id, row, "enlace_roto", "corregido",
                        "Se sustituyó el enlace inaccesible por una URL oficial DIAN que identifica el mismo documento.",
                        {"campo": "enlace_oficial", "antes": before, "despues": replacement,
                         "fuente": replacement, "consultada_en": datetime.now(timezone.utc).isoformat()}))
                    codes = codes - {"enlace_roto"}
                else:
                    # Un 404 confirmado no es un dato que el suscriptor pueda
                    # contrastar. Se conserva internamente con evidencia, pero
                    # se retira de la publicación y de cualquier correo.
                    if row.get("publicado_cliente") and not dry_run:
                        requeue_after_change(db, row, source_quarantine_changes())
                    cases.append(build_case(inspection["id"], run_id, row, "enlace_roto", "en_cuarentena",
                        "La URL oficial respondió como inaccesible y no se encontró una sustitución DIAN inequívoca. El registro quedó fuera de la publicación hasta nueva comprobación.",
                        {"fuente": row.get("enlace_oficial"), "decision": "cuarentena_de_publicacion",
                         "revisar_en_proxima_inspeccion": True}))
                    codes = codes - {"enlace_roto"}
            if dry_run:
                for code in sorted(codes):
                    cases.append(build_case(inspection["id"], run_id, row, code, "requiere_analisis",
                        "Simulación: el hallazgo se conservaría para contraste documental.", {"fuente": row.get("enlace_oficial")}))
            else:
                cases.extend(process_document(db, session, inspection["id"], run_id, row, codes))
        if not dry_run and cases:
            for start in range(0, len(cases), PAGE):
                db.table("control_interno_casos").upsert(cases[start:start + PAGE],
                    on_conflict="inspeccion_id,documento_id,codigo").execute()
        counts = Counter(case["estado"] for case in cases)
        result = {"detectados": len(cases), "corregidos": 0,
                  "pendientes_evidencia": counts["pendiente_evidencia"],
                  "requieren_analisis": counts["requiere_analisis"] + counts["corregido"],
                  "en_cuarentena": counts["en_cuarentena"],
                  "correcciones_verificadas": 0}
        if not dry_run:
            # El control no se limita a proponer un cambio: genera una nueva
            # fotografía integral de la base para comprobarlo inmediatamente.
            verification = verify_cycle(db, inspection["id"])
            verified_counts, states = reconcile_cases(db, session, cases, verification)
            for case in cases:
                if case["estado"] != "corregido" or not case.get("documento_id"):
                    continue
                state_after = states[case_key(case)]
                if state_after == "correccion_verificada":
                    db.table("control_interno_casos").update({"estado": state_after})\
                      .eq("inspeccion_id", inspection["id"])\
                      .eq("documento_id", case["documento_id"])\
                      .eq("codigo", case["codigo"]).execute()
            result["corregidos"] = verified_counts["correccion_verificada"] + verified_counts["resuelto_verificado"]
            result["correcciones_verificadas"] = result["corregidos"]
            result["requieren_analisis"] = (counts["requiere_analisis"] +
                counts["corregido"] - result["corregidos"])
            state = "alerta" if (result["pendientes_evidencia"] or result["requieren_analisis"]
                                 or result["en_cuarentena"] or verification.get("criticos")) else "correcto"
            db.table("control_interno_ejecuciones").update({**result, "estado": state,
                "verificacion_id": verification["id"],
                "finalizado_en": datetime.now(timezone.utc).isoformat()}).eq("id", run_id).execute()
        LOG.info("Agente: %s", result)
        return result
    except Exception as exc:
        if not dry_run and created:
            db.table("control_interno_ejecuciones").update({"estado": "fallo", "finalizado_en": datetime.now(timezone.utc).isoformat(),
                "error": str(exc)[:500]}).eq("id", run_id).execute()
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        run(args.dry_run)
        # Los casos pendientes son el producto esperado del control interno,
        # no un error de ejecución. El panel y el monitor los comunican.
        raise SystemExit(0)
    except Exception as exc:
        LOG.error("Agente bloqueado: %s", exc)
        raise SystemExit(2)
