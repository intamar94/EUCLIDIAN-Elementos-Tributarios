"""Modelo normalizado para documentos descubiertos desde las raíces DIAN."""
from __future__ import annotations

from dataclasses import asdict, dataclass
from hashlib import sha256
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from validar_fuentes_dian import es_contenido_dian


@dataclass(frozen=True)
class DocumentoDescubierto:
    url: str
    raiz: str
    titulo: str
    texto: str
    huella_contenido: str
    dominio: str
    ruta: str
    estado: str = "descubierto"

    def to_dict(self) -> dict:
        return asdict(self)


def normalizar_documento(url: str, raiz: str, html: str) -> DocumentoDescubierto:
    if not es_contenido_dian(url):
        raise ValueError("Documento fuera de la fuente DIAN autorizada")
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    titulo = soup.title.get_text(" ", strip=True) if soup.title else ""
    texto = soup.get_text(" ", strip=True)
    texto = " ".join(texto.split())
    huella = sha256(texto.encode("utf-8")).hexdigest()
    parsed = urlparse(url)
    return DocumentoDescubierto(
        url=url,
        raiz=raiz,
        titulo=titulo[:500],
        texto=texto,
        huella_contenido=huella,
        dominio=parsed.netloc,
        ruta=parsed.path,
    )
