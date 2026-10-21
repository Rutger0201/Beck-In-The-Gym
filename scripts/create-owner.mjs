import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { hashPassword } from 'better-auth/crypto';
import pg from 'pg';
if(!process.stdin.isTTY)throw new Error('Run interactively in a terminal. Passwords must not be passed as arguments.');
const prompt=createInterface({input:process.stdin,output:process.stdout});
const email=(await prompt.question('Owner email: ')).trim().toLowerCase();
const name=(await prompt.question('Display name: ')).trim();prompt.close();
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name)throw new Error('Provide a valid email and name');
process.stdout.write('Password (14–128 characters, input hidden): ');
const password=await new Promise((resolve,reject)=>{
  let value='';process.stdin.setRawMode(true);process.stdin.resume();
  const listener=chunk=>{for(const char of chunk.toString()){if(char==='\u0003'){finish();reject(new Error('Cancelled'));return;}if(char==='\r'||char==='\n'){finish();resolve(value);return;}if(char==='\u007f'){value=value.slice(0,-1);}else if(char>=' '){value+=char;}}};
  const finish=()=>{process.stdin.setRawMode(false);process.stdin.pause();process.stdin.off('data',listener);process.stdout.write('\n');};process.stdin.on('data',listener);
});
if(password.length<14||password.length>128)throw new Error('Password must contain 14–128 characters');
const connectionString=process.env.MIGRATION_DATABASE_URL;if(!connectionString)throw new Error('Set MIGRATION_DATABASE_URL');
const client=new pg.Client({connectionString,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:undefined});await client.connect();
try{
  await client.query('BEGIN');
  const id=randomUUID();
  await client.query('INSERT INTO auth_user(id,name,email,email_verified) VALUES($1,$2,$3,true)',[id,name,email]);
  await client.query('INSERT INTO auth_account(id,account_id,provider_id,user_id,password) VALUES($1,$2,\'credential\',$2,$3)',[randomUUID(),id,await hashPassword(password)]);
  await client.query('INSERT INTO memberships(user_id,activity_id,role) VALUES($1,\'bitg\',\'owner\')',[id]);
  await client.query('COMMIT');console.log('Owner created. Log in and complete authenticator setup before accessing requests.');
}catch(error){await client.query('ROLLBACK');throw new Error('Owner creation failed; no existing account was changed.');}finally{await client.end();}
