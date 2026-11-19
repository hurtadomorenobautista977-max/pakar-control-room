import VisitMonitor from './visit-monitor';
import {EditorialCharts,SmsCharts,sheetDate,blogProduced,isPublished} from './monitor-charts';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpLeft,RefreshCw} from 'lucide-react';
import {supabase} from './client';

type Cell=string|number|null;
type Feed={source:string;successful_at:string|null;attempted_at:string;failed:boolean;
  payload:{title:string;url:string;columns:string[];rows:Cell[][]}|null};
const groups=[
  {id:'visit',label:'ویزیت',keys:['cpl-visits','visit-monitor']},
  {id:'daily',label:'لاین‌های ثابت',keys:['content','blog','sms','banks','visits']},
  {id:'okr',label:'Q3',keys:['cpl-q3','okr']},
  {id:'projects',label:'پروژه‌ها',keys:['rice','roadmap']},
  {id:'finance',label:'مالی',keys:['requests','settlements']}
];
const titles:Record<string,string>={
  'cpl-visits':'تماس‌های ثبت‌شده در CPL','visit-monitor':'پایش شیت و بانک‌ها','cpl-q3':'عملکرد فصل از خروجی پاکار',content:'تقویم محتوا',blog:'تقویم بلاگ',sms:'پیامک',banks:'بانک ویزیت',visits:'ویزیت روزانه',
  okr:'نتایج کلیدی',rice:'اولویت پروژه‌ها',roadmap:'نقشه راه',requests:'درخواست‌های واریزی',settlements:'تسویه فرصت‌ها'
};
const notices:Record<string,string>={
  sms:'ورودی UTM به معنی کلیک یکتا نیست. هزینه هر ورودی فقط برای مبالغی محاسبه شده که واحد ریال صریح دارند.',
  banks:'پوشش تماس تنها برای ردیف‌های دارای تعداد تماس معتبر محاسبه می‌شود.',
  visits:'این جدول بر اساس ثبت روزانه قربانی است. جمع تیم در شیت منبع خطای فرمول دارد.',
  okr:'پیشرفت هر سنجه با مقدار معتبر محاسبه شده است. عدد میانگین کل شیت به دلیل خطای فرمول نمایش داده نمی‌شود.',
  roadmap:'برای نمایش این دوره، تاریخ‌های نقشه راه از ۱۴۰۳ به ۱۴۰۵ نگاشت شده‌اند.',
  requests:'وضعیت پرداخت از تیک شیت گرفته شده است. جمع مبالغ فقط شامل درخواست‌های دارای عنوان و مبلغ معتبر است.',
  settlements:'مبالغ به تومان‌اند. اختلاف تیک و متن وضعیت با برچسب مغایرت نمایش داده می‌شود.'
};
const fmt=(n:number)=>n.toLocaleString('fa-IR',{maximumFractionDigits:2});
const stamp=(s:string)=>new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tehran'}).format(new Date(s));
const pageSize=15;

function numbers(source:string,rows:Cell[][]):[string,string][] {
  const count=(i:number,value:string)=>rows.filter(row=>row[i]===value).length;
  const sum=(i:number,selected=rows)=>selected.reduce((total,row)=>total+(typeof row[i]==='number'?row[i]:0),0);
  const sumKnown=(i:number,selected=rows)=>selected.some(row=>typeof row[i]==='number')?fmt(sum(i,selected)):'—';
  if(source==='content') return [['تولیدشده',fmt(count(5,'انجام شده'))],['منتشرشده',fmt(count(6,'انجام شده'))],
    ['تولیدشده در انتظار انتشار',fmt(rows.filter(r=>r[5]==='انجام شده'&&r[6]==='در انتظار').length)]];
  if(source==='blog') return [['تولیدشده',fmt(rows.filter(r=>blogProduced(r[1])).length)],
    ['منتشرشده',fmt(rows.filter(r=>isPublished(r[1])).length)],
    ['تولیدشده در انتظار انتشار',fmt(rows.filter(r=>blogProduced(r[1])&&!isPublished(r[1])).length)]];
  if(source==='sms') {
    const sent=rows.filter(r=>r[3]==='انجام شده');
    return [['کمپین ارسال‌شده',fmt(sent.length)],['تعداد ارسال ثبت‌شده',sumKnown(4,sent)],['ورودی UTM ثبت‌شده',sumKnown(5,sent)]];
  }
  if(source==='visits') return [['تماس ثبت‌شده',sumKnown(1)],['ویزیت جدید ثبت‌شده',sumKnown(2)],['پیگیری منجر به فرصت',sumKnown(5)]];
  if(source==='requests') {
    const pending=rows.filter(r=>r[3]==='در انتظار');
    return [['مبلغ ثبت‌شده (تومان)',sumKnown(1)],['در انتظار پرداخت (تومان)',sumKnown(1,pending)],
      ['فوری در انتظار',fmt(pending.filter(r=>r[2]==='فوری').length)]];
  }
  if(source==='settlements') return [['تسویه‌شده',fmt(count(3,'تسویه‌شده'))],
    ['مبلغ تسویه‌شده (تومان)',sumKnown(1,rows.filter(r=>r[3]==='تسویه‌شده'))],['مغایرت',fmt(count(3,'مغایرت وضعیت'))]];
  return [];
}

