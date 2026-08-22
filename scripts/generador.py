"""
EUCLIDIAN — Elementos Tributarios
Generador del boletin

QUE HACE
--------
Toma los documentos que aprobaste en la bandeja y arma dos cosas:

  1. El correo en HTML, para enviar por Resend.
  2. Una version en texto plano, para pegar en WhatsApp.

Lo segundo no es un extra. El canal real de un contador es el grupo de
colegas, y un correo pegado en WhatsApp se ve horrible. Si la version de
texto queda limpia, el boletin circula. Si no, se queda en la bandeja de
entrada de una sola persona.

PRINCIPIO
---------
El generador NO escribe explicaciones. Usa, en este orden:

  1. resumen_humano   -> lo que tú escribiste, si lo escribiste
  2. contenido        -> la descripcion literal de la DIAN

Nunca inventa el "que significa". Si no hay resumen humano, se manda lo
que dice la DIAN y punto. Es preferible un correo escueto a uno que
suene seguro sobre algo que nadie verifico.

Cada documento va con su numero, su fecha real y su enlace oficial. El
lector siempre puede ir a la fuente.

USO
---
    python generador.py                    # vista previa, no guarda
    python generador.py --guardar          # deja el borrador en la base
    python generador.py --desde 2026-08-01
"""

import argparse
import html as htmllib
import logging
import os
import re
import sys
from collections import Counter
from datetime import date, datetime, timedelta, timezone

try:
    from supabase import create_client
except ImportError:
    print("Falta la libreria: pip install supabase")
    sys.exit(1)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s  %(levelname)-7s %(message)s",
                    datefmt="%H:%M:%S")
log = logging.getLogger("euclidian")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

MESES = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

# Paleta: papel de libro contable + colores de la edicion de Byrne de
# los Elementos de Euclides (1847), donde las figuras de color
# reemplazaban a las letras en las demostraciones.
PAPEL = "#EDF1E9"
FICHA = "#FAFBF8"
TINTA = "#17211C"
TENUE = "#5E6B62"
REGLA = "#B23A32"
AZUL = "#2C4C8F"
OCRE = "#C99A2E"
LINEA = "#D2DACB"

# Los glifos van en Unicode, no en SVG: muchos clientes de correo
# bloquean las imagenes pero ninguno bloquea un caracter.
GLIFOS = {
    "obliga": "\u25b2",     # triangulo
    "criterio": "\u25cf",   # circulo
    "caido": "\u25a0",      # cuadrado
}


def fecha_larga(d):
    if isinstance(d, str):
        try:
            d = date.fromisoformat(d[:10])
        except ValueError:
            return d
    return f"{d.day} de {MESES[d.month]} de {d.year}"


def esc(s):
    return htmllib.escape(str(s or ""), quote=True)


