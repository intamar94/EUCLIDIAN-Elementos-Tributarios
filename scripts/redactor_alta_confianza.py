"""EUCLIDIAN — redacción segura.

Este paso redacta; no concede confianza. La aprobación final la concede
verificador_aprobacion.py después de comprobar el resultado contra la fuente
oficial permitida.
"""
import argparse
from redactor_reglas import RedactorReglas


class RedactorAltaConfianza(RedactorReglas):
    def _normalizar_confianza(self, d, ficha):
        ficha["confianza"] = "pendiente_verificacion"
        avisos = list(ficha.get("advertencias") or [])
        avisos.append("Pendiente de verificación automática contra la fuente oficial.")
        ficha["advertencias"] = avisos
        return ficha

    def _guardar(self, d, ficha):
        super()._guardar(d, self._normalizar_confianza(d, ficha))

    def correr(self):
        docs = self._cola()
        if not docs:
            return
        for d in docs:
            ficha = self._normalizar_confianza(d, self.componer(d))
            self.stats["pendiente_verificacion"] += 1
            if self.dry_run:
                print(f"{d['numero_resolucion']} [PENDIENTE] {ficha['resumen']}")
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
    RedactorAltaConfianza(limite=args.limite, anio=args.anio,
                          dry_run=args.dry_run, rehacer=args.rehacer).correr()
