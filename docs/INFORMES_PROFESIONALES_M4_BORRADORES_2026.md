# EUCLIDIAN — M4/1 | Informes profesionales con Word y PDF

**18/10/2026 · Incremento conectado con Corrector General, MIKAI y Ruta Maestra del Contador**

## Resultado visible en el escritorio
En **Explorar → Mis expedientes de investigación**, tras crear un expediente de trabajo temporal, el contador puede:
1. **Word técnico (.docx)** — generar un archivo OOXML auténtico, editable en Word u otras suites compatibles, con contexto, pregunta, hipótesis, salvedades, conclusión no aprobada y referencias DIAN.
2. **Word para cliente (.docx)** — comunicación empresarial en lenguaje ordenado con las mismas restricciones de responsabilidad.
3. **Vista previa · Guardar PDF** — abrir una maquetación A4 de lectura/impresión y usar el diálogo nativo **Imprimir / guardar como PDF**. *No se genera un PDF binario de forma automática; depende del dispositivo y del soporte de impresión del navegador.*
4. **PDF para cliente** — misma salida imprimible orientada a empresario.
5. Continúan intactas las opciones JSON y TXT del expediente inicial.

## Trazabilidad y límites
- Los enlaces van únicamente a dominios HTTPS permitidos de DIAN, con referencia y título. **El enlace no acredita versión, vigencia ni pasaje.**
- Cada salida conserva **BORRADOR SIN REVISIÓN JURÍDICA**, fecha de preparación (no entrada en vigor), observaciones por completar y advertencia sobre posible falta de excepciones.
- Una aprobación falsificada en el JSON o en el objeto del navegador **no se incorpora** al informe ni puede generar el rótulo “aprobado”.
- No confundir una sección llamada “conclusión propuesta” con un dictamen. La salida para cliente **NO se envía automáticamente**.
- Textos de usuario se escapan al HTML/XML para evitar ejecutar etiquetas y código incrustado.

## Privacidad, costos y arquitectura
- Tanto DOCX como vista imprimible se generan **en el navegador**, sin APIs nuevas, servidores de documentos, cuenta cloud, almacenamiento automático, terceros ni cuota nueva de IA.
- DOCX se crea con estructura ZIP/OOXML mínima y sin CDN. El informe imprimible está aislado dentro de un diálogo con iframe `srcdoc` limitado; no descarga contenido externo.
- El archivo DOCX o el PDF guardado contienen la información escrita por el profesional **sin cifrar**. La aplicación advierte que por ahora no deben ingresarse datos personales reales ni NIT, declaraciones o importes.
- Los expedientes continúan limitados a memoria temporal, exportación/importación manual. El guardado persistente de PR #111 permanece **bloqueado** y la migración SQL **sin ejecutar**.
- Sin cambio en DNS, Vercel, dominio `euclidianet.com`, Auth, SEO, GIF, portada, precios, registro o decisiones LEGAL.ia.
- Word (.docx) se prueba como archivo ZIP/OOXML estructural; su apariencia final en diversas versiones de Word requiere validación adicional con archivos de demostración.

## Pruebas y aceptación
- `tests/informes_profesionales_contract.mjs`: dos tipos de informe, archivo DOCX con partes OOXML, referencias, sintaxis hostil, estado falsificado, advertencias y privacidad.
- `tests/ui_informes_browser.cjs`: prueba Chromium en anchuras 360 y 1180 px, descarga DOCX, texto escapado y vista previa de impresión.
- Pipeline CI de Corrector General mantiene las verificaciones de biblioteca, SEO, móviles, autenticación, vigencia y fuentes.
- Para considerarlo **informe defendible completo**, todavía faltan **citas verificadas por pasaje con versión y hash, firma/revisión profesional autorizada, expediente privado RLS testado y una valoración con contadores reales**. Por ahora es una salida profesional editable, pero legalmente **borrador**.

## Próxima puerta
1. Conseguir evidencia individual por afirmación, localizador y revisión humana autenticada (#88).
2. Completar ensayo en Supabase aislado con dos cuentas para autorizar persistencia (#102).
3. Conectar citas revisadas al expediente y al informe, con alerta cuando cambie el hash de la fuente.
4. Probar cinco tareas típicas con contadores (tiempo, exactitud de referencia, comprensión y voluntad de pago) (#91).

**Coordinación:** issue [#77 Corrector General](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/77), [#93 Ruta Maestra](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/93), [#102 Expedientes](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/102), [#88 Evidencia](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/88), PR #112 laboratorio MIKAI.