class Generador:
    def __init__(self, desde=None, hasta=None, maximo=6):
        if not SUPABASE_URL or not SUPABASE_KEY:
            log.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
            sys.exit(1)
        self.db = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.hasta = hasta or date.today()
        self.desde = desde or (self.hasta - timedelta(days=7))
        self.maximo = maximo
        self.stats = Counter()

    # ==================================================================

    def correr(self, guardar=False):
        docs = self._aprobados()
        if not docs:
            log.warning("No hay documentos aprobados en el periodo.")
            log.warning("Entra a la bandeja y aprueba algunos primero.")
            return None

        log.info("%d documentos aprobados; se incluyen %d",
                 len(docs), min(len(docs), self.maximo))

        docs = self._ordenar(docs)[:self.maximo]
        alertas = self._alertas([d["id"] for d in docs])

        asunto = self._asunto(docs)
        cuerpo_html = self._html(docs, alertas, asunto)
        cuerpo_texto = self._texto(docs, alertas)

        print("\n" + "=" * 66)
        print("ASUNTO:", asunto)
        print("=" * 66)
        print(cuerpo_texto)
        print("=" * 66)
        log.info("HTML: %d caracteres | Texto: %d caracteres",
                 len(cuerpo_html), len(cuerpo_texto))

        if guardar:
            self._guardar(asunto, cuerpo_html, docs)
        else:
            log.info("Vista previa. Usa --guardar para dejar el borrador.")

        return {"asunto": asunto, "html": cuerpo_html, "texto": cuerpo_texto}

    # ------------------------------------------------------------------

    def _aprobados(self):
        try:
            r = self.db.table("documentos_tributarios").select(
                "id,numero_resolucion,tipo_documento,subtipo,titulo,contenido,"
                "resumen_humano,enlace_oficial,fecha_publicacion,fecha_es_real,"
                "diario_oficial,entidad_emisora,estado_vigencia,"
                "clasificacion_obligatoriedad,tiene_efectos_retroactivos,"
                "anos_afectados,zonas_afectadas,temas,plazos_mencionados,"
                "anotaciones_vigencia"
            ).eq("aprobado_para_email", True) \
             .gte("fecha_publicacion", self.desde.isoformat()) \
             .lte("fecha_publicacion", self.hasta.isoformat()) \
             .execute()
            return r.data or []
        except Exception as e:
            log.error("No se pudo leer: %s", str(e)[:200])
            sys.exit(1)

    def _alertas(self, ids):
        if not ids:
            return {}
        try:
            r = self.db.table("alertas_urgentes").select(
                "documento_id,nivel_urgencia,tipo_alerta,descripcion"
            ).in_("documento_id", ids).execute()
        except Exception:
            return {}
        salida = {}
        orden = {"critica": 0, "alta": 1, "media": 2, "baja": 3}
        for a in (r.data or []):
            actual = salida.get(a["documento_id"])
            if not actual or orden.get(a["nivel_urgencia"], 9) < orden.get(
                    actual["nivel_urgencia"], 9):
                salida[a["documento_id"]] = a
        return salida

    def _ordenar(self, docs):
        def puntos(d):
            p = 0
            if d["estado_vigencia"] in ("suspendido", "inexequible", "revocado"):
                p += 100
            if d.get("tiene_efectos_retroactivos"):
                p += 60
            if d["clasificacion_obligatoriedad"] == "obligatorio_dian_y_contribuyentes":
                p += 40
            if d.get("plazos_mencionados"):
                p += 30
            if d.get("resumen_humano"):
                p += 20
            if d.get("fecha_es_real"):
                p += 5
            return p
        return sorted(docs, key=puntos, reverse=True)

    # ==================================================================

    def _asunto(self, docs):
        n = len(docs)
        graves = sum(1 for d in docs
                     if d["estado_vigencia"] in ("suspendido", "inexequible", "revocado"))
        if graves:
            return f"{n} cambios DIAN — {graves} con norma caída"
        retro = sum(1 for d in docs if d.get("tiene_efectos_retroactivos"))
        if retro:
            return f"{n} cambios DIAN — {retro} afecta años anteriores"
        return f"{n} cambios DIAN de esta semana"

    def _glifo(self, d):
        if d["estado_vigencia"] != "vigente":
            return GLIFOS["caido"], REGLA
        if d["clasificacion_obligatoriedad"] == "obligatorio_dian_y_contribuyentes":
            return GLIFOS["obliga"], AZUL
        return GLIFOS["criterio"], OCRE

    def _leyenda(self, d):
        if d["estado_vigencia"] != "vigente":
            return d["estado_vigencia"].upper()
        if d["clasificacion_obligatoriedad"] == "obligatorio_dian_y_contribuyentes":
            return "Obliga al contribuyente"
        return "Criterio de la DIAN, no obliga al contribuyente"

    def _cuerpo_util(self, d):
        """El resumen humano manda. Si no hay, va lo literal de la DIAN."""
        if d.get("resumen_humano"):
            return d["resumen_humano"], False
        texto = re.sub(r"^\([^)]{0,40}\)\s*", "", d.get("contenido") or "")
        texto = re.sub(r"^\(Int \d+\)\s*", "", texto).strip()
        return texto[:600], True

    def _referencia(self, d):
        partes = [d["numero_resolucion"]]
        if d.get("fecha_es_real"):
            partes.append(fecha_larga(d["fecha_publicacion"]))
        if d.get("diario_oficial"):
            partes.append(f"Diario Oficial {d['diario_oficial']}")
        return " · ".join(partes)

    # ==================================================================

    def _html(self, docs, alertas, asunto):
        hoy = fecha_larga(self.hasta)
        p = []
        p.append(f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(asunto)}</title></head>
