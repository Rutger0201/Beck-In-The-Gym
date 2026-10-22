import test from 'node:test';
import assert from 'node:assert/strict';
import {initialWorkspace,newDocument,totals,eventHours,saveDocument,saveSettings,convertToInvoice,mergeBackup,validateBackup,inspectBotrBackup} from '../packages/core/src/documents.mjs';
const ready=()=>{const s=initialWorkspace();s.legal.vatMode='standard';return s;};
const filled=(s,id='bitg')=>{const d=newDocument(s,id);d.customer.name='Testklant';d.lines[0].price='10.25';return d;};
test('exact line math, discounts and mixed VAT round consistently',()=>{
 const result=totals([{description:'A',quantity:'1.5',price:'19,99',discount:'10',vat:21},{description:'B',quantity:'3',price:'0.10',discount:'0',vat:9}]);
 assert.equal(result.netCents,2729);assert.equal(result.taxCents,570);assert.equal(result.totalCents,3299);
 assert.equal(totals([{description:'small',quantity:'1',price:'0.05',discount:'0',vat:21}]).taxCents,1);
 for(const invalid of ['-1','1e2','Infinity','1.0001'])assert.throws(()=>totals([{description:'bad',quantity:invalid,price:'1',vat:21}]));
});
test('VAT requires an explicit entity-level choice; KOR applies across activities',()=>{
 const s=initialWorkspace();assert.throws(()=>saveDocument(s,filled(s)),/btw/);
 const kor=saveSettings(s,{...s.legal,vatMode:'kor'});for(const a of kor.activities)assert.equal(saveDocument(kor,filled(kor,a.id)).document.totals.taxCents,0);
});
test('four activities share one engine but keep documents and test numbering separate',()=>{
 let s=ready();for(const id of ['bitg','botr','security','fourth'])s=saveDocument(s,filled(s,id)).state;
 assert.equal(s.documents.length,4);assert.equal(new Set(s.documents.map(d=>d.number)).size,4);assert.ok(s.documents.every(d=>d.number.startsWith('TEST-')));
});
test('saved document snapshots do not change when company settings and tariffs change',()=>{
 const r=saveDocument(ready(),filled(ready()));const old=structuredClone(r.document);const a={...r.state.activities[0],name:'Andere merknaam',services:[{description:'Nieuw',price:'999',vat:9}]};
 const changed=saveSettings(r.state,{...r.state.legal,name:'Nieuwe juridische naam'},a);assert.deepEqual(changed.documents[0],old);
});
test('quotation conversion preserves amounts, references source and avoids duplicate saved conversion',()=>{
 const saved=saveDocument(ready(),filled(ready()));const invoice=convertToInvoice(saved.state,saved.document);assert.equal(invoice.reference,saved.document.number);assert.equal(invoice.type,'invoice');assert.deepEqual(invoice.lines,saved.document.lines);
 const issued=saveDocument(saved.state,invoice);assert.equal(convertToInvoice(issued.state,saved.document).id,invoice.id);assert.equal(issued.document.totals.totalCents,saved.document.totals.totalCents);
});
test('stale revisions cannot overwrite a newer document and numbers cannot be edited',()=>{
 const saved=saveDocument(ready(),filled(ready()));const updated=saveDocument(saved.state,{...saved.document,notes:'Updated'});assert.throws(()=>saveDocument(updated.state,saved.document),/ander venster/);
 assert.throws(()=>saveDocument(saved.state,{...saved.document,number:'changed'}),/nummer/);
});
test('backup merge is atomic, idempotent and rejects conflicting document ids or numbers',()=>{
 const saved=saveDocument(ready(),filled(ready()));const backup=JSON.parse(JSON.stringify(saved.state));assert.equal(mergeBackup(saved.state,backup).documents.length,1);
 const conflict=structuredClone(backup);conflict.documents[0].notes='Conflicting';assert.throws(()=>mergeBackup(saved.state,conflict),/Conflicterende/);assert.equal(saved.state.documents[0].notes,'');
 assert.throws(()=>validateBackup({...backup,documents:[...backup.documents,...backup.documents]}));
});
test('bartending time crosses midnight and old BOTR inventory never mutates a backup',()=>{
 assert.equal(eventHours('20:00','00:00'),'4');assert.throws(()=>eventHours('20:00','20:00'));assert.throws(()=>eventHours('25:00','00:00'));
 const raw={app:'beck-documenten',versie:1,documenten:{O1:{type:'offerte'},F1:{type:'factuur'}}};const before=JSON.stringify(raw);assert.deepEqual(inspectBotrBackup(raw),{count:2,quotes:1,invoices:1});assert.equal(JSON.stringify(raw),before);
});
