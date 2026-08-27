"""Entrada segura del scraper DIAN usando las dos fuentes raíz oficiales."""
import argparse
import scraper
from validar_fuentes_dian import main as validar_fuentes

CATEGORIAS = {
    "nyb_novedades_derecho_tributario": "boletin",
    "t_1_normativa_tributaria": "normativa",
    "t_2_doctrina_tributaria": "doctrina",
    "t_3_jurisprudencia_tributaria": "jurisprudencia",
}


def descubrir_indices():
    """Usa únicamente los índices internos autorizados del Normograma DIAN."""
    resultado = []
    for stem, categoria in scraper.INDICES:
        if stem not in CATEGORIAS:
            raise RuntimeError(f"Índice no autorizado: {stem}")
        resultado.append((stem, categoria))
        print(f"  FUENTE DERIVADA DIAN: {stem}.html -> {categoria}")
    return resultado


def main():
    if validar_fuentes() != 0:
        return 1
    scraper.INDICES = descubrir_indices()
    print("INDICES_DIAN_VALIDADOS_OK")
    ap = argparse.ArgumentParser()
    ap.add_argument("--historico", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--anios", type=int, default=3)
    args = ap.parse_args()
    s = scraper.Scraper(historico=args.historico, dry_run=args.dry_run, anios_recientes=args.anios)
    s.correr()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
