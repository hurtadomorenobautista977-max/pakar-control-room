const headers={'Access-Control-Allow-Origin':'https://hurtadomorenobautista977-max.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
export function makeHandler(admin:any){return async(req:Request)=>{
 const reply=(value:any,status=200)=>new Response(JSON.stringify(value),{status,headers});
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply({error:'روش درخواست معتبر نیست.'},405);
 const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
 if(!token)return reply({error:'ابتدا وارد شوید.'},401);
 try{
 const {data:{user},error:authError}=await admin.auth.getUser(token);
 if(authError||!user?.email)return reply({error:'نشست معتبر نیست؛ دوباره وارد شوید.'},401);
 const {data:member,error:memberError}=await admin.from('workspace_members').select('role').eq('email',user.email.toLowerCase()).maybeSingle();
 if(memberError||member?.role!=='owner')return reply({error:'این کار فقط برای مدیر مجاز است.'},403);
 const body=await req.json();
 if(body.action==='list'){
 const {data,error}=await admin.from('workspace_members').select('email,role').order('created_at');
 if(error)throw error;return reply({members:data});
 }
 const email=String(body.email||'').trim().toLowerCase(),role=body.role;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!['editor','viewer'].includes(role))return reply({error:'ایمیل یا سطح دسترسی معتبر نیست.'},400);
 if(!['create','reset'].includes(body.action))return reply({error:'عملیات معتبر نیست.'},400);
 const password=typeof body.password==='string'?body.password:'';
 if(password.length<10||password.length>128)return reply({error:'رمز باید ۱۰ تا ۱۲۸ نویسه باشد.'},400);
 const {data:existing,error:lookupError}=await admin.from('workspace_members').select('email,role').eq('email',email).maybeSingle();
 if(lookupError)throw lookupError;
 if(body.action==='reset'){
 if(!existing||existing.role==='owner')return reply({error:'فقط رمز همکاران غیرمدیر قابل بازنشانی است.'},403);
 let target=null;
 for(let page=1;page<=100;page++){const {data,error}=await admin.auth.admin.listUsers({page,perPage:100});if(error)throw error;target=data.users.find((u:any)=>u.email?.toLowerCase()===email);if(target||data.users.length<100)break;}
 if(!target)return reply({error:'حساب پیدا نشد.'},404);
 const {error}=await admin.auth.admin.updateUserById(target.id,{password});if(error)throw error;
 return reply({ok:true});
 }
 if(existing)return reply({error:'این ایمیل از قبل عضو است؛ از حساب موجود استفاده کنید.'},409);
 const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true});
 if(createError)return reply({error:createError.code==='email_exists'?'برای این ایمیل قبلاً حساب ساخته شده است. حساب موجود باید توسط مدیر بررسی شود.':'ساخت حساب انجام نشد؛ ایمیل تکراری یا رمز نامعتبر را بررسی کنید.'},400);
 const {error:insertError}=await admin.from('workspace_members').insert({email,role});
 if(insertError){await admin.auth.admin.deleteUser(created.user.id);throw insertError;}
 return reply({ok:true});
 }catch{return reply({error:'عملیات انجام نشد؛ دوباره تلاش کنید.'},500)}
};}
