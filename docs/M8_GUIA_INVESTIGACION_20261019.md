# M8 · Guía de investigación · 19 de octubre de 2026

## Entrega

`asistente.js` monta una guía accesible en `div#asistentePanel`; `asistente.css` contiene su estilo adaptable. Expone `window.EuclidianAsistente.montar()` y `limpiar()`. El montaje es idempotente y se intenta al cargar el DOM. Integrar ambos recursos en la página y en la lista de archivos estáticos de Cloudflare. Llamar a `limpiar()` al cerrar sesión o reiniciar el espacio de trabajo.

Recorrido: tema breve sin datos personales → confirmación expresa de exclusión de información confidencial → propuesta de palabras mediante reglas → edición → botón que invoca `window.euclidianBuscarTexto(q)` → cinco comprobaciones autodeclaradas → hoja TXT opcional marcada como borrador.

La pregunta se limita a 600 caracteres y la consulta a 160. No existen peticiones de red, almacenamiento persistente, modelo de IA, citas ni respuestas tributarias en este módulo. Únicamente la consulta editable pasa al buscador por acción expresa; la privacidad y el procesamiento posterior dependen del buscador existente. La confirmación de ausencia de datos sensibles es autodeclarada, no un detector automático. No pegar información de clientes.

Las casillas recuerdan cotejar fuente oficial, publicación/período, condiciones/excepciones, versión y revisión profesional. Marcarlas no constituye evidencia acreditada. La hoja exportada lo explica incluso cuando todas están marcadas. Las comprobaciones se reinician cuando se modifica la consulta; cambiar el tema exige preparar de nuevo. Limpiar elimina el estado de memoria; no puede borrar una descarga que el usuario ya guardó.

## Verificación y límites

`node tests/asistente_guia_contract.mjs` ejecuta los eventos del DOM mínimo y comprueba: validación, confirmación, no envío hasta pulsar Buscar, ausencia/fallo del buscador, retorno booleano, límites, inyección de HTML sin ejecución, reinicio de comprobaciones, cambio del tema, limpieza y avisos jurídicos. `node --check asistente.js` comprueba sintaxis.

No acredita el control “asistente IA” de M8: es una capacidad preparatoria local. No se ha evaluado un modelo, se ha conectado recuperación semántica, ni demostrado calidad de respuestas legales. No marca fuentes como verificadas, no determina vigencia y no modifica la base de datos, Auth, RLS, pagos ni despliegues. La integración y prueba visual en navegador corresponden al bloque consolidado.
