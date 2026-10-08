# Ciclo de control documental EUCLIDIAN

## Alcance y fuente de verdad

El inspector recorre **todos** los registros de `documentos_tributarios` en cada ejecución. Comprueba estructura y fechas; visita un conjunto rotativo de enlaces DIAN y todos los documentos recientes; contrasta los casos centinela con el Normograma. El número de enlaces visitados nunca representa verificación HTTP de todo el corpus.

Cada hallazgo se identifica por documento y código en `control_interno_expedientes`. Se conserva la primera detección, el último control, intentos, fuente y evidencia. Las ejecuciones históricas no se borran.

## Estados y decisión

| Estado | Significado | Acción |
|---|---|---|
| `abierto` | Falta contraste o corrección demostrable. | Leer el acto DIAN y registrar la corrección exacta. |
| `en_cuarentena` | El motivo afecta una ficha publicada y puede inducir a error. | Mantener fuera de biblioteca y correo hasta subsanar. |
| `correccion_verificada` | El dato cambió contra fuente DIAN y una segunda inspección ya no detecta el motivo; la ficha sigue retirada. | Cotejar fuente, fecha, síntesis y alcance en el panel privado; republicar solo si pasa la puerta de calidad. |
| `resuelto_verificado` | Ficha republicada y motivo ausente en inspección completa posterior. | Conservar trazabilidad y vigilar recurrencia. |

La ausencia de un motivo causada solo por retirar una ficha **no** cierra el caso. Los plazos y las citas se inspeccionan también mientras la ficha está retirada. Un error de red no prueba que un acto haya dejado de existir. Un cambio de URL solo se acepta si identifica el mismo documento oficial.

## Orden diario

1. Ingesta DIAN y conservación de URL, fecha y texto fuente.
2. Inspector integral; ejecución técnica fallida o incompleta detiene el ciclo. Los hallazgos documentales quedan como `alerta`, sin ocultar la cobertura.
3. Agente de integridad: abre o actualiza expedientes; corrige solo datos literales que puede reconstruir del HTML DIAN actual. Guarda URL, momento y huella del contenido leído. Retira temporalmente fichas afectadas de la biblioteca y revoca su aprobación para correo.
4. Segunda inspección integral y comprobación del motivo original. Una escritura sin reinspección permanece abierta.
5. Revisión de expedientes pendientes en el panel privado. Para `correccion_verificada`, la publicación exige síntesis suficiente, fuente oficial, inspección reciente y ningún bloqueo.
6. Inspección posterior a la publicación cierra el expediente si el motivo sigue ausente. La recurrencia reabre la misma clave.
7. Antes de enviar un correo se vuelven a consultar aprobación, publicación, inspección vigente y expedientes bloqueantes. Si algo falla, el envío se detiene.

## Prioridad de tratamiento

1. Fuente inaccesible, identificación incorrecta, duplicado, fechas imposibles u orden invertido, plazo cortado y discrepancia centinela.
2. Citas y efectos retroactivos sin período documentado.
3. Fechas no verificadas y fichas escasas: no inventar un día ni completar la síntesis por inferencia. Buscar evidencia explícita en el documento DIAN. Si no existe, indicar el límite del dato al lector.

El objetivo operativo es reducir la cola, no declarar `cero pendientes` mientras exista evidencia incompleta. El panel debe mostrar conteos reales, antigüedad y pasos siguientes. Ninguna métrica de cobertura estructural equivale por sí sola a validación jurídica de cada documento.
