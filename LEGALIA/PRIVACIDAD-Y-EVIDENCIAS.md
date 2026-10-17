# Evidencias seguras y privacidad de la titular
**Repositorio actual = público.** Suponer que cualquier cosa incorporada a GitHub puede quedar indexada permanentemente, incluso aunque un commit posterior la borre.

## Permitido en GitHub
- Nombre de proyecto/empresa como marca: Faro de Intamar.
- Inventario de funcionalidades, proveedores, dominios públicos y países.
- Estados de controles, referencias a expedientes privados **sin datos personales**, fecha de revisión y responsable definido por rol público.
- Textos con marcadores sin datos de identificación real.

## Prohibido en GitHub
- Nombre legal de una persona física sin autorización para hacerlo público, domicilio real completo antes de aprobación de Impressum, teléfonos privados, identificación, firma, documentos del Gewerbe.
- Steuernummer, documentos fiscales, datos bancarios o recibos con información personal.
- Tokens, contraseñas, configuración de claves, bases exportadas con usuarios y contratos confidenciales.
- Datos de clientes/proveedores o de menores y capturas que permitan identificarlos.

## Almacén de evidencias privado
Sugerencia de carpetas con privilegios mínimos:
`FARO/LEGAL/EMPRESA/`, `FARO/LEGAL/PROYECTOS/<slug>/`,
`FARO/LEGAL/CONTRATOS/`, `FARO/LEGAL/REVISIONES/`, `FARO/LEGAL/INCIDENTES/`.
No asumir que existen hasta verificar permisos. Guardar en almacenamiento privado, con respaldo y acceso restringido.

## Publicación inevitable del Impressum
La dirección comercial, si se utiliza el domicilio, será **pública** cuando se apruebe y publique el Impressum. Validar exactamente qué datos deben publicarse y revisarlos en vista previa privada. Separar la decisión de mostrar esos datos al consumidor de filtrarlos prematuramente en un repositorio abierto.

## Control de integridad
El código solo comprueba que la referencia a la evidencia exista como identificador; no puede probar que el documento subyacente existe ni que un abogado lo aprobó. Requerir revisión humana de cualquier solicitud de cambios que altere `APPROVED`, `NOT_APPLICABLE`, el esquema, el motor de reglas o los tests.
