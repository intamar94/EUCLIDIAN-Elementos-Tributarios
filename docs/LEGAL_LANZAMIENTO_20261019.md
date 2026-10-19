# EUCLIDIAN: expediente de preparación para apertura

Fecha de revisión: 19/10/2026. Estado: NO APROBADO PARA APERTURA.
Complementa PR #117 y el expediente LEGAL.ia del PR #67; no sustituye su integración.
No contiene datos personales ni acredita aceptación de contratos por una cuenta concreta.

## Decisión y alcance

La titular comunica confirmación municipal del registro del Gewerbe el 19/10/2026 y autoriza avanzar hacia apertura. No archivar correo, formulario ni identificación en GitHub. La autorización permite preparar el lanzamiento, pero no acredita la ejecución de las verificaciones siguientes. El aviso publicado por código sigue describiendo preparación: no reutilizarlo sin cambios al abrir cuentas, expedientes, aportes o pagos.

## Hallazgo actualizado sobre Brasil

La Comisión Europea incluye Brasil entre los países con decisión de adecuación, Decisión de Ejecución (UE) 2026/179 de 26/01/2026. No es correcto tratar sa-east-1 como prohibición automática o exigir migración solo por falta de adecuación. La adecuación no sustituye el contrato de encargado del art. 28, seguridad, minimización ni la evaluación de transferencias a otros destinos. Supabase identifica a su entidad de Singapur como encargado principal y operaciones/soporte en EEUU, con SCC incorporadas a su DPA. Registrar la entidad y el contrato efectivamente aplicables a esta cuenta antes de afirmar un mecanismo específico en el aviso de apertura.

## Matriz de evidencias pendientes

| Flujo | Evidencia de código o servicio | Falta concreta | Responsable funcional / cierre |
| --- | --- | --- | --- |
| Alojamiento Vercel | Visitas, rutas, IP y diagnóstico; DPA público incorporado por sus términos | Versión del contrato aplicable, entidad contratante, subencargados, localizaciones de ejecución y logs, plazos efectivos y accesos | Infraestructura: referencia privada verificable de cuenta/plan/contrato, configuración y retención; no inferir borrado del plazo visible del panel |
| Correo Cloudflare → Gmail | Aviso de preparación describe el reenvío | Aplicabilidad del DPA de Cloudflare al servicio y cuenta; modalidad Gmail, rol de Google y cobertura contractual del contenido de negocio | Operaciones: comprobar cuenta consumer o Workspace. El DPA de Workspace no demuestra cobertura de Gmail consumer. No contratar migración sin precio autorizado; preparar alternativa y decisión |
| Auth Supabase | `api/auth.js`: email, contraseña enviada al proveedor, identificador, confirmación y tokens | DPA aplicado a cuenta/entidad; proveedor SMTP, plantillas, plazos de Auth/auditoría/backups; recuperación y borrado probado | Seguridad/infra: evidencias privadas, cuenta sintética y procedimiento verificado, sin passwords en logs |
| Perfil | `api/profile.js`: nombre y ciudad, estado de onboarding, columnas de aceptación | Distinguir campos opcionales, necesidad y plazo; verificar que las aceptaciones se registran realmente y qué versión acreditan | Producto: no llamar consentimiento a la mera lectura del aviso; consentimiento solo para tratamientos que lo requieran |
| Medición de consultas | `api/usage.js`, `lib/auth-server.js`: consultas por usuario, periodo y plan | Qué consultas o metadatos se guardan, plazo, borrado/agregación | Producto/datos: minimización y política operativa demostrable |
| Expedientes e informes | `lib/expedientes-api.js`: contenido aportado por profesional, identificador propietario | Rol responsable/encargado para datos de clientes del contador, contrato art.28 si procede, categorías y prohibición práctica de datos innecesarios | Producto/legal: modelo de uso y contrato antes de aceptar datos personales de terceros |
| SIGNA/aportes | `lib/aportes.js`: contenido aportado y moderación | Aviso en formulario, derechos/licencia, política de publicación y eliminación, tratamiento de terceros | Legal/producto: revisión específica antes de habilitar aportes |
| Almacenamiento local | `auth.js`: tokens y preferencias; aviso incluye sessionStorage | Inventario de claves, momento de escritura, solicitud del usuario y finalidad estrictamente necesaria §25 TDDDG | Seguridad/UX: comprobar flujo real; no activar analítica/marketing suponiendo que el acceso la autoriza |
| Pagos | Stripe y tablas de cobro presentes en código, no habilitación acreditada | Información contractual previa, destinatarios, impuestos, cancelación, desistimiento aplicable y confirmación de compra | Agente pagos: aportar hechos finales antes de redactar condiciones públicas; mantener cobros cerrados |