<body style="margin:0;padding:0;background:{PAPEL};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
 style="background:{PAPEL};padding:0 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
 style="max-width:600px;margin:0 auto;">

<tr><td style="padding:26px 4px 14px;border-bottom:2px solid {REGLA};">
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:21px;
    font-weight:bold;letter-spacing:1px;color:{TINTA};">
    EUCL<span style="color:{REGLA};">i</span>DIAN</div>
  <div style="font-family:'Courier New',monospace;font-size:10px;
    letter-spacing:2px;text-transform:uppercase;color:{TENUE};padding-top:4px;">
    Elementos Tributarios &nbsp;·&nbsp; {esc(hoy)}</div>
</td></tr>""")

        for i, d in enumerate(docs, 1):
            p.append(self._html_ficha(d, alertas.get(d["id"]), i))

        p.append(f"""
<tr><td style="padding:22px 4px 30px;border-top:1px solid {LINEA};">
  <div style="font-family:Georgia,serif;font-size:13px;color:{TENUE};
    line-height:1.6;">
    <strong style="color:{TINTA};">Cómo leer este boletín</strong><br>
    <span style="color:{AZUL};">{GLIFOS['obliga']}</span> obliga al contribuyente &nbsp;
    <span style="color:{OCRE};">{GLIFOS['criterio']}</span> criterio de la DIAN &nbsp;
    <span style="color:{REGLA};">{GLIFOS['caido']}</span> norma caída
  </div>
  <div style="font-family:'Courier New',monospace;font-size:11px;color:{TENUE};
    line-height:1.7;padding-top:14px;">
    Solo se incluyen documentos publicados por la DIAN, con enlace a la
    fuente oficial. Nada sale sin revisión humana previa.<br>
    Si encuentras un error, responde este correo: se corrige al día siguiente.
  </div>
  <div style="font-family:'Courier New',monospace;font-size:10px;color:{TENUE};
    padding-top:16px;">
    Compilación Jurídica DIAN &nbsp;·&nbsp; normograma.dian.gov.co<br>
    <a href="{{{{UNSUBSCRIBE}}}}" style="color:{TENUE};">Dejar de recibir</a>
  </div>
</td></tr>

