# M5 · Perfiles anónimos de lectura en memoria

Entrega del 19 de octubre de 2026, base `804c6d8`.

## Alcance operativo

`cartera.js` ofrece hasta ocho perfiles temporales con alias automáticos `Lectura 1`, `Lectura 2`, etc. Cada perfil admite de uno a tres temas escogidos de una lista cerrada. Se pueden editar los temas, eliminar un perfil y lanzar manualmente una consulta independiente por cada tema seleccionado. Cada botón muestra el término exacto enviado al buscador; no se concatenan áreas diferentes en una sola búsqueda, pues eso puede excluir documentos pertinentes.

No hay campos de identidad ni texto libre. No se admiten clientes, NIT, importes, datos personales, archivos o credenciales. No se escribe en almacenamiento del navegador, no hay llamadas de red propias, temporizadores, correos ni envío de perfiles. Pulsar «Consultar IVA», «Consultar Renta» u otro tema usa exclusivamente la función existente de búsqueda y por tanto requiere el mismo acceso de consulta. Una búsqueda aceptada no garantiza resultados ni acredita obligación alguna.

La lista representa preferencias de lectura; no calcula obligaciones, riesgos, impacto normativo, alertas automáticas ni coincidencias verificadas. No hay persistencia de cartera ni aislamiento multiusuario de servidor. No se debe presentar esta entrega como M5 completo.

## Integración por el coordinador

- Cargar `/cartera.css` y `/cartera.js` con `defer` desde la aplicación privada.
- Crear un contenedor `<section id="carteraPanel" aria-labelledby="carteraTitulo" tabindex="-1"></section>` en el recorrido de navegación apropiado. El módulo lo monta automáticamente al cargar; `window.EuclidianCartera.render()` permite montarlo después si se añade dinámicamente.
- Invocar `window.EuclidianCartera?.limpiar()` al cerrar sesión, perder autorización o cambiar de cuenta, junto con las otras limpiezas locales. La recarga borra también todo el estado.
- Proporcionar `window.euclidianBuscarTexto(q)` que devuelva `true` exclusivamente si la búsqueda se acepta; `false` en caso de acceso cerrado. El módulo muestra el estado correspondiente. Cada pulsación envía únicamente el tema elegido; nunca se envían juntos los temas, ni alias ni identificadores de perfil.
- No modificar Supabase, planes, Auth ni RLS para esta entrega.

## Pruebas

`node tests/cartera_local_contract.mjs` prueba que los temas se consulten por separado, que no se pueda enviar un tema ajeno al perfil, además de temas inválidos y duplicados, límite de tres temas y ocho perfiles, edición sin corrupción tras rechazo, borrado, copia defensiva, consulta manual, función inexistente, rechazo y excepción de acceso, limpieza, montaje, eventos del formulario, mensajes de estado y controles de accesibilidad. `node --check cartera.js` valida sintaxis. Los textos del usuario no entran en HTML: los únicos valores aceptados vienen de la lista cerrada, y la construcción del HTML además escapa sus etiquetas.

La interfaz usa etiquetas nativas y fieldset/legend, estado accesible, foco visible, acciones de 44 px y tipografía mínima de 16 px en móvil. La comprobación visual integrada y de navegación queda en manos del coordinador al añadir los contenedores reales.

## Pendientes para acreditar M5

La ruta maestra exige relevancia explicada y falsos positivos evaluados contra documentos concretos, aislamiento, revocación y alertas opt-in. Separar las consultas y advertir sobre coincidencias ajenas no constituye clasificación de relevancia ni validación de falsos positivos. Quedan pendientes la validación profesional y con usuarios, RLS multiusuario, retención y borrado comprobados y la configuración explícita de alertas. Esos controles no se acreditan con este prototipo local. Supabase sigue al final por decisión de Intamar.
