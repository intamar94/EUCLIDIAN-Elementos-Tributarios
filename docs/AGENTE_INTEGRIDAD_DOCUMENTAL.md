# Agente de integridad documental

El agente recibe la última inspección completa y transforma cada hallazgo
crítico en un caso interno con prioridad, evidencia, fecha y decisión.

## Protocolo de excepción documental

Todos los casos atípicos siguen este ciclo; no se cierran por antigüedad ni
por una inferencia del extractor.

1. **Registrar:** el inspector conserva el documento, el hallazgo, la fecha y
   el enlace DIAN que produjo el resultado.
2. **Contrastar:** el agente consulta exclusivamente el Normograma o el
   boletín oficial y compara identidad, texto, fecha, citas, plazos y vigencia.
3. **Decidir con evidencia:** puede corregir un dato literal, retirarlo si es
   incompleto o conservarlo como caso pendiente. La evidencia indica el valor
   anterior, el valor aplicado y la fuente.
4. **Proteger al suscriptor:** cualquier ajuste reinicia la revisión fiscal y
   bloquea su uso en correos. Una fuente oficial inaccesible deja el registro
   fuera de publicación hasta que se recupere una URL DIAN inequívoca.
5. **Reinspeccionar:** el agente ejecuta un nuevo barrido integral y enlaza esa
   ejecución con el caso gestionado. Solo esa segunda fotografía prueba que la
   corrección se mantiene.
6. **Reabrir:** toda ejecución posterior vuelve a contrastar los pendientes;
   un enlace, formato DIAN o criterio nuevo nunca se considera resuelto de
   forma permanente.

## Decisiones que puede tomar

- Corrige la fecha documental solo cuando la página oficial DIAN expone una
  fecha propia, única y distinta a la almacenada.
- Sustituye un enlace roto solo si encuentra otra URL del Normograma DIAN que
  identifica el mismo documento. Si DIAN confirma que el enlace es inaccesible
  y no existe sustitución inequívoca, retira el registro de publicación y lo
  conserva en cuarentena con su evidencia.
- Tras una corrección, reinicia la verificación fiscal y bloquea el uso del
  documento en correos hasta que pase los controles posteriores.

## Decisiones que conserva para análisis

No modifica por deducción las citas jurídicas, tesis, preguntas, plazos,
alcance territorial, vigencia ni duplicados. Cada uno queda en la bitácora
como `requiere_analisis` o `pendiente_evidencia`, con su fuente DIAN. Una cita
o un plazo fragmentados se retiran de la publicación si no pueden recuperarse
literalmente de la fuente.

## Operación

El flujo `.github/workflows/agente_control_interno.yml` se ejecuta al terminar
el inspector documental y puede iniciarse manualmente en modo `simular` o
`aplicar`. El panel privado `/inspector.html` muestra el resumen y los casos
de la ejecución más reciente. Las tablas `control_interno_ejecuciones` y
`control_interno_casos` tienen RLS activo; solo `service_role` accede.
