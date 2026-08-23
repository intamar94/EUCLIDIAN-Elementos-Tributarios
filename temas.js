/* EUCLIDIAN — nombres de los temas.
 *
 * Aparte porque es una tabla larga que casi no cambia: se toca cuando
 * el clasificador estrena un tema, no cuando cambia como se ve una
 * ficha. Se carga antes que fichas.js.
 */

const ETIQUETAS = {
  renta:'Renta', ganancia_ocasional:'Ganancia ocasional', iva:'IVA',
  consumo:'Impuesto al consumo', timbre:'Timbre', patrimonio:'Patrimonio',
  gmf:'GMF (4x1000)', simple:'Régimen SIMPLE', carbono:'Impuesto al carbono',
  plasticos:'Plásticos de un solo uso', saludables:'Impuestos saludables',
  licores_tabaco:'Licores y tabaco', normalizacion:'Normalización',
  retencion:'Retención en la fuente', retencion_iva:'ReteIVA',
  facturacion:'Facturación electrónica', nomina_electronica:'Nómina electrónica',
  exogena:'Información exógena', rut:'RUT', rub:'Beneficiario final',
  contabilidad:'Contabilidad y NIIF', devoluciones:'Devoluciones',
  firmeza:'Firmeza y prescripción', sanciones:'Sanciones',
  fiscalizacion:'Fiscalización', cobro:'Cobro y acuerdos de pago',
  beneficios:'Beneficios y conciliación', recursos:'Recursos y defensa',
  notificaciones:'Notificaciones', precios_transferencia:'Precios de transferencia',
  convenios:'Doble imposición', ece:'Entidades del exterior',
  aduanero:'Aduanero', cambiario:'Cambiario', comercio_exterior:'Comercio exterior',
  transporte:'Transporte de carga', zonas_francas:'Zonas francas',
  esal:'ESAL y donaciones', salud:'Salud', agropecuario:'Agropecuario',
  turismo:'Turismo', criptoactivos:'Criptoactivos', financiero:'Sector financiero',
  economia_naranja:'Economía naranja', formularios:'Formularios y recibos',
  calendario:'Calendario tributario', uvt:'UVT', interno_dian:'Interno de la DIAN',
};
function nombreTema(t){ return ETIQUETAS[t] || t.replace(/_/g,' '); }
