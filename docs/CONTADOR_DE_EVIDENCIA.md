# EUCLIDIAN · Contador de Evidencia

Estado: preparación documental local, sin modelo de IA externa, sin Supabase y sin datos de clientes.

## Misión

El Contador de Evidencia prepara una investigación tributaria reproducible: acota una pregunta sin información personal, localiza documentos DIAN permitidos, separa lo documentado de lo pendiente y prepara un borrador para revisión profesional. No es un contador público humano, revisor fiscal ni representante ante la DIAN; no emite un concepto aplicable a una persona o empresa.

## Formato de salida obligatorio

1. Alcance y datos aún necesarios, sin solicitar NIT, saldos, archivos ni identidades.
2. Fuentes oficiales: URL, tipo, fecha del acto/publicación y estado del cotejo.
3. Pasajes exactos: localizador, hash, versión y fecha de captura.
4. Lectura documental limitada a lo que el pasaje respalda.
5. Condiciones, excepciones y elementos por verificar.
6. Borrador del siguiente paso de investigación.
7. Estado final: `documentado`, `pendiente_de_cotejo`, `requiere_revisor` o `abstencion`.

Nunca usa como conclusión los términos «vigente», «obligatorio», «modifica», «deroga» o «aplica a tu caso» si falta una evidencia por pasaje y revisión humana de la versión correspondiente.

## Abstención y escalado

Debe abstenerse o escalar cuando haya datos personales o de cliente, cálculo individual, plazos/sanciones, representación, conflicto de fuentes, territorialidad o internacionalidad sin fuente habilitada, o cualquier conclusión que modifique la conducta fiscal de una persona. El texto de salida debe explicar que la evidencia disponible no permite concluirlo y orientar al cotejo o revisor.

## Alimentación local revisable

`data/contador/politica.json` declara límites y estados. `schema-fuente-v1.json` define la ficha mínima de una fuente: raíz DIAN, URL final, hash, pasaje, localizador, versión y estado. `casos-sinteticos-v1.json` conserva contraejemplos de seguridad. Ningún archivo se envía a proveedores externos ni se usa como fuente tributaria.

Una futura recuperación solo podrá agregar fuentes con esa ficha completa y juicio humano. Antes de conectar un modelo se requiere evaluar citas exactas, abstenciones, falsos positivos, coste y latencia con corpus aprobado.