export default function SheetMonitor(){
  const [feeds,setFeeds]=useState<Feed[]>([]),[owner,setOwner]=useState(false);
  const [source,setSource]=useState('content'),[query,setQuery]=useState(''),[page,setPage]=useState(0);
  const [loading,setLoading]=useState(true),[updating,setUpdating]=useState(false),[message,setMessage]=useState('');
  const refreshing=useRef(false);
  const [from,setFrom]=useState(''),[to,setTo]=useState('');
  async function read(){
    const {data,error}=await supabase.from('sheet_monitor_latest').select('source,successful_at,attempted_at,failed,payload');
    if(error) throw error;
    setFeeds((data??[]) as Feed[]);
  }
  useEffect(()=>{
    void (async()=>{
      try {
        const [{data:member}]=await Promise.all([supabase.from('workspace_members').select('role').maybeSingle(),read()]);
        setOwner(member?.role==='owner');
      } catch {setMessage('خواندن اطلاعات پایش ممکن نشد.');}
      finally {setLoading(false);}
    })();
    const reload=()=>{if(document.visibilityState==='visible') void read().catch(()=>{});};
    const timer=window.setInterval(reload,60_000);
    window.addEventListener('focus',reload);
    return ()=>{window.clearInterval(timer);window.removeEventListener('focus',reload);};
  },[]);
  async function update(){
    if(refreshing.current)return;
    refreshing.current=true;
    setUpdating(true);
    setMessage('');
    try{
      const {data,error}=await supabase.functions.invoke('sheet-monitor',{body:{}});
      if(error)throw error;
      await read();
      setMessage(data.status==='partial'?'بعضی تب‌ها به‌روز نشدند. وضعیت هر تب را بررسی کنید.'
        :data.status==='already_requested'?'به‌روزرسانی به‌تازگی درخواست شده است. تا یک دقیقه دیگر دوباره بررسی کنید.':'داده‌ها به‌روز شدند.');
    }catch{setMessage('دریافت تازه انجام نشد. آخرین داده معتبر همچنان قابل مشاهده است.');}
    finally{refreshing.current=false;setUpdating(false);}
  }
  function select(key:string){setSource(key);setQuery('');setPage(0);setFrom('');setTo('');}
  const group=groups.find(g=>g.keys.includes(source))??groups[0];
  const feed=feeds.find(f=>f.source===source), payload=feed?.payload;
  const analytical=['content','blog','sms'].includes(source);
  const lower=sheetDate(from),upper=sheetDate(to);
  const invalidRange=(Boolean(from)&&lower===null)||(Boolean(to)&&upper===null)||(lower!==null&&upper!==null&&lower>upper);
  const allRows=payload?.rows??[];
  const dateIndex=source==='sms'?2:0;
  const dateFiltered=analytical&&(lower!==null||upper!==null)&&!invalidRange;
  const datedRows=dateFiltered?allRows.filter(row=>{
    const d=sheetDate(row[dateIndex]);
    return d!==null&&(lower===null||d>=lower)&&(upper===null||d<=upper);
  }):allRows;
  const skipped=dateFiltered?allRows.filter(r=>sheetDate(r[dateIndex])===null).length:0;
  const rows=datedRows.filter(row=>row.join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const maxPage=Math.max(0,Math.ceil(rows.length/pageSize)-1),currentPage=Math.min(page,maxPage);
  return <section className="panel sheet-monitor" aria-label="پایش شیت‌ها">
    <div className="panel-heading">
      <div><h2>پایش شیت‌ها</h2><p>شیت‌ها به‌صورت ساعتی و گزارش‌های CPL با دریافت خروجی تازه به‌روز می‌شوند.</p></div>
      {owner&&<button className="secondary" onClick={update} disabled={updating}>
        <RefreshCw size={15} className={updating?'spin':undefined}/>{updating?'در حال دریافت':'به‌روزرسانی'}
      </button>}
    </div>
    <div className="filter-row monitor-tabs">{groups.filter(g=>g.id!=='finance'||owner).map(g=><button key={g.id} className={group.id===g.id?'active':''} onClick={()=>select(g.keys[0])}>{g.label}</button>)}</div>
    {group.keys.length>1&&<div className="filter-row monitor-tabs monitor-sources">{group.keys.map(k=><button key={k} className={k===source?'active':''} onClick={()=>select(k)}>{titles[k]}{feeds.find(f=>f.source===k)?.failed?' ⚠':''}</button>)}</div>}
    <div className="monitor-body">
      {message&&<p role="status" className="monitor-message">{message}</p>}
      <div className="monitor-meta">
        <span>{feed?.successful_at?'آخرین دریافت موفق · '+stamp(feed.successful_at):'آخرین دریافت موفق ثبت نشده است'}</span>
        {payload?.url&&<a className="text-button" target="_blank" rel="noreferrer" href={payload.url}>باز کردن تب منبع <ArrowUpLeft size={14}/></a>}
      </div>
      {feed?.failed&&<p role="status" className="monitor-message">دریافت اخیر این تب در {stamp(feed.attempted_at)} ناموفق بود.{payload?' داده آخرین دریافت موفق نمایش داده شده است.':''}</p>}
      {notices[source]&&<p className="monitor-notice">{notices[source]}</p>}
      {source==='visit-monitor'?<VisitMonitor feeds={feeds}/>:payload ? <>
        {analytical&&<div className="analysis-dates">
          <label>از تاریخ <input placeholder="۱۴۰۵/۰۸/۰۱" value={from} onChange={e=>{setFrom(e.target.value);setPage(0);}} /></label>
          <label>تا تاریخ <input placeholder="۱۴۰۵/۰۸/۳۰" value={to} onChange={e=>{setTo(e.target.value);setPage(0);}} /></label>
          {(from||to)&&<button className="secondary" onClick={()=>{setFrom('');setTo('');setPage(0);}}>پاک کردن بازه</button>}
          {invalidRange&&<small role="status">بازه معتبر نیست. تاریخ را مانند ۱۴۰۵/۰۸/۰۱ وارد کنید.</small>}
          {skipped>0&&<small>{fmt(skipped)} ردیف فاقد تاریخ قابل تشخیص از بازه کنار گذاشته شد.</small>}
        </div>}
        <div className="monitor-stats">{[['تعداد ردیف‌های قابل نمایش',fmt(datedRows.length)],...numbers(source,datedRows)].map(([key,value])=><div key={key}><span>{key}</span><strong>{value}</strong></div>)}</div>
        {(source==='content'||source==='blog')&&<EditorialCharts key={source} source={source} rows={datedRows}/>}
        {source==='sms'&&<SmsCharts rows={datedRows}/>}
        {analytical&&<details className="monitor-details"><summary>جزئیات ردیف‌های شیت</summary></details>}
        <div className={analytical?'monitor-raw':'monitor-raw open'}>
        <input className="monitor-search" aria-label="جستجو در تب" placeholder="جستجو در همین جدول…" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/>
        <div className="monitor-table" tabIndex={0} aria-label={payload.title}><table>
          <thead><tr>{payload.columns.map(c=><th key={c} scope="col">{c}</th>)}</tr></thead>
          <tbody>{rows.slice(currentPage*pageSize,(currentPage+1)*pageSize).map((row,i)=><tr key={currentPage*pageSize+i}>
            {row.map((cell,j)=><td key={j}>{typeof cell==='number'?fmt(cell):cell||'—'}</td>)}
          </tr>)}</tbody>
        </table></div>
        {rows.length===0&&<p className="monitor-notice">ردیفی برای نمایش وجود ندارد.</p>}
        {maxPage>0&&<div className="monitor-pages"><button className="secondary" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>قبلی</button><span>{fmt(currentPage+1)} از {fmt(maxPage+1)}</span><button className="secondary" disabled={currentPage===maxPage} onClick={()=>setPage(currentPage+1)}>بعدی</button></div>}
        </div>
      </> : <div className="loading">{loading?'در حال دریافت اطلاعات…':'داده‌ای برای نمایش در این تب موجود نیست.'}</div>}
    </div>
  </section>;
}
