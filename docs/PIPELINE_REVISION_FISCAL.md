# EUCLIDIAN — Pipeline de revisión fiscal v2

## Objetivo
Convertir cada documento DIAN en una ficha fiscal trazable para un contador. EUCLIDIAN no debe confundir un caso difícil de interpretar con un documento inválido.

## Cadena obligatoria

1. **Capturar** — obtener únicamente de las fuentes DIAN autorizadas.
2. **Filtrar jurídicamente** — identificar tipo, autoridad, fecha, publicación, problema, hechos, normas, tesis, excepciones, vigencia y relaciones.
3. **Extraer** — conservar los datos estructurados y los fragmentos de evidencia.
4. **Normalizar** — reconocer equivalencias de sintaxis sin alterar el significado.
5. **Clasificar** — tema, naturaleza, obligación, sujeto afectado, impuesto, periodo y relevancia para contador.
6. **Preparar ficha fiscal** — presentar primero la información operativa y después el detalle jurídico.
7. **Revisar fiscalmente** — comprobar evidencia, interpretación, utilidad, excepciones y vigencia.
8. **Decidir** — aprobar o devolver a corrección.

## Bucle de aprendizaje

Cuando una regla falla:

`REVISIÓN → DIAGNÓSTICO → CORRECCIÓN → NORMALIZACIÓN/EXTRACCIÓN → REVISIÓN`

La causa del fallo debe conservarse para mejorar reglas futuras. Nunca se debe inventar un dato para hacer pasar una revisión.

## Estados operativos

- `APPROVE`: todos los controles críticos demostrados.
- `REVIEW`: falta evidencia, hay ambigüedad o existe una advertencia que debe resolverse. El documento vuelve al ciclo; no bloquea el pipeline.
- `ESCALATE`: después de iteraciones configurables sigue existiendo una cuestión que requiere criterio especializado. El caso se aparta, pero el resto del lote continúa.

No existe un estado operativo `BLOCK` en el revisor fiscal.

## Criterios del revisor

- Evidencia suficiente.
- Interpretación jurídicamente coherente.
- Información útil para contador.
- Excepciones identificadas.
- Vigencia comprobada.
- Fuente oficial trazable.

## Principio de seguridad

La ausencia de evidencia no autoriza a rellenar con una suposición. El sistema debe devolver el caso a revisión y explicar exactamente qué falta.

## Escalado sin detener el sistema

Un documento difícil no debe detener un lote de miles de documentos. El caso se marca para revisión especializada y el pipeline continúa con los demás.

## Resultado para el contador

La ficha final debe responder, como mínimo:

- ¿Qué documento es?
- ¿Qué problema resuelve?
- ¿Cuál es la respuesta de DIAN?
- ¿A quién afecta?
- ¿Qué norma/artículo interviene?
- ¿Desde cuándo?
- ¿Qué cambió o qué obligación determina?
- ¿Qué debe revisar/hacer el contador?
- ¿Qué excepciones existen?
- ¿Cuál es la evidencia exacta?
- ¿Qué nivel de confianza tiene?
