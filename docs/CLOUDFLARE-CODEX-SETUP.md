# EUCLIDIAN: Cloudflare conectado a Codex — guía operativa

Fuentes oficiales:
- [Agente: setup automático de Cloudflare](https://developers.cloudflare.com/agent-setup/prompt.md)
- [Cloudflare + Codex](https://developers.cloudflare.com/agent-setup/codex/)
- [Configuración de proyectos de Codex](https://developers.openai.com/codex/config-basic)

## Qué está configurado dentro del repositorio

Este repositorio trae `.codex/config.toml` con `[mcp_servers.cloudflare]` y la URL del MCP oficial `https://mcp.cloudflare.com/mcp`. No tiene credenciales ni permisos concedidos automáticamente. Codex solo carga la configuración de proyectos confiables; la dueña de la cuenta autoriza acceso a Cloudflare por OAuth.

## Qué falta realizar **en el entorno real de Codex**, no en un contenedor de chat temporal

1. Abrir este repositorio en Codex CLI/IDE y marcarlo como proyecto confiable si Codex lo solicita.
2. Instalar Cloudflare Skills usando el procedimiento oficial de Cloudflare:
   `npx -y skills add cloudflare/skills --skill '*' --yes --global`
3. Verificar que Codex detecta el MCP `cloudflare`. En Codex CLI puede usarse `codex mcp list`. Si la configuración de proyecto no se carga, la instrucción oficial para registrar el MCP en el perfil del equipo es:
   `codex mcp add cloudflare --url https://mcp.cloudflare.com/mcp`
4. Iniciar autorización OAuth en Codex: `codex mcp login cloudflare` (la autenticación requiere interacción de la titular, sin pegar tokens en chat o GitHub).
5. Hacer **una lectura sin cambios**: identificar cuenta Cloudflare y enumerar zonas visibles; confirmar `paltrueke.co` para saber que es la cuenta correcta. Reportar acceso conectado.

Como alternativa a comandos de CLI, la [guía oficial de Codex](https://developers.cloudflare.com/agent-setup/codex/) explica el menú `/plugins` para instalar Cloudflare (Skills y MCP) dentro de Codex. Evitar registrar servidores duplicados si la instalación mediante Plugin ya los habilitó.

## Tareas de la conexión para EUCLIDIANET.COM

**No hacer cutover de DNS ni activar un sitio comercial público antes de verificar la zona y tener copia de los registros**.

- [ ] Comprobar el dominio `euclidianet.com` en la cuenta Vercel de la titular, su propiedad y nameservers actuales, y que la web no esté todavía en modo público.
- [ ] Localizar o crear la zona `euclidianet.com` en **Cloudflare Free**, conservando el registro en Vercel.
- [ ] **Antes** de cambiar nameservers, preparar y verificar en Cloudflare los registros necesarios para Vercel (raíz y www), CAA y demás TXT existentes, con valores obtenidos **del estado real** de Vercel. No introducir A/CNAME de memoria.
- [ ] Preparar Cloudflare **Email Routing (Free)** para `contacto@euclidianet.com`; aliases opcionales `errores@` y `sugerencias@`. El destino debe validarse mediante el flujo Cloudflare sin divulgar la dirección personal en GitHub.
- [ ] Reconciliar MX/SPF/DMARC con las instrucciones vigentes de Cloudflare; evitar editar registros mientras otro proveedor tenga un servicio de correo activo; no prometer correo saliente del dominio.
- [ ] Solo después de verificar todos los registros y contar con aprobación para el cambio, sustituir los nameservers en Vercel por los que Cloudflare asignó. Comprobar propagación real, certificado HTTPS, redirección www→raíz, Vercel Authentication y recuperación ante falla.
- [ ] Enviar mensajes reales de prueba de distintas cuentas, confirmar que llegan al destino, revisar clasificación y antispam. La URL del formulario de reportes está en PR #78 y no debe publicarse como operativa antes de superar esta prueba.
- [ ] No mover hosting comercial ni alterar autenticación/pagos hasta resolver las rutas `/api/*`, privacidad e Impressum.

**Estado inicial:** solo preparación de la conexión de Codex. La autenticación OAuth, creación de zona y enrutamiento de correo requieren acceso a Cloudflare; este archivo por sí solo no los habilita.
