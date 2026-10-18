#!/usr/bin/env python3
"""Laboratorio local y explícito; no se integra al servidor ni publica resultados."""
import argparse
import json
import time
from pathlib import Path


def entradas(ruta, clave):
    datos = json.loads(Path(ruta).read_text(encoding="utf-8"))
    if not isinstance(datos, dict) or not isinstance(datos.get(clave), list):
        raise ValueError(f"Se requiere una lista {clave} en {ruta}")
    return datos


def main():
    p = argparse.ArgumentParser(description="Comparar embeddings sobre una muestra DIAN aprobada, sin red")
    p.add_argument("--corpus", required=True, help="JSON: corpus_version, documents:[{id,text,source_url}]")
    p.add_argument("--queries", required=True, help="JSON: queries:[{id,text}]")
    p.add_argument("--model", required=True, help="Directorio local de pesos BGE-M3 o Qwen3 Embedding")
    p.add_argument("--reranker", help="Directorio local de BGE Reranker v2 M3 (opcional)")
    p.add_argument("--system", required=True, help="Nombre descriptivo del modelo y configuración")
    args = p.parse_args()
    corpus = entradas(args.corpus, "documents")
    consultas = entradas(args.queries, "queries")["queries"]
    documentos = corpus["documents"]
    if not corpus.get("corpus_version") or not 1 <= len(documentos) <= 2000 or not 1 <= len(consultas) <= 100:
        raise ValueError("Versión obligatoria; máximo 2.000 documentos y 100 consultas")
    if not Path(args.model).is_dir() or (args.reranker and not Path(args.reranker).is_dir()):
        raise ValueError("Los pesos deben existir en directorios locales; no se descargan automáticamente")
    ids = set()
    for d in documentos:
        if not all(isinstance(d.get(k), str) and d[k] for k in ("id", "text", "source_url")):
            raise ValueError("Cada documento requiere id, text y source_url")
        if d["id"] in ids or len(d["text"]) > 12000 or not d["source_url"].startswith("https://"):
            raise ValueError("Identificador duplicado, fragmento extenso o URL inválida")
        ids.add(d["id"])
    if any(not isinstance(q.get("id"), str) or not isinstance(q.get("text"), str) or not q["text"] for q in consultas):
        raise ValueError("Consultas inválidas")

    # La importación ocurre después de validar rutas y tamaño; instalar solo en el laboratorio.
    from sentence_transformers import SentenceTransformer, CrossEncoder

    modelo = SentenceTransformer(args.model, local_files_only=True, trust_remote_code=False)
    reranker = CrossEncoder(args.reranker, local_files_only=True, trust_remote_code=False) if args.reranker else None
    textos = [d["text"] for d in documentos]
    vectores = modelo.encode(textos, normalize_embeddings=True, convert_to_numpy=True, batch_size=8)
    resultados = []
    for q in consultas:
        inicio = time.perf_counter()
        consulta = q["text"]
        vector = modelo.encode([consulta], normalize_embeddings=True, convert_to_numpy=True)[0]
        puntuaciones = vectores @ vector
        orden = sorted(range(len(documentos)), key=lambda i: float(puntuaciones[i]), reverse=True)[:50]
        if reranker:
            pares = [(consulta, textos[i]) for i in orden]
            valores = reranker.predict(pares, batch_size=8)
            orden = [i for _, i in sorted(zip(valores, orden), key=lambda x: float(x[0]), reverse=True)]
        # La coincidencia exacta del identificador siempre conserva la primera posición.
        exacta = next((i for i, d in enumerate(documentos) if d["id"].casefold() == consulta.casefold().strip()), None)
        if exacta is not None:
            orden = [exacta] + [i for i in orden if i != exacta]
        candidatos = [{"id": documentos[i]["id"], "source_url": documentos[i]["source_url"]} for i in orden[:10]]
        resultados.append({"query_id": q["id"], "latency_ms": round((time.perf_counter() - inicio) * 1000), "candidates": candidatos})
    print(json.dumps({"system": args.system, "corpus_version": corpus["corpus_version"],
                      "results": resultados, "timing_note": "latency_ms excluye carga de modelos e indexación inicial"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
