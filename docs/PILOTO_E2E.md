# Piloto end-to-end — criterio de salida

Este piloto valida el recorrido real sin activar cobros ni convertir decisiones tributarias en automatismos.

## Recorrido mínimo
1. Portada pública carga y explica valor, trazabilidad y carácter no oficial.
2. Alta/inicio de sesión y recuperación funcionan con Auth; ninguna service key llega al navegador.
3. Usuario sin entitlement ve Cuenta/planes pero no entra al corpus.
4. Usuario habilitado entra a Inicio y puede recorrer Consultar, Novedades, Explorar, Seguimientos y Cuenta.
5. Consulta devuelve únicamente documentos publicables; cada ficha muestra estado esencial, contexto y acceso a fuente oficial.
6. Búsqueda sin coincidencias ofrece rutas de recuperación; error de red ofrece reintento; carga comunica estado.
7. Perfil se guarda solo para el usuario autenticado y uso mensual se atribuye al mismo user_id.
8. /api/health devuelve 200 solo si corpus, esquema comercial y Auth están disponibles.
9. Vista móvil conserva navegación, foco visible, controles operables y lectura sin desbordamiento.
10. Cierre de sesión invalida la experiencia autenticada en cliente.

## Gate automático
Deben estar verdes: e2e_consulta_contract, auth_flow_contract, commercial_access_contract, payment_events_contract, public_landing_contract y health_readiness_contract, además del control documental existente.

## Fuera del piloto automático
- Cobro real, precio definitivo y publicación de pricing.
- Migraciones destructivas o relajación de RLS.
- Cambios legales/tributarios sin revisión humana.
- Promoción a producción si requiere credenciales, dominio o aprobación humana.

## Evidencia de salida
Registrar commit probado, run de CI verde, estado de /api/health en el entorno candidato y una pasada manual móvil/escritorio del recorrido 1–10. Si cualquiera falla, el piloto no se considera aprobado.
