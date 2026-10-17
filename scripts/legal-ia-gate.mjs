#!/usr/bin/env node
/**
 * LEGAL.ia / FARO de Intamar — reusable fail-closed publication audit.
 * It checks recorded evidence and optional public page links, NOT legal validity.
 * Keep all evidence documents and personal data in private storage.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const argv=process.argv.slice(2);
function argument(key, fallback) {
  const idx=argv.indexOf(key);
  return idx<0 ? fallback : (argv[idx+1] || '');
}
const mode=argument('--mode','audit');
const projectKey=argument('--project','euclidian');
const all=argv.includes('--all'), json=argv.includes('--json');
if (!['audit','release'].includes(mode) || (!all&&!/^[a-z][a-z0-9-]{1,59}$/.test(projectKey))) {
  console.error('Uso: node scripts/legal-ia-gate.mjs --mode audit|release --project slug [--json] o --all');
  process.exit(2);
}
function readJSON(filename) {
  try { return JSON.parse(fs.readFileSync(filename,'utf8')); }
  catch(err) { console.error('Expediente no disponible: '+filename+' - '+err.message); process.exit(2); }
}
const company=readJSON('LEGALIA/empresa.template.json');
const catalog=readJSON('LEGALIA/catalogo-riesgos.json');
const safeText=(v)=>typeof v==='string'&&v.trim().length>2;
function checkProject(slug) {
  const p=readJSON('LEGALIA/proyectos/'+slug+'.json');
  const tests=[];
  const c=p.controls||{}, e=p.evidence||{}, f=p.features||{}, d=p.domain||{}, pages=p.pages||{};
  function add(id,ok,desc,source,blocker='REVIEW') {
    tests.push({id,result:ok?'APPROVED':blocker,requirement:desc,source:source||'LEGALIA'});
  }
  const identity=company.legal_identity||{}, reg=company.trade_registration||{}, tax=company.tax||{};
  const human=company.approval||{}, approval=p.human_approval||{};
  add('operator.identity',identity.full_name_verified===true&&identity.serviceable_address_confirmed_for_publication===true&&identity.contact_email_verified===true,
    'Datos jurídicos del titular, dirección notificable y contacto confirmados por vía privada','DDG §5');
  add('operator.gewerbe',reg.status==='CONFIRMED'&&reg.business_activity_scope_verified===true&&p.company_scope_approved===true,
    'Actividad empresarial y alcance del proyecto acreditados','GewO §14');
  add('operator.tax',tax.vat_classification_reviewed===true,'Clasificación fiscal/IVA verificada','Steuerrecht');
  add('operator.brand',company.brand_trademark_check_status==='APPROVED'&&safeText(company.brand_trademark_check_reference),
    'Búsqueda marcaria documentada (no equivale a registro)','DPMA/EUIPO');
  add('operator.approval',human.status==='APPROVED'&&safeText(human.approver)&&safeText(human.date)&&safeText(human.evidence),
    'Aprobación humana de empresa y referencia a evidencia privada','LEGAL.ia');
  add('project.classification',p.classification_reviewed===true&&Array.isArray(p.project_type)&&p.project_type.length>0&&Array.isArray(p.target_market)&&p.target_market.length>0&&p.risk_inventory_confirmed===true,
    'Actividad, países destinatarios y funciones de riesgo contrastados','LEGAL.ia');
  add('project.approval',approval.status==='APPROVED'&&safeText(approval.reviewer)&&safeText(approval.reviewed_at)&&safeText(approval.evidence_link),
    'Aprobación humana específica del proyecto, fechada y documentada','LEGAL.ia');
  function control(id,description,source='LEGAL.ia') {
    // APPROVED requires a non-sensitive reference to a privately held artifact.
    const state=c[id], proof=e[id];
    const exception=p.exceptions?.[id];
    const accepted=state==='APPROVED'&&safeText(proof);
    const excluded=state==='NOT_APPLICABLE'&&safeText(exception?.reason)&&safeText(exception?.reviewer)&&safeText(exception?.evidence);
    add('control.'+id,accepted||excluded,description+'; aprobación o no-aplicabilidad justificada con evidencia',source,state==='REJECTED'?'REJECTED':'REVIEW');
  }
  let root=null;
  if(typeof p.web_root==='string' && p.web_root.trim()){
    const candidate=path.resolve(process.cwd(),p.web_root);
    const cwd=process.cwd()+path.sep;
    if(candidate===process.cwd()||candidate.startsWith(cwd))root=candidate;
  }
  for(const kind of ['impressum','datenschutz']){
    const entry=pages[kind]||{}, rel=(entry.path||'').replace(/^\/+/, '');
    const validRel=/^[\w/-]+\.html$/.test(rel)&&!rel.split('/').includes('..');
    const file=root&&validRel?path.join(root,rel):null;
    const html=root&&fs.existsSync(path.join(root,'index.html'))?fs.readFileSync(path.join(root,'index.html'),'utf8'):'';
    const app=root&&fs.existsSync(path.join(root,'app.html'))?fs.readFileSync(path.join(root,'app.html'),'utf8'):'';
    const linked=validRel&&[html,app].filter(Boolean).every(t=>t.includes('href="/'+rel+'"')||t.includes("href='/"+rel+"'"));
    const legalBody=file&&fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
    const hasPlaceholders=/\{\{[^}]+\}\}|ENTWURF|BORRADOR|NICHT VERÖFFENTLICHEN|NO PUBLICABLE/i.test(legalBody);
    add('page.'+kind,Boolean(file&&fs.existsSync(file)&&linked&&!hasPlaceholders&&entry.status==='APPROVED'&&safeText(entry.evidence)),
      'Página '+kind+' aprobada, existente y enlazada en el sitio; referencia de aprobación registrada',kind==='impressum'?'DDG §5':'DSGVO arts. 12-14');
  }
  for(const k of ['privacy_mapping','processor_contracts_dpa','security_access','cookie_consent_audit','brand_and_asset_licensing'])
    control(k,catalog.shared[k]||k);
  if(p.target_market?.some(country=>country!=='DE'))control('cross_border_tax_and_terms','Reglas tributarias y contratos transfronterizos por país');
  if(p.project_type?.some(x=>['saas','content','digital_product','marketplace'].includes(x)))control('source_attribution_disclaimers','Licencias y atribución de fuentes y contenidos');
  add('domain.production',d.dns_verified===true&&d.https_verified===true&&d.canonical_website_checked===true&&d.public_access_without_vercel_login_checked===true,
    'DNS, HTTPS, canonical y acceso externo sin desproteger administración comprobados','Web');
  for(const item of catalog.conditional) {
    if(item.when_any?.some(k=>f[k]===true)||item.when_type_any?.some(k=>p.project_type?.includes(k)))
      for(const key of item.controls)control(key,item.description,item.source);
  }
  const rejected=tests.filter(x=>x.result==='REJECTED'), pending=tests.filter(x=>x.result!=='APPROVED');
  return {slug,project:p.project,parent:company.umbrella_brand,mode,
    status:rejected.length?'REJECTED':pending.length?'REVIEW':'READY_FOR_HUMAN_RELEASE_DECISION',
    approved:tests.length-pending.length,total:tests.length,pending:pending.length,rejected:rejected.length,checks:tests};
}
const slugs=all?fs.readdirSync('LEGALIA/proyectos').filter(s=>/^[a-z][a-z0-9-]+\.json$/.test(s)).map(s=>s.replace(/\.json$/,'')): [projectKey];
const reports=slugs.map(checkProject);
const results=all?{system:'LEGAL.ia',projects:reports.length,mode,reports}:{system:'LEGAL.ia',...reports[0]};
if(json)console.log(JSON.stringify(results,null,2));
else for(const item of reports){
  console.log('LEGAL.ia '+item.slug+': '+item.approved+'/'+item.total+' controles; '+item.pending+' pendientes; '+item.status);
  for(const c of item.checks.filter(c=>c.result!=='APPROVED'))console.log(c.result+' '+c.id+': '+c.requirement);
}
if(mode==='release'&&reports.some(r=>r.status!=='READY_FOR_HUMAN_RELEASE_DECISION'))process.exitCode=1;
