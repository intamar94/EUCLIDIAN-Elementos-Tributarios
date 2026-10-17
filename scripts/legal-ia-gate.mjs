#!/usr/bin/env node
/** LEGAL.ia: dry audit and fail-closed pre-publication gate; no dependencies. */
import fs from 'node:fs';
import process from 'node:process';
const argv=process.argv;
const option=(name, fallback)=>argv.includes(name)?argv[argv.indexOf(name)+1]:fallback;
const mode=option('--mode','audit'), projectName=option('--project','euclidian'), json=argv.includes('--json');
if (!['audit','release'].includes(mode) || !/^[a-z0-9-]+$/.test(projectName)){console.error('Invalid mode/project');process.exit(2)}
function read(file){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch(err){console.error('Cannot read '+file+': '+err.message);process.exit(2)}}
const company=read('LEGALIA/empresa.template.json'), p=read('LEGALIA/proyectos/'+projectName+'.json');
const c=p.controls||{}, f=p.features||{}, d=p.domain||{}, pages=p.pages||{}, tests=[];
const yes=v=>v==='APPROVED';
function test(id,success,requirement){tests.push({id,result:success?'APPROVED':'REVIEW',requirement})}
test('identity',Object.values(company.legal_identity||{}).every(v=>v===true),'Nombre legal, dirección notificable y contacto aprobados para Impressum');
test('gewerbe',company.trade_registration?.status==='CONFIRMED'&&company.trade_registration?.business_activity_scope_verified===true&&p.company_scope_approved===true,'Gewerbe y actividad del proyecto confirmados');
test('tax',company.tax?.vat_classification_reviewed===true,'Clasificación fiscal, IVA y transfronterizo revisados');
test('trademark',yes(company.brand_trademark_check_status),'Marca empresarial revisada');
test('company-approval',yes(company.approval?.status)&&Boolean(company.approval?.approver&&company.approval?.date&&company.approval?.evidence),'Aprobación humana de empresa con evidencia');
test('project-approval',yes(p.human_approval?.status)&&Boolean(p.human_approval?.reviewer&&p.human_approval?.reviewed_at&&p.human_approval?.evidence_link),'Aprobación humana de proyecto con evidencia');
const index=fs.existsSync('index.html')?fs.readFileSync('index.html','utf8'):'';
for(const key of ['impressum','datenschutz']){
 const entry=pages[key]||{}, file=(entry.path||'').replace(/^\//,'');
 test('page-'+key,Boolean(file&&fs.existsSync(file)&&yes(entry.status)&&(index.includes('href="/'+file+'"')||index.includes("href='/"+file+"'"))),'Página '+key+' existente, enlazada y revisada');
}
for(const key of ['privacy_mapping','processor_contracts_dpa','security_access','cookie_consent_audit','brand_and_asset_licensing','cross_border_tax_and_terms','source_attribution_disclaimers'])
  test('control-'+key,yes(c[key]),'Revisión documentada de '+key);
test('domain',d.dns_verified===true&&d.https_verified===true&&d.canonical_website_checked===true&&d.public_access_without_vercel_login_checked===true,'DNS/HTTPS/canonical y acceso público verificados');
if(f.payment_checkout_live===true){
 test('checkout',yes(c.customer_terms_if_live)&&yes(pages.terms_if_checkout?.status),'Checkout §312j y AGB revisados');
 test('withdrawal',yes(c.widerrufsbutton_if_applicable)&&yes(pages.withdrawal_if_applicable?.status),'Desistimiento §356a si corresponde');
}
if(f.recurring_b2c_sales_live===true)test('subscriptions',yes(c.kuendigungsbutton_if_applicable),'Kündigungsbutton §312k si corresponde');
if(f.customer_funds_held===true)test('funds',yes(c.regulated_payments_external_legal_opinion),'Fondo cliente: dictamen BaFin/ZAG');
const pending=tests.filter(x=>x.result!=='APPROVED');
const report={system:'LEGAL.ia',parent:company.umbrella_brand,project:p.project,mode,status:pending.length?'REVIEW':'APPROVED_PENDING_HUMAN_DEPLOY_ACTION',approved:tests.length-pending.length,total:tests.length,pending:pending.length,checks:tests};
if(json)console.log(JSON.stringify(report,null,2));
else{console.log('LEGAL.ia: '+report.approved+'/'+report.total+' controles conformes; '+report.pending+' pendientes. Estado '+report.status); for(const x of pending)console.log('REVIEW '+x.id+': '+x.requirement)}
if(mode==='release'&&pending.length)process.exitCode=1;
