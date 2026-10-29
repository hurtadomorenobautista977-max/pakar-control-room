import {build} from 'esbuild';
import assert from 'node:assert/strict';
await build({entryPoints:['functions/team-access/handler.ts'],outfile:'/tmp/pakar-handler.mjs',bundle:true,platform:'node',format:'esm'});
const {makeHandler}=await import('/tmp/pakar-handler.mjs');
function mock(role){let created=0;const admin={auth:{getUser:async()=>({data:{user:{email:'owner@example.com'}},error:null}),admin:{createUser:async()=>{created++;return {data:{user:{id:'new'}},error:null}},deleteUser:async()=>({})}},from(){let selected='';return {select(x){selected=x;return this},eq(){return this},maybeSingle:async()=>({data:selected==='role'?{role}:null,error:null}),insert:async()=>({error:null})}}};return {admin,count:()=>created}}
function request(body,auth=true){return new Request('https://example.com',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{authorization:'Bearer test'}:{})},body:JSON.stringify(body)})}
const body={action:'create',email:'colleague@example.com',password:'test-only-password',role:'editor'};
for(const role of ['editor','viewer',undefined]){const m=mock(role);assert.equal((await makeHandler(m.admin)(request(body))).status,403);assert.equal(m.count(),0)}
const m=mock('owner'),handler=makeHandler(m.admin);
assert.equal((await handler(request(body,false))).status,401);
assert.equal((await handler(request({...body,role:'owner'}))).status,400);
assert.equal((await handler(request({...body,password:'short'}))).status,400);
assert.equal(m.count(),0);
assert.equal((await handler(request(body))).status,200);assert.equal(m.count(),1);
console.log('PASS: missing auth, non-owner, privilege escalation, short password rejected; owner create succeeds');
