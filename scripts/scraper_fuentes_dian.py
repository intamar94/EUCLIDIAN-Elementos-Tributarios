"""Entrada segura del scraper DIAN usando las dos fuentes raíz oficiales.

Las dos raíces son los únicos puntos de entrada. La validación conoce las
subpáginas tributarias oficiales actuales porque la navegación de la DIAN usa
controles dinámicos; no depende de que esos controles aparezcan como href en
una descarga HTTP simple.
"""
import argparse
import scraper
from validar_fuentes_dian import INDICES_ESPERADOS, main as validar_fuentes

CATEGORIAS = {
    "nyb_novedades_derecho_tributario.html": "boletin",
    "t_1_normativa_tributaria.html": "normativa",
    "t_2_doctrina_tributaria.html": "doctrina",
    "t_3_jurisprudencia_tributaria.html": "jurisprudencia",
}

def descubrir_indices():
    """Usa exclusivamente las subpáginas oficiales ya validadas."""
    resultado = []
    for archivo, (_raiz, url) in INDICES_ESPERADOS.items():
        stem = archivo[:-5] if archivo.endswith(".html") else archivo
        categoria = CATEGORIAS[archivo]
        resultado.append((stem, categoria))
        print(f"  FUENTE REAL: {url} -> {categoria}")
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
