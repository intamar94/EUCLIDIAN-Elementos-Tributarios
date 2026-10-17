# Cartera FARO · expedientes LEGAL.ia
**Estado al 17/10/2026:** sistema interno de preparación, no certificados legales. Los proyectos futuros son ideas, no actividades comerciales operativas.

| Proyecto | Expediente | Perfil provisional | Estado |
| --- | --- | --- | --- |
| EUCLIDIAN | `proyectos/euclidian.json` | SaaS/consulta tributaria, Alemania→Colombia | REVIEW: identidad, Gewerbe, privacidad, textos, pagos |
| FARO-01 | `proyectos/faro-01.json` | Intermediación/servicios locales, posible saldo | REVIEW: fondos/PSP/ZAG, contratos, seguros |
| FABRICABLE | `proyectos/fabricable.json` | Plataforma SaaS/fabricación (a confirmar) | REVIEW |
| ZweiTierras | `proyectos/zweitierras.json` | Productos físicos/alimentarios | REVIEW: higiene, etiquetado, producto, impuestos |
| Mundo de Papel | `proyectos/mundo-de-papel.json` | Artículos creativos físicos | REVIEW: consumo, seguridad de productos, licencias |
| BienvenidoQR | `proyectos/bienvenidoqr.json` | Producto digital/QR (a confirmar) | REVIEW: destino QR, privacidad, contratos |
| MercadoQR | `proyectos/mercadoqr.json` | Posible marketplace (a confirmar) | REVIEW: rol de intermediario y contenido de terceros |
| PflegeDeutsch Pocket | `proyectos/pflegedeutsch-pocket.json` | Producto digital educativo | REVIEW: licencias, comunicaciones, datos |

El perfil es un **supuesto conservador de revisión**, no una aseveración de que la empresa ya ofrece esas actividades. Cada expediente permanece `classification_reviewed=false` y `risk_inventory_confirmed=false` hasta inspección.

## Vista de cartera en un solo comando
`node scripts/legal-ia-gate.mjs --mode audit --all --json`

La cartera se amplía con:
`node scripts/legal-ia-new-project.mjs proyecto-nuevo "Proyecto Nuevo" --type digital_product --markets DE,CO --risks user_accounts`

Tipos iniciales: landing, content, saas, digital_product, ecommerce, physical_goods, marketplace, local_service, hardware.
Riesgos: user_accounts, payment_checkout_live, recurring_b2c_sales_live, customer_funds_held, ai_features_live, children_targeted, sensitive_personal_data, location_tracking, marketing_tracking, email_marketing, regulated_activity, user_generated_content.
**Nunca reutilizar automáticamente conclusiones comerciales/consumo/impuestos de EUCLIDIAN para otra web.**

Los expedientes en este repositorio público solo guardan metadatos de clasificación y referencias a pruebas privadas. No guardan nombre legal de la persona física, domicilio, DNI, datos fiscales, documentos del Gewerbe, secretos ni contratos confidenciales.
