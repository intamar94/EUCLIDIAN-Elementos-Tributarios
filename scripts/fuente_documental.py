"""Captura reproducible de HTML/PDF oficiales, sin resumir ni atribuir vigencia."""
from __future__ import annotations

import hashlib
import io
import re
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup
from pypdf import PdfReader

MAX_BYTES = 25 * 1024 * 1024
MAX_PAGES = 1500
HOSTS = {"normograma.dian.gov.co", "www.dian.gov.co", "dian.gov.co"}


def url_oficial(url):
    p = urlsplit(url)
    return (p.scheme == "https" and p.hostname in HOSTS and not p.username
            and not p.password and p.port in (None, 443))


def canonica(url):
    p = urlsplit(url)
    return urlunsplit((p.scheme.lower(), p.netloc.lower(), p.path, p.query, ""))


def descargar(session, url):
    """Valida cada salto antes de solicitarlo; nunca descarga destinos externos."""
    current = canonica(url)
    for _ in range(6):
        if not url_oficial(current):
            raise ValueError("URL fuera de los dominios oficiales DIAN")
        response = session.get(current, timeout=(10, 60), allow_redirects=False, stream=True)
        if response.status_code in (301, 302, 303, 307, 308):
            location = response.headers.get("Location")
            response.close()
            if not location:
                raise ValueError("Redirección sin destino")
            current = canonica(urljoin(current, location))
            continue
        response.raise_for_status()
        chunks, size = [], 0
        try:
            for chunk in response.iter_content(65536):
                size += len(chunk)
                if size > MAX_BYTES:
                    raise ValueError("Documento excede el límite de captura de 25 MiB")
                chunks.append(chunk)
            return b"".join(chunks), current, response.headers.get("Content-Type", "")
        finally:
            response.close()
    raise ValueError("Demasiadas redirecciones de la fuente")


def limpiar_texto(texto):
    texto = re.sub(r"[\t \xa0]+", " ", texto)
    return re.sub(r"\n[ \t]*\n(?:[ \t]*\n)+", "\n\n", texto).strip()


@dataclass(frozen=True)
class Captura:
    url: str
    texto: str
    huella: str
    estado: str
    paginas: int | None = None
    html: str = ""


def extraer_contenido(data, url, content_type=""):
    if data.startswith(b"%PDF-"):
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted and not reader.decrypt(""):
            raise ValueError("PDF cifrado; no fue posible capturar el texto")
        if len(reader.pages) > MAX_PAGES:
            raise ValueError("PDF excede el límite de páginas")
        pages = [limpiar_texto(page.extract_text() or "") for page in reader.pages]
        # Mantener las páginas permite citar el texto sin confundir el orden.
        text = "\n\n".join(f"[Página {i}]\n{p}" for i, p in enumerate(pages, 1))
        state = "completo" if all(pages) else "parcial" if any(pages) else "sin_texto"
        if not any(pages):
            text = ""
        digest = hashlib.sha256(text.encode("utf-8") if text else data).hexdigest()
        return Captura(url, text, digest, state, len(pages))
    if "pdf" in content_type.lower() or urlsplit(url).path.lower().endswith(".pdf"):
        raise ValueError("La fuente PDF devolvió un contenido distinto de PDF")
    soup = BeautifulSoup(data, "html.parser")
    html = str(soup)
    for tag in soup(["script", "style", "nav", "footer", "noscript"]):
        tag.decompose()
    # No recortar a 60.000 caracteres: el final puede contener excepciones.
    text = limpiar_texto(soup.get_text("\n", strip=True))
    if len(text) < 80:
        raise ValueError("La página no contiene texto documental suficiente")
    return Captura(url, text, hashlib.sha256(text.encode("utf-8")).hexdigest(), "completo", html=html)


def capturar(session, url):
    data, final, content_type = descargar(session, url)
    return extraer_contenido(data, final, content_type)
