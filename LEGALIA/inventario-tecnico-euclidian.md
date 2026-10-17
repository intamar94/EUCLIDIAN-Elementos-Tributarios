# EUCLIDIAN · Inventario real y brechas jurídicas (17/10/2026)
Derivado de consultas a GitHub (rama `ops/legalia-faro-v1`), Supabase y Vercel. **No es una certificación legal.**

| Componente | Observado | Acción antes de aprobación |
|---|---|---|
| Portada `index.html` | No enlaza Impressum ni Datenschutzerklärung. | Crear páginas definitivas solo tras verificar datos legales; enlazarlas de forma visible en portada y aplicación. |
| `app.html` | Formularios de autenticación y pie informativo; Google Fonts externos. | Revisar política de privacidad y enlaces legales, accesibilidad. |
| `auth.js` | `localStorage` guarda access_token y refresh_token. | Revisar seguridad, XSS, CSP, legitimación y transparencia; no almacenar secretos server-side en frontend. |
| `bandeja.js` | `sessionStorage` clave de acceso interno; `localStorage` preferencias/temas. | Restringir acceso interno y documentar cookies/storage. |
| `api/auth.js`, `lib/auth-server.js` | API Auth de Supabase y service key server-side. | Verificar secreto exclusivamente en backend y acceso mínimo. |
| Supabase | Región `sa-east-1` (Brasil), RLS encendido; avisos `rls_enabled_no_policy`. | Revisar transferencias internacionales, AVV, políticas necesarias y control server-side. NO abrir tablas en bloque. |
| Vercel | Deploy de producción READY; dominio `*.vercel.app` verificado, algunos despliegues protegidos por SSO. | Verificar URL pública, credenciales y dominio definitivo. |
| Cobros | Landing pública dice contratación próximamente; Stripe preparado en auth.js. | Mantener pagos NO activos hasta fiscalidad, T&C, protección consumidores y revisión de proveedor. |
| Proveedor externo | Google Fonts desde CDN. | Preferir alojamiento local o evaluación jurídica antes de la publicación legal definitiva. |
| Fuente DIAN | Enlaces a normograma oficial. | Mantener identificación de carácter no oficial, licencias/atribución y transparencia sobre alcance de documentos. |

### No publicar
- Nombre legal, domicilio exacto, Gewerbeschein, Steuernummer, documento de identidad, llaves de servicio y archivos fiscales en repositorios públicos.
- La dirección del Impressum sí debe publicarse una vez verificada/autorizada; es una publicación consciente y distinta al expediente privado.

### Pendientes comerciales
- Revisión del modelo SaaS Alemania→Colombia, cobros transfronterizos, consumidor objetivo, impuestos y contratación digital.
- `§ 312j`, `§ 312k` y `§ 356a` BGB solo según modelo y alcance aplicable; no marcar como cumplidos por existir un enlace genérico.
