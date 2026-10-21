const problems=[];
const required=['SITE_URL','ADMIN_URL','CONTACT_EMAIL','PRIVACY_CONTACT_EMAIL','LEGAL_NAME','LEGAL_ADDRESS','LEGAL_KVK','DATABASE_URL','ADMIN_DATABASE_URL','BETTER_AUTH_SECRET','RATE_LIMIT_SECRET','JOBS_SECRET','BREVO_API_KEY','MAIL_FROM','CONTACT_RECIPIENT_EMAIL'];
for(const name of required)if(!process.env[name])problems.push(`Missing ${name}`);
for(const name of ['SITE_URL','ADMIN_URL']){try{const url=new URL(process.env[name]);if(url.protocol!=='https:'||url.hostname==='localhost'||url.hostname.endsWith('.invalid')||url.hostname.includes('example.'))throw new Error();}catch{problems.push(`${name} must be a real HTTPS origin`);}}
if(process.env.SITE_URL===process.env.ADMIN_URL)problems.push('Use separate public/admin origins');
for(const name of ['BETTER_AUTH_SECRET','RATE_LIMIT_SECRET','JOBS_SECRET'])if((process.env[name]||'').length<32)problems.push(`${name} needs at least 32 random characters`);
if(process.env.DATABASE_URL===process.env.ADMIN_DATABASE_URL)problems.push('Use separate database roles');
if(process.env.PUBLICATION_APPROVED!=='true')problems.push('Publication approval has not been recorded');
if(process.env.BUSINESS_DETAILS_APPROVED!=='true')problems.push('Business details have not been approved');
if(process.env.GOATCOUNTER_CODE&&process.env.ANALYTICS_APPROVED!=='true')problems.push('Analytics configuration requires privacy approval');
if(problems.length){console.error(problems.map(value=>`- ${value}`).join('\n'));process.exitCode=1;}else console.log('Release configuration complete. This does not replace owner approval or operational/security checks.');
