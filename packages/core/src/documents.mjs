// Shared browser/server domain. All arithmetic uses scaled integers; never floats.
export const ACTIVITY_IDS = ['bitg', 'botr', 'security', 'fourth'];
export const STATUSES = { quote: ['concept', 'verstuurd', 'akkoord', 'afgewezen'], invoice: ['concept', 'verstuurd', 'betaald'] };
export const clone = value => structuredClone(value);
const fail = message => { throw new Error(message); };
const text = (value, maximum = 2000) => typeof value === 'string' && value.length <= maximum ? value : fail('Ongeldige tekst of te lange invoer.');
const id = value => /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? value : fail('Ongeldig kenmerk.');
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export function date(value) { if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)!==value)fail('Vul een geldige datum in.');return value; }
export function scaled(value, digits = 2) {
  const input=String(value).trim().replace(',', '.');
  if(!new RegExp(`^\\d{1,8}(?:\\.\\d{1,${digits}})?$`).test(input))fail(`Gebruik een positief getal met maximaal ${digits} decimalen.`);
  const [whole,fraction='']=input.split('.');return BigInt(whole)*10n**BigInt(digits)+BigInt(fraction.padEnd(digits,'0'));
}
const round=(value,divisor)=>(value+divisor/2n)/divisor;
const safe=value=>value<=BigInt(Number.MAX_SAFE_INTEGER)?Number(value):fail('Het bedrag is te groot.');
export function totals(lines, vatMode='standard') {
  if(!['standard','kor','exempt'].includes(vatMode))fail('Kies eerst de btw-behandeling bij Bedrijfsgegevens.');
  if(!Array.isArray(lines)||!lines.length||lines.length>100)fail('Gebruik 1 tot 100 documentregels.');
  const groups={};let net=0n,tax=0n;
  const result=lines.map(line=>{
    text(line.description,300);const quantity=scaled(line.quantity,3),price=scaled(line.price||'0');
    if(quantity===0n)fail('Het aantal moet groter zijn dan nul.');
    const discount=scaled(line.discount||'0');if(discount>10000n)fail('Korting mag niet hoger zijn dan 100%.');
    const rate=Number(line.vat);if(![0,9,21].includes(rate))fail('Kies 0, 9 of 21% btw.');
    const gross=round(quantity*price,1000n),discountCents=round(gross*discount,10000n),lineNet=gross-discountCents;
    const actualRate=vatMode==='standard'?rate:0,lineTax=round(lineNet*BigInt(actualRate),100n);
    const key=vatMode==='standard'?String(actualRate):vatMode;
    groups[key]??={netCents:0,taxCents:0};groups[key].netCents+=safe(lineNet);groups[key].taxCents+=safe(lineTax);
    net+=lineNet;tax+=lineTax;
    return{netCents:safe(lineNet),taxCents:safe(lineTax),discountCents:safe(discountCents),rate:actualRate};
  });
  return{lines:result,groups,netCents:safe(net),taxCents:safe(tax),totalCents:safe(net+tax)};
}
export const money=cents=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(cents/100);
export function eventHours(start,end){
  if(!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end))fail('Vul begin- en eindtijd in.');
  const minutes=value=>{const [h,m]=value.split(':').map(Number);if(h>23||m>59)fail('Ongeldige tijd.');return h*60+m;};
  let length=minutes(end)-minutes(start);if(length===0)fail('Begin- en eindtijd mogen niet gelijk zijn.');if(length<0)length+=1440;
  return String(Math.round(length/15)/4);
}
const service=(description)=>({description,price:'',vat:21});
export function initialWorkspace(){return{
  app:'beck-business',version:1,revision:0,
  legal:{id:'beck',name:'',address:'',postcode:'',city:'',email:'',phone:'',kvk:'',vatId:'',iban:'',vatMode:'unconfirmed',vatReason:''},
  activities:[
    {id:'bitg',name:'Beck In The Gym',prefix:'BITG',color:'#b8bea1',logo:'bitg',terms:'',services:['1-op-1 personal training','Duo personal training','Small-group training (maximaal 4)','Persoonlijk trainingsschema','Techniekbegeleiding'].map(service)},
    {id:'botr',name:'Beck on the Rocks',prefix:'BOTR',color:'#c3a57d',logo:'botr',terms:'',services:['Bartender','Voorbereiding','Cocktailmenu & materialen','Reiskosten','Glazen'].map(service)},
    {id:'security',name:'Beveiligingsactiviteiten',prefix:'BEV',color:'#8facbf',logo:'security',terms:'',services:['Beveiligingsdienst','Evenementbeveiliging','Toegangscontrole'].map(service)},
    {id:'fourth',name:'Vierde activiteit',prefix:'ACT4',color:'#b5a3c8',logo:'fourth',terms:'',services:['Dienst op maat'].map(service)}
  ],customers:[],documents:[],audit:[]};}
