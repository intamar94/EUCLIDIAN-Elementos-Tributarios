# EUCLIDIAN — instrucciones para agentes de desarrollo

## Cloudflare

- Al trabajar en Cloudflare, usar el servidor MCP oficial configurado en `.codex/config.toml`. Requiere que el entorno Codex cargue la configuración de este proyecto de confianza y que la titular autorice OAuth.
- Si faltan las Cloudflare Skills en el entorno real de Codex, seguir el procedimiento oficial de https://developers.cloudflare.com/agent-setup/prompt.md . Para Codex: instalar `cloudflare/skills` y realizar el login del MCP únicamente en una sesión auténtica de la titular; no copiar tokens ni sesiones al repositorio.
- Consultar documentación actualizada antes de cada operación que pueda afectar DNS, correo, certificados, enrutamiento, seguridad, cuotas o facturación. Priorizar planes gratuitos y no aceptar complementos de pago automáticamente.

## Estado y seguridad de EUCLIDIAN

- Dominio principal: `euclidianet.com`; `www.euclidianet.com` redirige al principal. Registrado en Vercel; **no transferir el registrador** a Cloudflare.
- La zona DNS original está gestionada actualmente por Vercel. No reemplazar nameservers, registros A/CNAME, registros de autenticación de correo o protección SSL sin comprobar todos los valores activos y tener plan de reversión.
- EUCLIDIAN en Vercel está protegido mediante autenticación en **todos los despliegues** mientras se completa la revisión legal y técnica. No eliminar esa protección; no activar acceso comercial público por iniciativa propia.
- La web incluye autenticación, pagos potenciales y las rutas API `/api/auth`, `/api/documentos`, `/api/checkout`, `/api/session`, `/api/profile`, `/api/usage`, `/api/plans`. No tratarla como una web estática funcional si estas rutas todavía no se han migrado/probado.
- Objetivo de correo gratuito: `contacto@euclidianet.com` y posibles alias para errores/sugerencias mediante Email Routing hacia el buzón ya existente de la titular. Comprobar que el reenvío realmente recibe mensajes; no afirmar que existe buzón completo ni SMTP saliente.
- Nunca escribir secretos, datos de la titular, claves, correos personales o tokens en archivos rastreados por Git.
- Antes de cambiar Cloudflare/Vercel en producción: inspección de cuenta/zona correcta, DNS actual, certificación TLS, estado de despliegue y controles legales; respaldar, ensayar, comparar y confirmar con la titular cualquier acción disruptiva.

## Entrega esperada

- Para cada operación, reportar claramente: **realizado y verificado**, **configurado pero sin probar**, **pendiente de la titular**, o **bloqueado**.
- Mantener el registro y el plan de puesta en marcha en https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/68 y el plan de alojamiento alternativo en #73.
