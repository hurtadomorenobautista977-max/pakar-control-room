import {createClient} from '@supabase/supabase-js';
export const supabase=createClient('https://ihcpohnoduvwxdpnjcze.supabase.co','sb_publishable_q9q6ndf-Jkz3dRbvzkeMZQ_Nq9qXBDj',{
 auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'pakar-auth-v1'},
 global:{fetch:(input,init)=>fetch(input,{...init,signal:init?.signal||AbortSignal.timeout(20000)})}
});
const payloadFields=['kind','title','domain','priority','status','owner','due','summary','decision','action','reference','tags','pinned'];
export async function recordRequest(_url:string,options:any={}){
 try{
 const v=options.body?JSON.parse(options.body):null;
 if(options.method==='POST'){
 const p:any={};for(const k of payloadFields)p[k]=v[k];
 let query:any;
 if(v.id){if(!v.updatedAt)throw Error('نسخه یادداشت مشخص نیست؛ فهرست را تازه کنید.');query=supabase.from('records').update(p).eq('id',v.id).is('deletedAt',null);if(v.updatedAt)query=query.eq('updatedAt',v.updatedAt);}
 else query=supabase.from('records').insert(p);
 const {data,error}=await query.select('id').maybeSingle();if(error)throw error;if(!data)throw Error('این یادداشت در جای دیگری تغییر کرده است. فهرست را تازه کنید و دوباره ویرایش کنید.');
 return {ok:true,json:async()=>({ok:true})};
 }
 if(options.method==='DELETE'){
 if(!v.updatedAt)throw Error('نسخه یادداشت مشخص نیست؛ فهرست را تازه کنید.');
 let q=supabase.from('records').update({deletedAt:new Date().toISOString()}).eq('id',v.id).is('deletedAt',null);if(v.updatedAt)q=q.eq('updatedAt',v.updatedAt);
 const {data,error}=await q.select('id').maybeSingle();if(error)throw error;if(!data)throw Error('یادداشت تغییر کرده یا قبلاً حذف شده است. فهرست را تازه کنید.');return {ok:true,json:async()=>({ok:true})};
 }
 const items:any[]=[];for(let start=0;;start+=1000){const {data,error}=await supabase.from('records').select('*').is('deletedAt',null).order('updatedAt',{ascending:false}).order('id').range(start,start+999);if(error)throw error;items.push(...data);if(data.length<1000)break;}return {ok:true,json:async()=>items};
 }catch(e:any){let message=e.message||'ارتباط با پایگاه داده برقرار نشد.';
 if(e.code==='42501')message='حساب شما اجازه انجام این تغییر را ندارد.';
 if(e.name==='AbortError'||e.name==='TimeoutError'||message.includes('Failed to fetch'))message='ارتباط با پایگاه داده برقرار نشد. اینترنت را بررسی و دوباره تلاش کنید.';
 return {ok:false,json:async()=>({error:message})};}
}
