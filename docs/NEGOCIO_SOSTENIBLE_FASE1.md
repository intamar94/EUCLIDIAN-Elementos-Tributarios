# EUCLIDIAN · Fase 1 | Diagnóstico de operación y ruta de rentabilidad
**Estado observado: 17 de octubre de 2026.** Tablero: [#93](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/93)

## Decisión de dirección
Preservar logotipo, paleta, tipografía, animaciones, diseño móvil/PC, navegación, biblioteca y trazabilidad de fuentes. Cambiar solamente funcionalidades que creen trabajo útil y criterios de calidad. No activar alta ni pagos hasta aprobación de LEGAL.ia.

## Semáforo de partida
| Área | Evidencia observada | Estado | Siguiente condición de salida |
| --- | --- | --- | --- |
| Código y publicación | rama `main`, despliegue de producción Vercel `c123d8b8` READY; 30 etapas del último CI aprobadas | 🟢 | verificación de navegación pública anónima |
| Dominio | Vercel confirma los dos dominios `verified=true`; `www.euclidianet.com` tiene redirect 308 al apex. Zona Cloudflare `active`, CNAME de ambos hosts a destino Vercel, sin proxy | 🟠 | HTTP 200 y SSL en móvil + equipo sin sesión; www redirige correctamente |
| Acceso público | Vercel reporta `ssoProtection.enabled=true` y `deploymentType=all`, `project.live=false`; no se pudo realizar comprobación HTTP externa fiable desde las herramientas disponibles | 🔴 | verificar qué dominios protege SSO y conservar barreras de admin |
| Registro | `api/auth.js` niega `signup` salvo `EUCLIDIAN_SIGNUP_ENABLED=true`; UI de alta oculta | 🟢 cerrado | aprobación jurídica, privacidad, soporte, condiciones, identidad |
| Pagos | `api/checkout.js` bloquea sin `configuracionCobro().enabled`; `/api/payment-webhook` exige firma | 🟠 | revisar configuración real en entorno, sandbox, fiscalidad, reembolsos, desistimiento |
| Datos documentales | catálogo DIAN; el último recuento auditado `17.792` registros al 7/10, `31` excepciones en cuarentena | 🟠 | volver a contar en base actual y muestrear evidencia jurídica |
| Relevancia y reportes | PR #92: ficha práctica, checklist, borradores técnico/cliente `.txt`; no incluye una determinación automática | 🟠 | piloto con usuarios y evaluación de fuentes por afirmación |
| Costos | Vercel Hobby + Cloudflare Free observados; facturas reales, Supabase, dominio, correo, soporte e IA no conciliados | 🔴 | completar libro de costos mensual con importes reales |
| Legal | borrador de Impressum/privacidad en `docs/legal-euclidianet-go-live.md` requiere validación de identidad, Gewerbe, RGPD, retención, transferencias, venta | 🔴 | aprobación expresa documentada de LEGAL.ia / asesor competente |
| Mercado | investigación de competidores y precio planteado; sin entrevistas del piloto ni ventas confirmadas | 🔴 | evidencia de utilidad/tiempo y willingness-to-pay |

**No inferir:** Vercel READY no garantiza acceso público; Cloudflare DNS configurado no equivale a HTTP funcionando; pruebas unitarias no equivalen a conformidad legal; un campo aprobado automáticamente no acredita aplicación a un cliente.

## Ruta consecutiva y control de salida
### E1. Operación y seguridad
- [x] Verificar existencia de producción READY y rama `main`.
- [x] Revisar Vercel `verified=true` en los dominios, redirect 308 `www`→apex y CNAME/MX en Cloudflare.
- [x] Confirmar compuerta de alta cerrada en código y control de checkout condicional.
- [ ] Comprobar inicio y `www` desde red pública sin cookies, navegador privado móvil y PC.
- [ ] Investigar `ssoProtection`; no desactivarlo sin distinguir acceso público y administración.
- [ ] Comprobar páginas legales aprobadas HTTP 200 e identificar representante vigente.
- [ ] Probar entrega/recepción real de `contacto@`, `errores@`, `sugerencias@` con consentimiento del operador.
- [ ] Actualizar inventario de proveedores, costos, accesos y riesgos de privacidad.

**Salida E1:** dominio público correcto o bloqueo explícito documentado, administración aislada, compuertas comerciales cerradas, inventario de costos y responsables actualizado.

### E2. Producto útil y verificable
Desarrollar evidencia por afirmación (#88), exportables más útiles (PDF/DOCX solo si resulta necesario), comparación verificable de criterios y revisión profesional. No modificar visual sin necesidad. **Salida:** casos de prueba positivos y adversariales y ningún cambio o vencimiento inventado.

### E3. Personalización sin vigilancia
Perfiles orientativos, no datos contables sensibles, opt-in, aislados por usuario y borrado probado (#89). Alertas solo con fuente cotejada y control de desuscripción. Calendario DIAN (#90) solo con obligación, año, NIT/dígitos y excepciones verificados.

### E4. Prueba con contadores
Tres a cinco participantes, cinco escenarios por persona, baseline versus EUCLIDIAN, registro de tiempo/errores/enlaces y consentimiento. Piloto reproducible en `docs/PILOTO_COMERCIAL_CONTADORES.md`.

### E5. Rentabilidad y condición de venta
Consolidar costos mensuales en COP y tipo de cambio documentado; precio vigente propuesto: **49.900 COP/mes regular**; primera tarifa **29.900 COP/mes** solo tras fijar duración, elegibilidad, impuestos, renovaciones y términos. No modificar precios o Stripe sin aprobación.

### E6. Captación
SEO orgánico con fuentes oficiales y guías originales firmadas/revisadas, demostraciones de uso, búsqueda de cinco primeros contadores; landing con promesa medida, sin métricas inventadas. El concepto de aporte `SIGNA` requerirá tratamiento comercial/tributario independiente y permiso explícito antes de recaudar.

### E7. Retención y escala
Medir activación, trabajo terminado, renovación, cancelaciones, consultas por usuario y soporte; sin registrar cadenas de búsqueda, identificadores fiscales ni contenido privado en analítica.

## Tabla de economía unitaria (completar con facturas)
| Métrica | Fórmula | Dato actualmente |
| --- | --- | --- |
| MRR cobrado | suscripciones activas realmente cobradas netas de reembolsos | Sin verificar |
| Ingreso neto/cliente | ingreso cobrado - impuestos repercutidos - comisiones - reembolsos | Sin verificar |
| Costo variable/cliente | IA + consultas BD + email + ancho de banda + soporte atribuible | Sin verificar |
| Contribución/cliente | ingreso neto/cliente - costo variable/cliente | Sin verificar |
| Costos fijos | dominio + plataformas + operación + revisión profesional + herramientas | Sin verificar |
| Punto de equilibrio | costos fijos / contribución positiva por cliente, redondeo superior | No calculable aún |
| CAC | gasto de captación atribuido / clientes nuevos que pagan | No medido |
| Meses para recuperar CAC | CAC / contribución mensual positiva | No calculable |
| Churn mensual | bajas del mes / usuarios activos al inicio del mes | No medido |

No presupuestar usando el precio promocional como ingreso perpetuo ni asumir que los planes gratuitos mantendrán sus límites indefinidamente.

## Protección del producto
- No publicar clientes, correos ni resultados de pilotos en repositorio público.
- No habilitar `EUCLIDIAN_SIGNUP_ENABLED`, `EUCLIDIAN_LEGAL_APPROVED`, producción Stripe ni eliminar SSO por una autorización general.
- No afirmar que una norma está vigente ni que afecta a un cliente si falta respaldo.
- Un cambio de proveedor o uso de IA con datos requiere reabrir expediente LEGAL.ia.
- El próximo paso ejecutable es verificar disponibilidad externa/SSO y completar costos; no lanzar venta antes de completar estas tareas.
