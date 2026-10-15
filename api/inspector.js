// Ruta retirada: el ciclo documental es responsable de adaptar y publicar.
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  return res.status(410).json({error:'ruta_retirada',mensaje:'La publicación pertenece al ciclo documental automático.'});
}
