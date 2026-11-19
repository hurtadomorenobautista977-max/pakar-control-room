import {useEffect,useState} from 'react';
import {ChevronLeft,PhoneCall,Target} from 'lucide-react';
import {supabase} from './client';
import {ReportPanels} from './report-panels';

type Feed={source:string;successful_at:string;payload:{rows:(string|number|null)[][]}|null};
export function Overview({open}:{open:(source:string)=>void}){
  const [feeds,setFeeds]=useState<Feed[]>([]);
  const [message,setMessage]=useState('در حال دریافت گزارش‌ها…');
  useEffect(()=>{
    let active=true;
    async function read(){
      const {data,error}=await supabase.from('sheet_monitor_latest')
        .select('source,successful_at,payload').in('source',['cpl-q3','cpl-visits']);
      if(!active)return;
      if(error){setMessage('دریافت گزارش‌ها ممکن نشد.');return;}
      setFeeds(data??[]);setMessage('');
    }
    void read();
    window.addEventListener('focus',read);
    return ()=>{active=false;window.removeEventListener('focus',read)};
  },[]);
  return <section className="overview-reports" aria-label="عملکرد پاکار">
    {message&&<p role="status">{message}</p>}
    {['cpl-q3','cpl-visits'].map(source=>{
      const feed=feeds.find(item=>item.source===source);
      if(!feed?.payload)return null;
      const q3=source==='cpl-q3';
      const rows=q3?feed.payload.rows.filter(r=>['KR 1.1','KR 2.3','KR 2.5','KR 2.6'].includes(String(r[0]))):feed.payload.rows;
      return <section key={source}><header><div><h2>{q3?<Target size={19}/>:<PhoneCall size={19}/>}
        {q3?'شاخص‌های فصل سوم':'تماس‌های ویزیت'}</h2>
        <small>آخرین دریافت · {new Date(feed.successful_at).toLocaleDateString('fa-IR',{timeZone:'Asia/Tehran'})}</small></div>
        <button className="text-button" onClick={()=>open(source)}>گزارش کامل <ChevronLeft size={15}/></button></header>
        <ReportPanels source={source} rows={rows}/></section>;
    })}
  </section>
}
