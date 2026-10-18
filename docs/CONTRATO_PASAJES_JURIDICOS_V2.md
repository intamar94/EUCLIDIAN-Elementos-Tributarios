# EUCLIDIAN · Protocolo de cotejo por pasaje DIAN (incremento 2)

**Estado: biblioteca de validación y pruebas; NO habilita dictámenes automáticos.**
Conectado con [#88](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/88).

## Problema que resuelve
Un `APPROVE` de control técnico, una URL oficial o una referencia a un documento anterior **no acreditan** por sí mismos que una norma cambie, tenga determinada vigencia, afecte a un contribuyente o cree un vencimiento. El sistema necesita evidencia por afirmación y contraste de versiones, además de revisión jurídica humana.

## Entregable implementado
`lib/evidencia-pasajes.js` es un **módulo interno, sin rutas HTTP ni conexión con la base**, diseñado para que un futuro servicio seguro pueda cotejar evidencia capturada:
- Identificador UUID de documento; clasificación cerrada de afirmaciones (`cambio`, `vigencia`, `fecha_aplicacion`, `sujetos`, `excepcion`).
- Enlace HTTPS del documento DIAN, sin otros dominios, credenciales ni puertos personalizados.
- Huella SHA-256 completa del texto oficial capturado (se verifica contra el contenido que deberá aportar el backend).
- Extracto literal de máximo 2000 caracteres y huella SHA-256 del fragmento.
- Localizador de página o epígrafe, fecha UTC de captura validada y texto de la afirmación.
- Para `cambio` es obligatoria evidencia **tanto del documento actual como del anterior**, con sus propias huellas.
- Invalidez de hash, versión, pasaje o antecedente produce `por_confirmar` o `incompleto`.
- Incluso cuando todo el texto coincida, devuelve `pendiente_revision_juridica`, `revision_humana=false` y `ubicacion_pendiente=true`. **Jamás `confirmado`.**

## Limitaciones declaradas
1. El validador **no descarga la DIAN ni verifica autenticidad de HTTPS en tiempo real**. Solo limita la URL y coteja con un texto completo que le deberá pasar una fuente interna autorizada.
2. La correspondencia de página/epígrafe **todavía requiere validación aparte**: una cadena localizada en el texto global no demuestra su ubicación.
3. El cotejo de pasaje prueba coincidencia textual de una versión, no exactitud de interpretación, jerarquía normativa, derogación, condición ni aplicación al caso.
4. Las propuestas son datos no confiables, incluidos eventuales campos `estado`, `revision_humana` o `revisor_id`: ningún campo enviado puede convertir la prueba en aprobación.
5. No se ha creado una tabla en Supabase ni se han alterado RLS, inicio de sesión, control de pagos o legal.

## Siguiente puerta antes de usar en producción
- Diseñar tabla `afirmaciones_documentales` y `evidencias_documentales` en SQL con FK a documento y versión, restricciones, auditoría, RLS por rol y revocación cuando cambie el hash.
- Implementar revisión autenticada server-side por revisor autorizado, con bitácora inmutable, separación técnico/jurídico y justificación.
- Enviar solo contenido publicado y verificado al navegador; nunca la base de datos de revisión ni claves privilegiadas.
- Probar citas HTML/PDF, referencias cruzadas, negaciones, parágrafos, excepciones y publicaciones rectificadas.
- No activar alertas afirmativas ni perfiles tributarios hasta revisar falsos positivos y privacidad.

## Pruebas
`node tests/evidencia_pasajes_contract.mjs`: incluye pasaje falso, hash inconsistente, versión de origen alterada, antecedente incompleto, fecha UTC inválida, URL hostil, declaración de revisión falsa y ausencia de captura.

**Decisión:** esta entrega establece un contrato tecnológico seguro para la fase de evidencias; no se presenta al contador como veredicto tributario, ni se cobra por una capacidad todavía incompleta.
