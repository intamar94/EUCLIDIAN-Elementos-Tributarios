# Entrega integrada sin Supabase · 19/10/2026

## Mandato y base
Dirección pidió ejecutar en paralelo los pendientes y dejar Supabase al final. Se partió de main 804c6d8, incluyendo continuidad del comparador #124 y recorrido fuente a expediente #123. No se contrató nada ni se cambiaron SQL, RLS, Auth, precios, DNS o acceso público.

## Trabajo entregado
- M2: borrador local de comparación con fuentes, referencias, pasajes editados, diferencias y fecha de preparación; editar invalida resaltados anteriores.
- M4: checklist de campos/fuentes faltantes y cotejos pendientes en Word y vista PDF; sanitización XML, saltos OOXML y nombres con asunto/fecha. El render DOCX fue revisado en el trabajo del agente.
- M5: perfiles anónimos de lectura con alias automáticos y temas cerrados; consulta manual al buscador existente.
- M6: agenda manual de investigación con fechas elegidas por usuario, enlaces HTTPS DIAN y CSV protegido contra fórmulas. No calcula vencimientos fiscales.
- M7: laboratorio estructural CSV con esquema ficticio limitado, archivos de 200 KB/1000 registros, líneas/errores/correcciones y ejemplo. No es formato oficial DIAN ni validador de declaración.
- M8: guía de investigación por reglas, palabras editables, búsqueda explícita y checklist autodeclarado. No se ejecuta modelo IA ni se generan dictámenes/citas.
- Integración: cuatro herramientas en pestañas de Explorar, teclado, controles móviles, búsqueda detrás de autorización y limpieza al salir/perder acceso. El borrador de formulario de agenda también se borra al expirar; no queda retenido por el render.

## Validación y límites
48 archivos de contratos se verificaron localmente antes de registrar esta entrega; CI y pruebas de navegador integradas deben pasar antes de actualizar el preview. Se incorporan pruebas reales de formularios, fichero CSV ficticio, teclado, búsqueda, limpieza de sesión, descarga TXT de comparador y Word/PDF.

Estos incrementos no acreditan módulos completos M5–M8 ni justifican subir el porcentaje 16/50 por tener pantallas. Falta contrastar cada control del tablero con su criterio exacto. No se modifica ese porcentaje sin prueba.

## Pendientes que no puede resolver un cambio de interfaz
- Versiones jurídicas y citas aprobadas por revisor competente: requieren evidencia y revisión humana, no una casilla de usuario.
- Relevancia/alertas por cartera, calendario fiscal verificado por régimen/jurisdicción/excepciones y exógena oficial: requieren reglas y fuentes cotejadas, evaluación profesional y pruebas, además de integración cuando aplique.
- Asistente IA: modelo/proveedor con privacidad, costes y evaluación de respuestas con fuente y abstención; la guía por reglas no lo sustituye.
- Entregabilidad, contratos de proveedores, privacidad y condiciones comerciales, impuestos/precio final, sandbox de pagos y piloto: mantienen sus dependencias y no se aprueban por CI.
- Supabase al final: capacidad, respaldo/restauración, migración de expedientes, aislamiento multiusuario y conexión productiva en Cloudflare. No se declara resuelto por este bloque.

Actualizar primero preview privado. Publicación en dominio principal conserva la política diaria y revisión específica; cierre de registro/cobros se mantiene hasta completar configuración y controles. La autorización de dirección para avanzar ya existe.
