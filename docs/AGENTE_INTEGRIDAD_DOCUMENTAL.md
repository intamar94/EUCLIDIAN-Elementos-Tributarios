# Agente de integridad documental

El agente recibe la última inspección completa y transforma cada hallazgo
crítico en un caso interno con prioridad, evidencia, fecha y decisión.

## Decisiones que puede tomar

- Corrige la fecha documental solo cuando la página oficial DIAN expone una
  fecha propia, única y distinta a la almacenada.
- Sustituye un enlace roto solo si encuentra otra URL del Normograma DIAN que
  identifica el mismo documento.
- Tras una corrección, reinicia la verificación fiscal y bloquea el uso del
  documento en correos hasta que pase los controles posteriores.

## Decisiones que conserva para análisis

No modifica por deducción las citas jurídicas, tesis, preguntas, plazos,
alcance territorial, vigencia ni duplicados. Cada uno queda en la bitácora
como `requiere_analisis` o `pendiente_evidencia`, con su fuente DIAN.

## Operación

El flujo `.github/workflows/agente_control_interno.yml` se ejecuta al terminar
el inspector documental y puede iniciarse manualmente en modo `simular` o
`aplicar`. El panel privado `/inspector.html` muestra el resumen y los casos
de la ejecución más reciente. Las tablas `control_interno_ejecuciones` y
`control_interno_casos` tienen RLS activo; solo `service_role` accede.
