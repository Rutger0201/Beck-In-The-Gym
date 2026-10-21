import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
const configured=Boolean(process.env.MIGRATION_DATABASE_URL&&process.env.DATABASE_URL);
test("restricted contact submission is atomic, rate-limited and idempotent",{skip:!configured},async()=>{
  const admin=new pg.Client({connectionString:process.env.MIGRATION_DATABASE_URL}),web=new pg.Client({connectionString:process.env.DATABASE_URL});await admin.connect();await web.connect();
  const id=randomUUID(),key=randomUUID().replace(/-/g,"").repeat(2);
  const submit=()=>web.query("SELECT submit_bitg_contact($1,'Test person','test@example.test','','strength','','','','nl',$2) accepted",[id,key]);
  try{
    assert.equal((await submit()).rows[0].accepted,true);assert.equal((await submit()).rows[0].accepted,true);
    assert.equal(Number((await admin.query("SELECT count(*) FROM contact_requests WHERE id=$1",[id])).rows[0].count),1);
    assert.equal(Number((await admin.query("SELECT count(*) FROM mail_outbox WHERE contact_id=$1",[id])).rows[0].count),2);
    await assert.rejects(()=>web.query("SELECT * FROM contact_requests"));
    await assert.rejects(()=>web.query("UPDATE contact_requests SET status='closed' WHERE id=$1",[id]));
    await submit();await submit();await submit();assert.equal((await submit()).rows[0].accepted,false);
  }finally{await admin.query("DELETE FROM contact_requests WHERE id=$1",[id]);await admin.query("DELETE FROM rate_limits WHERE key=$1",[key]);await web.end();await admin.end();}
});
