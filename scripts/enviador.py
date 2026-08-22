"""
EUCLIDIAN — Elementos Tributarios
Enviador del boletin

Toma el borrador que dejo el generador y lo manda a los suscriptores
confirmados.

POR QUE TANTAS PROTECCIONES
---------------------------
Un correo enviado no se puede recoger. Si sale con un dato equivocado,
un contador puede tomar una decision sobre la declaracion de un cliente
con base en eso. Por eso este script:

  - No envia nada sin --confirmar. El modo por defecto solo muestra.
  - Revisa que cada documento incluido siga vigente en la base. Si una
    norma fue suspendida entre que la aprobaste y el envio, se detiene.
  - Verifica que todos los enlaces apunten al normograma oficial.
  - Manda primero una prueba a tu correo si usas --prueba.
  - Registra que se envio, a cuantos y cuando.

Preferible no enviar a enviar mal.

CONFIGURACION
-------------
    RESEND_API_KEY      clave de resend.com
    EUCLIDIAN_REMITENTE opcional. Por defecto usa onboarding@resend.dev,
                        que sirve para probar sin dominio propio.
    EUCLIDIAN_BASE_URL  para armar el enlace de baja.

USO
---
    python enviador.py                          # muestra, no envia
    python enviador.py --prueba tu@correo.com   # solo a esa direccion
    python enviador.py --confirmar              # envia de verdad
"""

import argparse
import logging
import os
import re
import sys
import time
from collections import Counter
from datetime import datetime, timezone

import requests

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
RESEND_KEY = os.getenv("RESEND_API_KEY")
REMITENTE = os.getenv("EUCLIDIAN_REMITENTE",
                      "EUCLIDIAN <onboarding@resend.dev>")
BASE_URL = os.getenv("EUCLIDIAN_BASE_URL", "https://euclidian.co")

RESEND_API = "https://api.resend.com/emails"
DOMINIO_OFICIAL = "normograma.dian.gov.co"
PAUSA = 0.6  # Resend admite mas, pero no hay prisa