export function newDocument(state,activityId,type='quote',uuid=crypto.randomUUID()){
  const activity=state.activities.find(a=>a.id===activityId);if(!activity||!STATUSES[type])fail('Onbekende activiteit of documentsoort.');
  return{id:uuid,revision:0,activityId,type,status:'concept',number:'',date:today(),serviceDate:'',days:14,reference:'',sourceId:'',
    customer:{name:'',company:'',address:'',postcode:'',city:'',email:'',phone:''},issuer:clone(state.legal),brand:clone(activity),
    lines:[{description:activity.services[0]?.description||'Dienst',quantity:'1',price:activity.services[0]?.price||'',vat:activity.services[0]?.vat??21,discount:'0'}],notes:'',terms:activity.terms};
}
function checkedCustomer(customer){
  if(!customer||typeof customer!=='object')fail('Ongeldige klant.');
  return Object.fromEntries(['name','company','address','postcode','city','email','phone'].map(key=>[key,text(customer[key]??'',key==='email'?254:200)]));
}
function checkedLogo(logo){
  if(['bitg','botr','security','fourth'].includes(logo))return logo;
  if(typeof logo==='string'&&logo.length<400000&&/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(logo))return logo;
  fail('Gebruik een PNG-, JPG- of WebP-logo kleiner dan 250 kB.');
}
export function checkedLegal(value){
  const result={id:'beck'};
  for(const key of ['name','address','postcode','city','email','phone','kvk','vatId','iban','vatReason'])result[key]=text(value[key]??'',300);
  if(!['unconfirmed','standard','kor','exempt'].includes(value.vatMode))fail('Ongeldige btw-behandeling.');result.vatMode=value.vatMode;
  if(value.vatMode==='exempt'&&!result.vatReason.trim())fail('Vermeld de reden van btw-vrijstelling.');return result;
}
export function checkedActivity(value){
  const defaults=initialWorkspace().activities.find(a=>a.id===value.id);if(!defaults)fail('Onbekende activiteit.');
  if(!/^#[0-9a-fA-F]{6}$/.test(value.color))fail('Ongeldige merkkleur.');
  if(!Array.isArray(value.services)||value.services.length>50)fail('Gebruik maximaal 50 diensten.');
  return{id:defaults.id,prefix:defaults.prefix,name:text(value.name,120),color:value.color,logo:checkedLogo(value.logo),terms:text(value.terms,10000),services:value.services.map(s=>{
    const price=text(s.price,20);if(price)scaled(price);if(![0,9,21].includes(Number(s.vat)))fail('Ongeldig btw-tarief.');return{description:text(s.description,300),price,vat:Number(s.vat)};
  })};
}
export function checkedDocument(value){
  if(!value||!ACTIVITY_IDS.includes(value.activityId)||!STATUSES[value.type]?.includes(value.status))fail('Ongeldig document.');
  if(!Number.isSafeInteger(value.revision)||value.revision<0||value.revision>1000000)fail('Ongeldige documentversie.');
  const result={id:id(value.id),revision:value.revision,activityId:value.activityId,type:value.type,status:value.status,number:text(value.number,80),date:date(value.date),serviceDate:value.serviceDate?date(value.serviceDate):'',days:Number(value.days),reference:text(value.reference,200),sourceId:value.sourceId?id(value.sourceId):'',customer:checkedCustomer(value.customer),issuer:checkedLegal(value.issuer),brand:checkedActivity(value.brand),notes:text(value.notes,10000),terms:text(value.terms,10000)};
  if(result.brand.id!==result.activityId)fail('Document en huisstijl horen niet bij dezelfde activiteit.');
  if(!Number.isInteger(result.days)||result.days<1||result.days>365)fail('Kies een termijn van 1 tot 365 dagen.');
  if(!Array.isArray(value.lines)||value.lines.length<1||value.lines.length>100)fail('Gebruik 1 tot 100 regels.');
  result.lines=value.lines.map(line=>({description:text(line.description,300),quantity:String(line.quantity),price:String(line.price),vat:Number(line.vat),discount:String(line.discount||'0')}));
  result.totals=totals(result.lines,result.issuer.vatMode);
  return result;
}
const audit=(state,action,documentId='')=>{state.audit.push({at:new Date().toISOString(),action,documentId});state.audit=state.audit.slice(-2000);state.revision++;return state;};
export function saveDocument(workspace,draft){
  const state=clone(workspace),doc=checkedDocument(draft),existing=state.documents.find(d=>d.id===doc.id);
  if(!doc.customer.name.trim()&&!doc.customer.company.trim())fail('Vul een klantnaam of bedrijfsnaam in.');
  if(doc.lines.some(l=>!l.description.trim()||l.price===''))fail('Geef iedere regel een omschrijving en prijs.');
  if(!existing&&doc.sourceId&&doc.type==='invoice'&&state.documents.some(d=>d.type==='invoice'&&d.sourceId===doc.sourceId))fail('Van deze offerte bestaat al een factuurconcept. Open dat bestaande concept.');
  if(existing){
    if(existing.revision!==doc.revision)fail('Dit document is in een ander venster gewijzigd. Open het opnieuw.');
    if(existing.activityId!==doc.activityId||existing.type!==doc.type||existing.number!==doc.number)fail('Documentsoort, activiteit en nummer kunnen niet worden gewijzigd.');
    state.documents=state.documents.filter(d=>d.id!==doc.id);
  }else{
    const year=doc.date.slice(0,4),prefix=`TEST-${doc.brand.prefix}-${doc.type==='quote'?'O':'F'}-${year}-`;
    const highest=state.documents.reduce((n,d)=>d.number.startsWith(prefix)?Math.max(n,Number(d.number.slice(prefix.length))||0):n,0);
    doc.number=prefix+String(highest+1).padStart(4,'0');
  }
  doc.revision++;state.documents.push(doc);audit(state,existing?'document.updated':'document.created',doc.id);return{state,document:clone(doc)};
}
export function convertToInvoice(workspace,quote,uuid=crypto.randomUUID()){
  if(quote.type!=='quote'||!workspace.documents.some(d=>d.id===quote.id))fail('Sla de offerte eerst op.');
  const existing=workspace.documents.find(d=>d.sourceId===quote.id&&d.type==='invoice');if(existing)return clone(existing);
  return{...clone(quote),id:uuid,revision:0,type:'invoice',status:'concept',number:'',date:today(),sourceId:quote.id,reference:quote.number};
}
export function saveSettings(workspace,legal,activity){
  const state=clone(workspace);state.legal=checkedLegal(legal);if(activity){const checked=checkedActivity(activity);state.activities=state.activities.map(a=>a.id===checked.id?checked:a);}return audit(state,'settings.updated');
}
export function saveCustomer(workspace,value,uuid=crypto.randomUUID()){
  const state=clone(workspace),customer={...checkedCustomer(value),id:id(value.id||uuid)};
  if(!customer.name.trim()&&!customer.company.trim())fail('Vul een klantnaam of bedrijfsnaam in.');
  state.customers=[...state.customers.filter(c=>c.id!==customer.id),customer];return audit(state,'customer.saved');
}
export function validateBackup(raw){
  if(raw?.app!=='beck-business'||raw.version!==1||!Number.isSafeInteger(raw.revision)||raw.revision<0)fail('Dit is geen ondersteunde Beck Business-back-up.');
  if(!Array.isArray(raw.activities)||raw.activities.length!==4||new Set(raw.activities.map(a=>a.id)).size!==4)fail('De vier activiteiten ontbreken.');
  if(!Array.isArray(raw.documents)||raw.documents.length>2000||!Array.isArray(raw.customers)||raw.customers.length>2000)fail('Ongeldige of te grote back-up.');
  const result={app:'beck-business',version:1,revision:raw.revision,legal:checkedLegal(raw.legal),activities:raw.activities.map(checkedActivity),customers:raw.customers.map(c=>({...checkedCustomer(c),id:id(c.id)})),documents:raw.documents.map(checkedDocument),audit:[]};
  for(const collection of [result.customers,result.documents])if(new Set(collection.map(x=>x.id)).size!==collection.length)fail('Dubbele kenmerken in back-up.');
  if(new Set(result.documents.map(d=>d.number)).size!==result.documents.length||result.documents.some(d=>!/^TEST-(BITG|BOTR|BEV|ACT4)-(O|F)-\d{4}-\d{4,}$/.test(d.number)))fail('Dubbele of ongeldige testdocumentnummers.');
  return result;
}
export function mergeBackup(workspace,raw){
  const incoming=validateBackup(raw);if(!workspace.documents.length&&!workspace.customers.length)return audit(incoming,'backup.restored');
  const state=clone(workspace);
  for(const key of ['documents','customers'])for(const item of incoming[key]){
    const existing=state[key].find(x=>x.id===item.id);
    if(existing&&JSON.stringify(existing)!==JSON.stringify(item))fail('Conflicterende versie in back-up. Er is niets vervangen.');
    if(!existing){if(key==='documents'&&state.documents.some(d=>d.number===item.number))fail('Dit documentnummer bestaat al. Er is niets vervangen.');state[key].push(item);}
  }
  return audit(state,'backup.merged');
}
export function inspectBotrBackup(raw){
  if(raw?.app!=='beck-documenten'||raw.versie!==1||!raw.documenten||Array.isArray(raw.documenten)||typeof raw.documenten!=='object')fail('Geen geldige BOTR-back-up versie 1.');
  return{count:Object.keys(raw.documenten).length,quotes:Object.values(raw.documenten).filter(d=>d.type==='offerte').length,invoices:Object.values(raw.documenten).filter(d=>d.type==='factuur').length};
}
