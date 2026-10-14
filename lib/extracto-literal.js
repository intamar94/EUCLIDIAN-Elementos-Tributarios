// Un texto literal puede ser auténtico y aun así pertenecer a una nota al pie.
export function extractoDelCuerpo(textoCompleto, extracto){
  const prefix='Extracto literal DIAN: ';
  if(!String(extracto||'').startsWith(prefix))return true;
  const normalizar=v=>String(v||'').normalize('NFKC').replace(/\s+/g,' ').trim();
  const cita=normalizar(String(extracto).slice(prefix.length));
  if(/^(?:\d{1,3}\.\s*)?(?:cfr\.?\s|cf\.?\s|v[eé]ase\b|en (?:los anteriores|estos) t[eé]rminos|atentamente\b|cordialmente\b)/i.test(cita))return false;
  const cuerpo=String(textoCompleto||'').split(/NOTAS\s+DE\s+PIE\s+DE\s+P[ÁA]GINA/i)[0];
  return cita.length>=80&&normalizar(cuerpo).includes(cita);
}
