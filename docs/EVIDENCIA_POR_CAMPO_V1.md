# EUCLIDIAN · Contrato de evidencia jurídica por campo

**Etapa 2 / avance 1 — 18 de octubre de 2026** · Seguimiento jurídico [#88](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/88) y negocio [#93](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/93).

## Qué se entrega ahora
La ficha práctica y el informe técnico exponen un **mapa de seis estados de evidencia**. Cada campo se distingue como **dato registrado** o **por confirmar**. La etiqueta registrada no significa que el documento original esté disponible hoy ni que el criterio sea aplicable a un cliente concreto. Esta matriz es un instrumento de revisión profesional, no una certificación jurídica.

| Campo | Puede aparecer registrado cuando | Lo que NO se afirma |
| --- | --- | --- |
| Fuente oficial | enlace HTTPS con host DIAN permitido | que esté accesible o su contenido sea actual |
| Fecha del acto | fecha válida, bandera `fecha_es_real=true` y año coherente con referencia | entrada en vigor o plazo fiscal |
| Síntesis | `APPROVE`, estado `verificado_oficial`, fuente válida y resumen admitido por API | revisión humana o cita de cada afirmación |
| Cambio normativo | **siempre por confirmar** hasta disponer de cita por pasaje | que `modifica_a` por sí solo pruebe un cambio |
| Sujetos y excepciones | **siempre por confirmar** hasta cotejar condiciones explícitas | que una coincidencia temática cree obligación |
| Fecha de aplicación | **siempre por confirmar** aunque haya fecha registrada en catálogo | que `fecha_entrada_vigencia` baste para una recomendación individual |

## Principios obligatorios para la siguiente versión
1. Crear una entidad de **afirmación documental** por campo con `documento_id`, clase (cambio/fecha/sujetos/excepción), texto exacto y estado (pendiente/aceptado/rechazado).
2. Vincular cada afirmación a una **evidencia individual**: URL oficial HTTPS, hash del contenido examinado, versión, página/epígrafe, pasaje exacto acotado y fecha de cotejo.
3. Registrar revisión humana independiente: revisor autorizado, fecha, fundamento y registro inmutable de decisión. **No deducir** revisión humana del estado automático `APPROVE`.
4. Si el documento oficial cambia de hash, el campo pasa a **revisión pendiente**. Las alertas relacionadas deben suspender recomendaciones afirmativas hasta nuevo cotejo.
5. Exponer a cliente solo afirmaciones aprobadas explícitamente para la versión en vigor; si no están aprobadas, mostrar "Por confirmar" y enlace primario.
6. No almacenar NIT, saldos o identidades de clientes en esta entidad; perfiles por usuario requieren otra puerta de privacidad, RLS y borrado probado.
7. Mantener el registro, los cobros y publicación legal bajo la compuerta LEGAL.ia; esta mejora no requiere proveedores de IA, migraciones ni secretos nuevos.

## Qué falta para prometer inteligencia jurídica
La API actual expone estados de verificación documental y relaciones catalogadas, **no pasajes verificados por afirmación**. Por eso el mapa entregado **no constituye aún un comparador normativo ni un análisis de impacto por cliente**. El próximo incremento exige el contrato de datos y una revisión profesional comprobable antes de activar esas conclusiones.

## Validación
- `tests/evidencia_por_campo_contract.mjs` comprueba seis campos, coherencia del año, inyección HTML, fuentes permitidas, estados pendientes y exportación.
- `tests/ficha_practica_contract.mjs` conserva el contrato inicial.
- No se altera visual, sistema de acceso, datos SQL, API servidor, landing ni precios.

**Decisión:** es seguro informar qué datos figuran en el catálogo y qué evidencia falta; no es seguro convertir esas pistas en obligaciones automáticas.
