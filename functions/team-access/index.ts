import {createClient} from 'npm:@supabase/supabase-js@2.109.0';
import {makeHandler} from './handler.ts';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
// JWT is validated against Auth before any privileged operation; role is checked in the database.
Deno.serve(makeHandler(admin));
