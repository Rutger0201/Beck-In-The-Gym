const url=process.env.ADMIN_URL,secret=process.env.JOBS_SECRET;
if(!url||!secret||secret.length<32)throw new Error('Configure ADMIN_URL and JOBS_SECRET');
const response=await fetch(new URL('/api/internal/jobs',url),{method:'POST',headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(120000)});
if(!response.ok)throw new Error(`Job failed (${response.status})`);
const {sent,failed,removed}=await response.json();console.log(JSON.stringify({sent,failed,removed}));
if(failed)process.exitCode=1;
