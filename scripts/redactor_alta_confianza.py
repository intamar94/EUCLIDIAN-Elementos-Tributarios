"""EUCLIDIAN — Redacción con control estricto de confianza.

No permite que un borrador sea marcado como "alta" solo por acumular
metadatos. Para alta confianza debe existir evidencia jurídica directa en
el documento, especialmente una tesis/respuesta explícita o un caso interno
claramente identificado.
"""

import argparse

from redactor_reglas import RedactorReglas


class RedactorAltaConfianza(RedactorReglas):
    def _normalizar_confianza(self, d, ficha):
        if ficha.get("interno"):
            ficha["confianza"] = "alta"
            return ficha

        tesis = (d.get("tesis_juridica") or "").strip()
        respuesta = d.get("tesis_respuesta")
        fecha_real = bool(d.get("fecha_es_real"))
        oficial = str(d.get("enlace_oficial") or "").startswith(
            "https://normograma.dian.gov.co/dian/compilacion/"
        )

        # Alta solo cuando la afirmación principal tiene respaldo directo.
        # Los metadatos por sí solos nunca elevan la confianza a alta.
        evidencia_directa = len(tesis) >= 25 and respuesta in {
            "si", "no", "matizada"
        }

        if ficha.get("confianza") == "alta" and not (
            evidencia_directa and fecha_real and oficial
        ):
            ficha["confianza"] = "media"
            ficha.setdefault("advertencias", []).append(
                "La información está basada en datos verificados, pero la conclusión principal no tiene una tesis/respuesta jurídica explícita suficiente para marcarla como alta."
            )

        if ficha.get("confianza") == "alta" and not fecha_real:
            ficha["confianza"] = "media"

        return ficha

    def _guardar(self, d, ficha):
        ficha = self._normalizar_confianza(d, ficha)
        super()._guardar(d, ficha)

    def correr(self):
        # Igual que el redactor existente, pero aplica el control antes de
        # guardar y antes de contabilizar la confianza.
        docs = self._cola()
        if not docs:
            return

        for i, d in enumerate(docs, 1):
            ficha = self.componer(d)
            ficha = self._normalizar_confianza(d, ficha)
            self.stats[f"confianza_{ficha['confianza']}"] += 1
            if ficha.get("interno"):
                self.stats["interno_descartable"] += 1

            if self.dry_run:
                print(
                    f"{d['numero_resolucion']} [{ficha['confianza'].upper()}] "
                    f"{ficha['resumen']}"
                )
                for aviso in ficha.get("advertencias", []):
                    print(f"  OJO: {aviso}")
            else:
                self._guardar(d, ficha)

        self._resumen()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limite", type=int, default=300)
    ap.add_argument("--anio", type=int, default=None)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--rehacer", action="store_true")
    args = ap.parse_args()

    RedactorAltaConfianza(
        limite=args.limite,
        anio=args.anio,
        dry_run=args.dry_run,
        rehacer=args.rehacer,
    ).correr()