</table></td></tr></table></body></html>""")
        return "\n".join(p)

    def _html_ficha(self, d, alerta, i):
        glifo, color = self._glifo(d)
        cuerpo, es_literal = self._cuerpo_util(d)
        fuente = "Lo que dice la DIAN" if es_literal else "En breve"

        aviso = ""
        if alerta and alerta["nivel_urgencia"] in ("critica", "alta"):
            fondo = "#FBEAE9" if alerta["nivel_urgencia"] == "critica" else "#FDF4E3"
            borde = REGLA if alerta["nivel_urgencia"] == "critica" else OCRE
            aviso = f"""
      <div style="background:{fondo};border-left:3px solid {borde};
        padding:10px 12px;margin:0 0 12px;font-family:Georgia,serif;
        font-size:13px;line-height:1.5;color:{TINTA};">
        <strong>Atención.</strong> {esc(alerta['descripcion'])[:320]}
      </div>"""

        extras = []
        if d.get("tiene_efectos_retroactivos") and d.get("anos_afectados"):
            anios = ", ".join(str(a) for a in d["anos_afectados"][:5])
            extras.append(f"Menciona años anteriores ({anios}). "
                          f"Revisa si afecta declaraciones ya presentadas.")
        if d.get("zonas_afectadas"):
            extras.append("Aplica a: " + ", ".join(d["zonas_afectadas"][:8]))
        if d.get("plazos_mencionados"):
            extras.append("Plazo: " + d["plazos_mencionados"][0][:200])

        bloque_extras = ""
        if extras:
            filas = "".join(
                f'<div style="padding:3px 0;">— {esc(x)}</div>' for x in extras)
            bloque_extras = f"""
      <div style="font-family:Georgia,serif;font-size:13px;color:{TINTA};
        line-height:1.5;padding-top:10px;">{filas}</div>"""

        return f"""
<tr><td style="padding:18px 0 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
   style="background:{FICHA};border:1px solid {LINEA};border-left:3px solid {REGLA};">
  <tr><td style="padding:16px 16px 14px;">
      <div style="font-family:'Courier New',monospace;font-size:11px;
        color:{TENUE};padding-bottom:8px;">
        <span style="color:{color};font-size:13px;">{glifo}</span>&nbsp;
        {esc(self._referencia(d))}
      </div>
      <div style="font-family:Georgia,serif;font-size:17px;font-weight:bold;
        line-height:1.3;color:{TINTA};padding-bottom:10px;">
        {i}. {esc(d['titulo'])[:180]}
      </div>{aviso}
      <div style="font-family:'Courier New',monospace;font-size:9px;
        letter-spacing:1.4px;text-transform:uppercase;color:{TENUE};
        padding-bottom:4px;">{fuente}</div>
      <div style="font-family:Georgia,serif;font-size:15px;line-height:1.55;
        color:#28332C;">{esc(cuerpo)}</div>{bloque_extras}
      <div style="font-family:'Courier New',monospace;font-size:10px;
        color:{color};padding-top:12px;">{esc(self._leyenda(d))}</div>
      <div style="padding-top:14px;">
        <a href="{esc(d['enlace_oficial'])}"
           style="display:inline-block;background:{TINTA};color:{PAPEL};
           font-family:Georgia,serif;font-size:13px;padding:9px 16px;
           text-decoration:none;">Leer el documento oficial</a>
      </div>
  </td></tr></table>
</td></tr>"""

    # ==================================================================

    def _texto(self, docs, alertas):
        """
        Version para pegar en WhatsApp. Sin markdown raro, sin tablas.
        Los glifos Unicode se ven bien en cualquier telefono.
        """
        L = []
        L.append(f"EUCLiDIAN — Elementos Tributarios")
        L.append(f"Cambios DIAN al {fecha_larga(self.hasta)}")
        L.append("")

        for i, d in enumerate(docs, 1):
            glifo, _ = self._glifo(d)
            cuerpo, _ = self._cuerpo_util(d)
            L.append(f"{glifo} {i}. {d['titulo'][:150]}")
            L.append(f"   {self._referencia(d)}")

            a = alertas.get(d["id"])
            if a and a["nivel_urgencia"] in ("critica", "alta"):
                L.append(f"   ATENCIÓN: {a['descripcion'][:220]}")

            L.append(f"   {cuerpo[:400]}")

            if d.get("tiene_efectos_retroactivos") and d.get("anos_afectados"):
                anios = ", ".join(str(x) for x in d["anos_afectados"][:5])
                L.append(f"   Menciona años anteriores ({anios}).")
            if d.get("zonas_afectadas"):
                L.append(f"   Aplica a: {', '.join(d['zonas_afectadas'][:8])}")
            if d.get("plazos_mencionados"):
                L.append(f"   Plazo: {d['plazos_mencionados'][0][:180]}")

            L.append(f"   {self._leyenda(d)}")
            L.append(f"   {d['enlace_oficial']}")
            L.append("")

        L.append("▲ obliga al contribuyente")
        L.append("● criterio de la DIAN")
        L.append("■ norma caída")
        L.append("")
        L.append("Fuente: Compilación Jurídica DIAN")
        L.append("normograma.dian.gov.co")
        return "\n".join(L)

    # ==================================================================

    def _guardar(self, asunto, cuerpo_html, docs):
        try:
            self.db.table("emails_enviados").insert({
                "fecha_envio": self.hasta.isoformat(),
                "asunto": asunto[:300],
                "documentos_incluidos": [d["id"] for d in docs],
                "contenido_html": cuerpo_html,
                "cantidad_suscriptores": None,
            }).execute()
            log.info("Borrador guardado. Queda sin enviar hasta que lo mandes.")
        except Exception as e:
            log.error("No se pudo guardar: %s", str(e)[:200])
            sys.exit(1)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--desde", help="AAAA-MM-DD")
    ap.add_argument("--hasta", help="AAAA-MM-DD")
    ap.add_argument("--maximo", type=int, default=6)
    ap.add_argument("--guardar", action="store_true")
    args = ap.parse_args()

    Generador(
        desde=date.fromisoformat(args.desde) if args.desde else None,
        hasta=date.fromisoformat(args.hasta) if args.hasta else None,
        maximo=args.maximo,
    ).correr(guardar=args.guardar)
