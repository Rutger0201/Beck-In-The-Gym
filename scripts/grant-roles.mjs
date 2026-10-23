// Run with the migration-owner connection after creating the two login roles.
import pg from 'pg';
const web=process.env.WEB_DATABASE_ROLE||'bitg_web',admin=process.env.ADMIN_DATABASE_ROLE||'bitg_admin';
if(![web,admin].every(name=>/^[a-z_][a-z0-9_]{0,62}$/.test(name))||web===admin)throw new Error('Use distinct, simple PostgreSQL role names');
const client=new pg.Client({connectionString:process.env.MIGRATION_DATABASE_URL,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:undefined});await client.connect();
try{
  const names=await client.query('SELECT rolname FROM pg_roles WHERE rolname=ANY($1)',[[web,admin]]);
  if(names.rowCount!==2)throw new Error('Create both database login roles before granting permissions');
  await client.query('BEGIN');
  await client.query(`GRANT USAGE ON SCHEMA public TO "${web}", "${admin}"`);
  await client.query(`GRANT EXECUTE ON FUNCTION submit_bitg_contact(uuid,text,text,text,text,text,text,text,text,text) TO "${web}"`);
  await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON auth_user,auth_session,auth_account,auth_verification,auth_two_factor,auth_rate_limit,contact_requests,mail_outbox,rate_limits TO "${admin}"`);
  await client.query(`GRANT SELECT ON activities,legal_entities,memberships TO "${admin}"`);
  await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON marketing_settings,marketing_runs,marketing_research_items,marketing_opportunities,marketing_calendar_items TO "${admin}"`);
  await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON growth_settings,growth_opportunities,growth_notes,growth_drafts,growth_history,growth_source_checks TO "${admin}"`);
  await client.query(`GRANT SELECT,INSERT ON audit_events TO "${admin}"`);
  await client.query('COMMIT');console.log('Separate web/admin permissions granted. The public role has no table access.');
}catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}