class Enviador:
    def __init__(self, confirmar=False, prueba=None):
        self.confirmar = confirmar
        self.prueba = prueba
        self.stats = Counter()

        if not SUPABASE_URL or not SUPABASE_KEY:
            log.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
            sys.exit(1)
        self.db = create_client(SUPABASE_URL, SUPABASE_KEY)

        if (confirmar or prueba) and not RESEND_KEY:
            log.error("Falta RESEND_API_KEY")
            sys.exit(1)

    # ==================================================================

    def correr(self):
        log.info("=" * 62)
        log.info("EUCLIDIAN — envio del boletin")
        log.info("=" * 62)

        borrador = self._borrador()
        if not borrador:
            return

        log.info("Borrador #%s del %s", borrador["numero_secuencia"],
                 borrador["fecha_envio"])
        log.info("Asunto: %s", borrador["asunto"])

        if not self._revisar(borrador):
            log.error("")
            log.error("No se envia. Corrige y vuelve a generar el borrador.")
            sys.exit(1)

        if self.prueba:
            self._enviar_uno(self.prueba, borrador, es_prueba=True)
            log.info("")
            log.info("Prueba enviada a %s.", self.prueba)
            log.info("Revisala en el telefono antes de mandarla a nadie mas.")
            return

        destinatarios = self._destinatarios()
        if not destinatarios:
            log.warning("No hay suscriptores confirmados y activos.")
            log.warning("Agrega al menos uno antes de enviar.")
            return

        log.info("Suscriptores: %d", len(destinatarios))

        if not self.confirmar:
            log.info("")
            log.info("MODO VISTA. No se envio nada.")
            log.info("Destinatarios que recibirian el boletin:")
            for s in destinatarios[:10]:
                log.info("   %s", s["email"])
            if len(destinatarios) > 10:
                log.info("   ...y %d mas", len(destinatarios) - 10)
            log.info("")
            log.info("Para enviar de verdad: --confirmar")
            return

        for s in destinatarios:
            self._enviar_uno(s["email"], borrador, token_baja=s.get("token_baja"))
            time.sleep(PAUSA)

        self._marcar_enviado(borrador)
        self._resumen()

    # ==================================================================

    def _borrador(self):
        try:
            r = self.db.table("emails_enviados").select("*").is_(
                "cantidad_suscriptores", "null"
            ).order("created_at", desc=True).limit(1).execute()
        except Exception as e:
            log.error("No se pudo leer el borrador: %s", str(e)[:200])
            sys.exit(1)

        if not r.data:
            log.warning("No hay borradores sin enviar.")
            log.warning("Corre primero: python generador.py --guardar")
            return None
        return r.data[0]

    # ------------------------------------------------------------------

    def _revisar(self, borrador):
        """
        Comprobaciones antes de enviar. Cualquiera que falle detiene todo.
        """
        ok = True
        html = borrador.get("contenido_html") or ""
        ids = borrador.get("documentos_incluidos") or []

        log.info("")
        log.info("Revision previa")

        # 1. Hay contenido
        if len(html) < 500:
            log.error("  [x] El HTML esta vacio o es demasiado corto")
            ok = False
        else:
            log.info("  [ok] HTML de %d caracteres", len(html))

        # 2. Hay documentos
        if not ids:
            log.error("  [x] El borrador no incluye ningun documento")
            return False
        log.info("  [ok] %d documentos incluidos", len(ids))

        # 3. Los documentos siguen aprobados y su estado no cambio
        try:
            r = self.db.table("documentos_tributarios").select(
                "numero_resolucion,estado_vigencia,aprobado_para_email,"
                "enlace_oficial"
            ).in_("id", ids).execute()
            docs = r.data or []
        except Exception as e:
            log.error("  [x] No se pudieron verificar los documentos: %s",
                      str(e)[:150])
            return False

        if len(docs) != len(ids):
            log.error("  [x] Faltan documentos: se esperaban %d y hay %d",
                      len(ids), len(docs))
            ok = False

        for d in docs:
            if not d["aprobado_para_email"]:
                log.error("  [x] %s ya no esta aprobado", d["numero_resolucion"])
                ok = False
            if d["estado_vigencia"] not in ("vigente",):
                # No es un error, pero debe estar advertido en el correo
                if "SUSPENDID" not in html.upper() and \
                   "REVOCAD" not in html.upper() and \
                   "DEROGAD" not in html.upper() and \
                   "INEXEQUIB" not in html.upper():
                    log.error("  [x] %s esta %s y el correo no lo advierte",
                              d["numero_resolucion"], d["estado_vigencia"])
                    ok = False
        if ok:
            log.info("  [ok] Todos siguen aprobados y su estado esta advertido")

        # 4. Los enlaces apuntan a la fuente oficial
        enlaces = re.findall(r'href="(https?://[^"]+)"', html)
        externos = [e for e in enlaces
                    if DOMINIO_OFICIAL not in e
                    and "{{UNSUBSCRIBE}}" not in e
                    and BASE_URL not in e]
        if externos:
            log.error("  [x] Enlaces que no van al normograma oficial:")
            for e in externos[:5]:
                log.error("        %s", e[:100])
            ok = False
        else:
            log.info("  [ok] Los %d enlaces apuntan al normograma", len(enlaces))

        # 5. Hay via de baja
        if "{{UNSUBSCRIBE}}" not in html:
            log.error("  [x] Falta el enlace para darse de baja")
            ok = False
        else:
            log.info("  [ok] Incluye enlace de baja")

        return ok

    # ------------------------------------------------------------------

    def _destinatarios(self):
        try:
            r = self.db.table("suscriptores").select(
                "id,email,nombre,token_baja"
            ).eq("confirmado", True).eq("activo", True).execute()
            return r.data or []
        except Exception as e:
            log.error("No se pudieron leer los suscriptores: %s", str(e)[:200])
            sys.exit(1)

    # ------------------------------------------------------------------

    def _enviar_uno(self, email, borrador, token_baja=None, es_prueba=False):
        html = borrador["contenido_html"]
        enlace_baja = (f"{BASE_URL}/api/baja?t={token_baja}"
                       if token_baja else f"{BASE_URL}/baja")
        html = html.replace("{{UNSUBSCRIBE}}", enlace_baja)

        asunto = borrador["asunto"]
        if es_prueba:
            asunto = f"[PRUEBA] {asunto}"

        try:
            r = requests.post(
                RESEND_API,
                headers={
                    "Authorization": f"Bearer {RESEND_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": REMITENTE,
                    "to": [email],
                    "subject": asunto,
                    "html": html,
                    "headers": {
                        "List-Unsubscribe": f"<{enlace_baja}>",
                        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                    },
                },
                timeout=25,
            )
            if r.status_code in (200, 201):
                self.stats["enviados"] += 1
                log.info("  enviado  %s", email)
            else:
                self.stats["fallidos"] += 1
                log.error("  fallo    %s  (%s) %s", email, r.status_code,
                          r.text[:160])
        except requests.RequestException as e:
            self.stats["fallidos"] += 1
            log.error("  fallo    %s  %s", email, str(e)[:140])

    # ------------------------------------------------------------------

    def _marcar_enviado(self, borrador):
        try:
            self.db.table("emails_enviados").update({
                "cantidad_suscriptores": self.stats["enviados"],
            }).eq("id", borrador["id"]).execute()
        except Exception as e:
            log.error("No se pudo marcar como enviado: %s", str(e)[:200])

    def _resumen(self):
        log.info("")
        log.info("=" * 62)
        log.info("Enviados: %d   Fallidos: %d",
                 self.stats["enviados"], self.stats["fallidos"])
        if self.stats["fallidos"]:
            log.warning("Revisa los correos fallidos antes del proximo envio.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--confirmar", action="store_true",
                    help="Enviar de verdad a todos los suscriptores")
    ap.add_argument("--prueba", metavar="CORREO",
                    help="Enviar solo a esa direccion, marcado como prueba")
    args = ap.parse_args()

    Enviador(confirmar=args.confirmar, prueba=args.prueba).correr()
