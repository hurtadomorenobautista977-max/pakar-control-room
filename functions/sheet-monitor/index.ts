import {createClient} from 'npm:@supabase/supabase-js@2.109.0';
import {readSource,sources} from './sources.ts';

const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {auth:{persistSession:false,autoRefreshToken:false}});
const headers={
  'Access-Control-Allow-Origin':'https://hurtadomorenobautista977-max.github.io',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
  'Cache-Control':'no-store',
  'Vary':'Origin'
};

Deno.serve(async (request: Request) => {
  const reply=(body: unknown,status=200)=>Response.json(body,{status,headers});
  if (request.method==='OPTIONS') return new Response(null,{status:204,headers});
  if (request.method!=='POST') return reply({error:'method'},405);
  const scheduler=request.headers.get('x-monitor-scheduler');
  try {
    if (scheduler) {
      const {data,error}=await admin.rpc('pakar_monitor_scheduler_matches',{token:scheduler});
      if (error || !data) return reply({error:'unauthorized'},401);
    } else {
      const jwt=request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
      if (!jwt) return reply({error:'unauthorized'},401);
      const {data:{user},error}=await admin.auth.getUser(jwt);
      if (error || !user?.email) return reply({error:'unauthorized'},401);
      const {data:member}=await admin.from('workspace_members').select('role').eq('email',user.email.toLowerCase()).maybeSingle();
      if (member?.role!=='owner') return reply({error:'forbidden'},403);
    }
    const {data:claimed,error:claimError}=await admin.rpc('pakar_monitor_claim');
    if (claimError) throw claimError;
    if (!claimed) return reply({status:'already_requested'});
    const results=Object.fromEntries(await Promise.all(Object.entries(sources).map(async ([key,source])=>{
      try {return [key,await readSource(source)];}
      catch (error) {console.warn('Sheet sync failed',key,String(error));return [key,null];}
    })));
    const {error}=await admin.rpc('pakar_monitor_store',{results});
    if (error) throw error;
    const failed=Object.entries(results).filter(([,value])=>value===null).map(([key])=>key);
    return reply({status:failed.length?'partial':'complete',failed});
  } catch (error) {
    console.error('Sheet sync failed',String(error));
    return reply({error:'sync_failed'},500);
  }
});