## Conservación: decisión operativa pendiente, no promesa pública

Separar al menos: logs de alojamiento/seguridad, correo de consultas, Auth y sesiones, perfil, historial/uso, expedientes y exportaciones, aportes/moderación, copias de seguridad, documentos contractuales/contables. Para cada categoría registrar finalidad, responsable, ubicación, disparador de eliminación, plazo o criterio, excepciones de bloqueo legal, operación de borrado y verificación con datos sintéticos. No prometer borrado automático ni un número de días sin implementación y prueba. No usar el plazo contable para conservar indiscriminadamente todas las consultas o credenciales.

## Contenido que falta incorporar al aviso de apertura

Redacción propuesta para revisión, no copiar a producción hasta cerrar las variables anteriores:

> Al crear una cuenta tratamos tu correo, identificador y datos de autenticación para gestionar el acceso solicitado (art. 6.1.b RGPD), y los registros técnicos necesarios para prevenir abusos y proteger cuentas (art. 6.1.f RGPD). La contraseña se transmite al servicio de autenticación; no debe enviarse por correo de soporte. Las funciones de perfil y expediente se explicarán con sus categorías, finalidades y plazos reales antes de habilitarlas. No incluyas datos de clientes o terceros mientras esa función no tenga condiciones y garantías expresas.

Esta propuesta no reemplaza el inventario detallado, los destinatarios y garantías exactas, retención, derechos, obligaciones de facilitación y eventual tratamiento por cuenta del contador. El texto de preparación sigue siendo el único implementado; no afirma actividad inexistente ni aprobación profesional.

## Identificación DDG y control de salida

- Titular y domicilio se mantienen exclusivamente en configuración privada hasta su publicación autorizada por la titular; nunca en este expediente ni fixtures.
- §5 DDG incluye USt-IdNr y Wirtschafts-Identifikationsnummer cuando se poseen. Se habilitan variables separadas para mostrar etiquetas correctas; no confundir con Steuernummer personal ni inventar números.
- Confirmar medio de contacto electrónico efectivo y posibilidad de comunicación directa; probar recepción sin publicar correos de prueba ni mensajes privados. El enlace mailto no prueba recepción.
- Verificar obligaciones de registro, actividad regulada o responsable editorial solo si son aplicables al servicio concreto; no presentar Gewerbe como licencia de asesoría fiscal/jurídica.
- Una vez fijado el flujo, actualizar versión de privacidad, inventario y expediente LEGAL.ia, probar rutas legales con datos sintéticos y luego HTTP 200 del despliegue aprobado. No modificar banderas de acceso por este documento.

## Fuentes primarias consultadas el 19/10/2026

- §5 DDG: https://www.gesetze-im-internet.de/ddg/__5.html
- RGPD arts. 5, 6, 12–14, 28, 32, 44–49: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- §25 TDDDG: https://www.gesetze-im-internet.de/ttdsg/__25.html
- Comisión Europea, lista de adecuación y Brasil: https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en
- Decisión Brasil 2026/179: https://eur-lex.europa.eu/eli/dec_impl/2026/179/oj
- Vercel DPA: https://vercel.com/legal/dpa ; términos: https://vercel.com/legal/terms
- Cloudflare DPA v6.4, 03/04/2026: https://www.cloudflare.com/cloudflare-customer-dpa/
- Google Cloud DPA (ámbito contractual, no prueba de Gmail consumer): https://cloud.google.com/terms/data-processing-addendum/
- Supabase DPA: https://supabase.com/legal/customer-resources/data-processing-addendum
- Supabase residencias y transferencias: https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq
- EDPB, roles responsable/encargado: https://www.edpb.europa.eu/documents/guideline/guidelines-072020-on-the-concepts-of-controller-and-processor-in-the-gdpr_en
