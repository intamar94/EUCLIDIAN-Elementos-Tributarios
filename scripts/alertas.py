"""EUCLIDIAN — Elementos Tributarios
Alertas automaticas

Crea una alerta cuando el documento trae algo que no puede pasar
inadvertido: una norma caida, efectos sobre años ya declarados, o un
plazo con fecha.

Aparte del enriquecedor porque decide QUE merece alarma, y eso cambia
por razones distintas a como se lee una pagina.
"""


import logging
import re

log = logging.getLogger("euclidian")


class Alertas:
    """Deteccion de lo que merece aviso. Enriquecedor hereda de aqui."""

    def _alertas(self, doc, campos, anotaciones, retro, zonas):
        """
        Crea alertas solo cuando hay algo que un contador no puede pasar
        por alto. Cada alerta nace sin aprobar: tu la revisas.
        """
        alertas = []

        if campos.get("estado_vigencia") == "suspendido":
            alertas.append(("critica", "doctrina_revocada",
                            campos.get("motivo_cambio_estado", "Suspendido")))
        elif campos.get("estado_vigencia") == "inexequible":
            alertas.append(("critica", "doctrina_revocada",
                            campos.get("motivo_cambio_estado", "Inexequible")))

        if retro and campos.get("anos_afectados"):
            anios = ", ".join(str(a) for a in campos["anos_afectados"])
            alertas.append(("alta", "efecto_retroactivo",
                            f"Menciona años anteriores ({anios}). "
                            f"Puede afectar declaraciones ya presentadas."))

        if zonas:
            alertas.append(("alta", "desastre_natural",
                            f"Medida territorial. Zonas: {', '.join(zonas[:6])}"))

        if campos.get("plazos_mencionados"):
            texto_plazos = " ".join(campos["plazos_mencionados"]).lower()
            if re.search(r"cuota|declaren|vencimiento|a m[aá]s tardar", texto_plazos):
                alertas.append(("media", "plazo_proximo",
                                campos["plazos_mencionados"][0][:400]))

        for nivel, tipo, descripcion in alertas:
            try:
                self.db.table("alertas_urgentes").upsert({
                    "documento_id": doc["id"],
                    "nivel_urgencia": nivel,
                    "tipo_alerta": tipo,
                    "descripcion": descripcion[:1000],
                    "zonas_afectadas": zonas[:15] if zonas else [],
                    "aprobada_por_humano": False,
                    "enviada": False,
                }, on_conflict="documento_id,tipo_alerta").execute()
                self.stats[f"alerta_{nivel}"] += 1
            except Exception as e:
                log.debug("alerta no creada: %s", str(e)[:120])
