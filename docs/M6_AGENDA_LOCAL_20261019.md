# M6 · Agenda manual de investigación · 19 octubre 2026

## Alcance entregado

Agenda útil en memoria: hasta 40 tareas de investigación, con título (140 caracteres), fecha elegida explícitamente por el usuario, referencia documental DIAN (180 caracteres) y enlace HTTPS oficial (1600 caracteres). Lista cronológica, marcar completada, eliminar, vaciar con confirmación y exportar CSV local.

No calcula vencimientos ni obligaciones, no recibe NIT, no genera fechas y no certifica que un enlace haya sido cotejado. Valida HTTPS y dominio dian.gov.co/subdominios sin credenciales ni puertos alternativos; la ampliación a Hacienda Bogotá se documenta abajo. La propia pantalla exige abrir la fuente y cotejar su contenido. No hay red, almacenamiento web, cookies, servidor ni conexión Supabase. El CSV es la única conservación explícita: puede ser sensible si el usuario ignora la advertencia de no incluir datos personales.

Los datos desaparecen al recargar o cerrar; hay advertencia de salida mientras existen tareas. No hay importación CSV, sincronización, avisos de calendario, recordatorios automáticos ni envío por correo. El alcance M6 de calendario tributario completo permanece pendiente: esta entrega no acredita vencimientos oficiales verificados.

## Ampliación de fuentes nacionales y de Bogotá · 20 octubre 2026

La agenda acepta enlaces HTTPS de `dian.gov.co` y sus subdominios para fuente nacional, así como `haciendabogota.gov.co` y sus subdominios para Hacienda Distrital de Bogotá. Etiqueta la jurisdicción de la fuente en la lista y el CSV; no infiere la obligación ni la jurisdicción aplicable al contribuyente. Ofrece enlaces directos a los calendarios oficiales [DIAN](https://www.dian.gov.co/Paginas/CalendarioTributario.aspx) y [Hacienda Bogotá](https://www.haciendabogota.gov.co/es/calendario-tributario). Las fechas siguen siendo introducidas por el usuario y no se afirman como plazos vigentes.

La selección de fuente no acredita excepciones ni modificaciones posteriores. Antes de usar una fecha, el profesional debe revisar acto, período, sujetos, territorio, NIT cuando corresponda y cambios oficiales. M6 mantiene pendiente el calendario verificado por obligación, año, dígitos y excepciones, además de revisión fiscal y alertas.

## Integración para la raíz

Cargar agenda.css y agenda.js en app.html y montar `<div id="agendaPanel"></div>` en la sección de trabajo elegida. El script monta al DOMContentLoaded. Si el panel se agrega después, llamar `window.EuclidianAgenda.render()`.

API `agregar({titulo,fecha,referencia,url})`, `listar()`, `completar(id,boolean)`, `eliminar(id)`, `limpiar()`, `tieneDatos()` y `csv()`. Integrar **limpiar() en cierre de sesión** junto a módulos de memoria; no compartir las tareas entre sesiones. `listar()` entrega copias y no permite mutar el estado desde fuera. La raíz puede usar tieneDatos() en advertencias de navegación interna. La función render conserva el borrador del formulario al marcar/eliminar tareas; el formulario se vacía al añadir correctamente.

## Seguridad y accesibilidad

Salida HTML escapada, URL oficial validada antes de renderizar enlaces, enlaces externos noopener/noreferrer. CSV con campos entre comillas, escapado de comillas, eliminación de saltos de línea dentro de celdas y prefijo apóstrofo en fórmulas potenciales. No ICS: evita aparentar eventos fiscales verificados.

Etiquetas explícitas, errores role alert, confirmaciones role status, foco de teclado visible, controles de al menos 44 px (checkbox dentro de etiqueta de 44 px), texto de entrada 16 px y diseño móvil sin desborde.

## Evidencia

`node tests/agenda_local_contract.mjs`: aprobado. Verifica fechas imposibles/bisiestos, orígenes engañosos y credenciales, límites, completar/eliminar, aislamiento de copias, orden, limpieza y neutralización CSV.

`node tests/agenda_browser.cjs`: prueba funcional Playwright incorporada para 360/1180 px: formulario, recuperación tras errores, XSS, preservación de borrador, descarga, cambios sin exportar, limpieza y ausencia de desborde. Ejecución local pendiente por ausencia del binario Chromium; requiere ejecutarse en el CI o entorno de navegador de la integración.
