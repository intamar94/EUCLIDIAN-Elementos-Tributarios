# Piloto comercial EUCLIDIAN | Protocolo para 3–5 contadores
**Estado:** preparado, no ejecutado. Requiere participantes y consentimiento informado.

## Pregunta verificable
¿Reduce EUCLIDIAN el tiempo necesario para localizar una fuente DIAN, reconocer lo no confirmado y preparar una nota profesional, comparado con el flujo habitual del contador?

## Configuración
- Participantes: 3–5 profesionales tributarios voluntarios en Colombia (idealmente con carteras de clientes diversas).
- Datos: escenarios **sintéticos** con referencias DIAN públicas; nunca nombres, NIT reales, declaraciones o nóminas.
- Sesión: 5 tareas por persona; primero se registran tiempos y herramientas actuales, después EUCLIDIAN. Alternar el orden en la mitad de participantes para reducir sesgo de aprendizaje.
- Producto: acceso restringido supervisado; no abrir registro público. La prueba y sus condiciones deben ser informadas y aceptadas.
- Privacidad: guardar códigos aleatorios P01–P05, nunca nombres/correos, ni grabar pantallas que revelen cuentas o clientes. Almacenar datos privados fuera del repositorio público.

## Cinco tareas y evaluación
| Código | Tarea observable | Correcto cuando |
| --- | --- | --- |
| T1 | Localizar acto/doctrina por número o asunto | URL DIAN correcta; distingue documento de referencia interna |
| T2 | Identificar fechas, publicación y vigencia | No confunde fecha del acto, publicación web ni entrada en vigor |
| T3 | Determinar qué cambió | Cita la fuente que acredita el cambio o dice "no determinado" |
| T4 | Evaluar posibles destinatarios del criterio | Identifica hechos/excepciones por verificar; no promete aplicabilidad automática |
| T5 | Preparar informe y comunicación al cliente | Texto útil, con referencia oficial, incertidumbres y decisiones pendientes |

Cada tarea se registra dos veces (herramientas habituales y EUCLIDIAN), con el mismo objetivo y casos equivalentes. El evaluador evalúa documentación y certeza; no solicita asesoría individual sobre contribuyentes reales.

## Variables y sistema de medición
`participante`: P01–P05; `tarea`: T1–T5; `modo`: `habitual` o `euclidian`; `segundos`: entero positivo; `url_oficial_correcta`, `fechas_correctas`, `incertidumbre_reconocida`, `entregable_utilizable`: 0/1; `error_critico`: 0/1 (fecha inventada, obligación afirmada sin soporte, referencia falsa); `herramientas_externas`: entero; `valor_1_5`: calificación de utilidad de 1 a 5.

No registrar descripción libre que pueda contener datos personales. Los participantes pueden compartir observaciones agregadas en documento privado separado y autorizado.

## Condiciones de avance predefinidas (hipótesis, no resultados)
- **Seguridad:** cero errores críticos atribuibles al producto en tareas completadas. Cualquier caso crítico bloquea ventas hasta corrección y repetición de la prueba.
- **Ahorro:** hipótesis de mejora >=25 % en tiempo mediano por tarea frente a flujo habitual; si no se alcanza, mejorar flujos antes de gastar en publicidad.
- **Utilidad:** mediana >=4/5 para entregables y referencias; si baja, revisar informes y explicación de evidencia.
- **Referencia oficial:** 100 % de conclusiones confirmadas debe tener enlace permitido y verificable, o declararse "no confirmado".
- **Intención de pagar:** recoger rango razonable y objeciones, sin ofrecer suscripciones antes de la aprobación legal.
- Muestra pequeña: resultados exploratorios, nunca afirmar representatividad estadística ni ahorro garantizado.

## Formato de captura
CSV vacío: `docs/plantillas/piloto_contadores.csv`. Una fila por participante, tarea y modo. **No guardar resultados reales en el repositorio público**: exportar fuera de GitHub, anonimizar y agregar únicamente conclusiones estadísticas autorizadas.

## Salida del piloto
- Número de tareas válidas y exclusiones justificadas.
- Tiempo mediano por tarea y reducción relativa.
- Errores críticos y fallos de fuente.
- Desempeño de informe técnico y comunicación al cliente.
- Herramientas externas necesarias y utilidad percibida.
- Objeciones de precio, utilidad y onboarding; decisión go/no-go.
- Enlace al conjunto de fixtures públicos (sin identificadores personales).

Dependencias: evidencias del agente jurídico [#88](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/88); validación comercial [#91](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/91); puerta legal cerrada.
