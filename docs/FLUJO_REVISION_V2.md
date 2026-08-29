# EUCLIDIAN — Flujo de revisión profesional v2

## Objetivo

Procesar el universo documental sin detener el pipeline por un caso difícil. Un documento que no satisface una regla vuelve a revisión con diagnóstico y se reprocesa; los casos persistentes se escalan sin bloquear el resto.

## Cadena

1. Captura: únicamente fuentes DIAN autorizadas.
2. Filtro jurídico: identifica tipo, autoridad, fechas, asunto, problema, normas, tesis, alcance, excepciones y vigencia.
3. Extracción: genera datos estructurados y conserva evidencia por campo.
4. Normalización: reconoce equivalencias de redacción, fechas, números, artículos y conceptos sin alterar el significado jurídico.
5. Clasificación: materia, naturaleza, tema, sujetos afectados, obligación, periodo e impacto.
6. Ficha para contador: resume qué cambió, a quién afecta, desde cuándo, qué debe revisar/hacer, excepciones, riesgos y soporte.
7. Revisor fiscal: comprueba evidencia, interpretación, utilidad contable, excepciones y vigencia.
8. Decisión: APPROVE, REVIEW o ESCALATE. No se utiliza BLOCK como estado de flujo.
9. Aprendizaje: cada devolución registra causa, campo, patrón, corrección y regla reutilizable.
10. Reprocesamiento: el caso vuelve a extracción/normalización/clasificación/revisión cuando la causa sea corregible.
11. Escalado: si persiste después del máximo de iteraciones configurado, se separa para revisión especializada y no detiene otros documentos.

## Principios del revisor

- Nunca aprobar por similitud superficial.
- Diferenciar variación sintáctica de cambio material.
- Tratar como críticas las diferencias de sujeto, periodo, impuesto, condición, excepción, cuantía, vigencia o alcance.
- Cada afirmación crítica debe conservar fuente y evidencia.
- Si falta evidencia, pedir reproceso; no inventar.
- La incertidumbre se registra como dato del sistema y alimenta las reglas futuras.

## Estados de trabajo

- `EXTRACTING`
- `NORMALIZING`
- `CLASSIFYING`
- `READY_FOR_REVIEW`
- `REVIEW`
- `CORRECTING`
- `ESCALATED`
- `APPROVED`

`ESCALATED` significa que ese documento requiere intervención adicional; no significa detener el pipeline global.

## Métrica de calidad

La cobertura nunca sustituye la evidencia. El objetivo es aumentar progresivamente la proporción de documentos que llegan a `APPROVED` mediante mejores extracción, normalización y reglas, no relajando los criterios de evidencia.
