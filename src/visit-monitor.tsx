import {useMemo,useState} from 'react';
import {parseCsv} from '../functions/sheet-monitor/sources';
import {sheetDate} from './monitor-charts';

type Cell=string|number|null;
type Feed={source:string;payload:{rows:Cell[][]}|null};
type Row=Record<string,string>;
type Kind='calls'|'members'|'opportunities';
const norm=(s:string)=>s.replace(/^\uFEFF/,'').replace(/[۰-۹٠-٩]/g,c=>String(c.charCodeAt(0)&15)).replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[‌\s]+/g,' ').trim();
const fmt=(n:number)=>n.toLocaleString('fa-IR');
const get=(row:Row,...keys:string[])=>keys.map(k=>row[k]).find(Boolean)??'';
const member=(r:Row)=>{
  const id=get(r,'شناسه عضو','شناسه کاربر','member_id');
  if(id)return id;
  const phone=get(r,'شماره موبایل','شماره تماس','موبایل','کاربر').match(/(?:\+98|0098|0)?9\d{9}\b/)?.[0];
  return phone?phone.slice(-10):'';
};
const bank=(r:Row)=>get(r,'بانک','نام بانک','bank');
const outcome=(r:Row)=>get(r,'نتیجه ارتباط','نتیجه تماس');
const next=(r:Row)=>get(r,'اقدام بعدی');
const operator=(r:Row)=>get(r,'اپراتور')||'نامشخص';
const date=(r:Row)=>get(r,'تاریخ تماس','تاریخ');
const topic=(r:Row)=>get(r,'موضوع ارتباط','موضوع');
const visit=(r:Row)=>/(^|[\s،|:])ویزیت($|[\s،|:])/.test(topic(r));
const outcomes=['تماس موفق','تماس ناموفق','اشغال','شماره اشتباه'];
const required:Record<Kind,string[][]>={
  calls:[['کد','شناسه تماس'],['تاریخ تماس','تاریخ'],['موضوع ارتباط','موضوع'],['نوع ارتباط'],['نتیجه ارتباط','نتیجه تماس']],
  members:[['بانک','نام بانک','bank'],['شناسه عضو','شناسه کاربر','member_id','شماره موبایل','شماره تماس','موبایل','کاربر']],
  opportunities:[['بانک','نام بانک','bank'],['شناسه فرصت','کد فرصت','opportunity_id'],['وضعیت','وضعیت فرصت']]
};
const samples:Record<Kind,string[]>={
  calls:['کد','تاریخ تماس','نوع ارتباط','موضوع ارتباط','نتیجه ارتباط','اپراتور','اقدام بعدی','شناسه عضو','بانک','مرحله پیگیری'],
  members:['بانک','شناسه عضو'],
  opportunities:['شناسه فرصت','بانک','وضعیت','شناسه عضو']
};
function unique(rows:Row[],id:(row:Row)=>string){
  const seen=new Set<string>();return rows.filter(r=>{const k=id(r);if(!k||seen.has(k))return false;seen.add(k);return true;});
}
function parse(input:string,kind:Kind){
  const first=input.split(/\r?\n/,1)[0];
  const data=first.includes('\t')?input.trim().split(/\r?\n/).map(r=>r.split('\t')):parseCsv(input);
  const [header,...rows]=data;
  const keys=(header??[]).map(norm);
  if(required[kind].some(aliases=>!aliases.some(k=>keys.includes(k))))throw Error('ستون‌های لازم در فایل پیدا نشد. قالب همین بخش را ببینید.');
  return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(keys.map((k,i)=>[k,norm(r[i]??'')])));
}

function Counts({values}:{values:[string,number|string][]}){
  return <div className="monitor-stats">{values.map(([label,n])=><div key={label}><span>{label}</span><strong>{typeof n==='number'?fmt(n):n}</strong></div>)}</div>;
}
function Bars({values}:{values:[string,number][]}){
  const max=Math.max(1,...values.map(([,n])=>n));
  return <ul className="category-list">{values.map(([label,n])=><li key={label}><div className="category-item"><span>{label}</span><b>{fmt(n)}</b><span className="bar-track"><i style={{width:100*n/max+'%',background:'#008862'}}/></span></div></li>)}</ul>;
}
function breakdown(rows:Row[],label:(r:Row)=>string):[string,number][]{
  const counts=new Map<string,number>();
  for(const r of rows){const k=label(r)||'نامشخص';counts.set(k,(counts.get(k)??0)+1);}
  return [...counts].sort((a,b)=>b[1]-a[1]);
}
const dateLabel=(n:number)=>String(n).replace(/^(\d{4})(\d\d)(\d\d)$/,'$1/$2/$3');
function order(row:Row){
  const time=date(row).match(/\b(\d{1,2}):(\d{2})\b/);
  return (sheetDate(date(row))??0)*10000+(time?Number(time[1])*100+Number(time[2]):0);
}
const state=(r:Row)=>next(r)==='توقف تماس'?'توقف تماس':next(r)==='تمام شده'?'تمام شده':'در فرایند';
const matchDate=(r:Row,from:number|null,to:number|null)=>{
  const d=sheetDate(date(r));return !from&&!to||d!==null&&(!from||d>=from)&&(!to||d<=to);
};

export default function VisitMonitor({feeds}:{feeds:Feed[]}){
  const [data,setData]=useState<Partial<Record<Kind,Row[]>>>({});
  const [notice,setNotice]=useState('');
  const [view,setView]=useState('day'),[from,setFrom]=useState(''),[to,setTo]=useState('');
  const [staff,setStaff]=useState(''),[selectedBank,setBank]=useState('');
  const lower=sheetDate(from),upper=sheetDate(to);
  const hasRangeError=Boolean((from&&!lower)||(to&&!upper)||(lower&&upper&&lower>upper));
  async function importFile(kind:Kind,file?:File){
    if(!file)return;
    try{
      if(file.size>20*1024*1024)throw Error('حجم فایل باید کمتر از ۲۰ مگابایت باشد.');
      const text=await file.text();
      const rows=parse(text,kind);
      setData(previous=>({...previous,[kind]:rows}));
      setNotice(fmt(rows.length)+' ردیف در این نشست بارگذاری شد.');
    }catch(error){setNotice(error instanceof Error?error.message:'فایل خوانده نشد.');}
  }
  const members=useMemo(()=>unique(data.members??[],r=>bank(r)&&member(r)?bank(r)+'\u001f'+member(r):''),[data.members]);
  const membership=useMemo(()=>{
    const map=new Map<string,Set<string>>();
    for(const r of members){const k=member(r),set=map.get(k)??new Set<string>();set.add(bank(r));map.set(k,set);}
    return map;
  },[members]);
  const resolve=(r:Row)=>bank(r)||(membership.get(member(r))?.size===1?[...membership.get(member(r))!][0]:'');
  const calls=unique(data.calls??[],r=>get(r,'کد','شناسه تماس')).filter(r=>get(r,'نوع ارتباط')==='تماس');
  const visits=calls.filter(visit);
  const visible=hasRangeError?[]:visits.filter(r=>matchDate(r,lower,upper)&&(!staff||operator(r)===staff)&&(!selectedBank||resolve(r)===selectedBank));
  const stats=(source:string)=>feeds.find(f=>f.source===source)?.payload?.rows??[];
  const banks=stats('banks'), daily=stats('visits');
  const bankNames=[...new Set([...banks.map(r=>String(r[0]??'')),...members.map(bank),...visits.map(resolve)])].filter(Boolean);
  const latest=new Map<string,Row>();
  for(const r of visits){
    const b=resolve(r),id=member(r);if(!b||!id||!order(r))continue;
    const k=b+'\u001f'+id,p=latest.get(k);
    if(!p||order(r)>order(p)||order(r)===order(p)&&Number(get(r,'کد','شناسه تماس'))>Number(get(p,'کد','شناسه تماس')))latest.set(k,r);
  }
  const oppRows=data.opportunities??[];
  const oppBanks=new Map<string,Set<string>>();
  const oppId=(r:Row)=>get(r,'شناسه فرصت','کد فرصت','opportunity_id');
  for(const r of oppRows){const id=oppId(r);if(!id||!bank(r))continue;const set=oppBanks.get(id)??new Set<string>();set.add(bank(r));oppBanks.set(id,set);}
  const verified=unique(oppRows.filter(r=>oppBanks.get(oppId(r))?.size===1),oppId);
  const uncertain=visits.filter(r=>!resolve(r)||!member(r)||!order(r)).length;
  const dates=[...new Set(visible.map(r=>sheetDate(date(r))).filter((n):n is number=>n!==null))].sort((a,b)=>a-b);
  const generalDates=calls.map(r=>sheetDate(date(r))).filter((n):n is number=>n!==null).sort((a,b)=>a-b);
  const endDate=generalDates.at(-1);
  const startDate=(()=>{if(!endDate)return null;const iso=new Date(Date.UTC(Math.floor(endDate/10000)+621,0,1));for(let i=0;i<740;i++){const day=new Date(+iso+i*86400000);if(sheetDate(day.toISOString().slice(0,10))===endDate)return sheetDate(new Date(+day-29*86400000).toISOString().slice(0,10));}return null;})();
  const last30=calls.filter(r=>matchDate(r,startDate,endDate??null));
  const plannedViews=[['day','تماس‌های ویزیت'],['banks','پیشرفت بانک‌ها'],['opps','خروجی فرصت'],['overall','گزارش کلی مرکز تماس']];
  return <div className="visit-monitor">
    <div className="analysis-heading"><div><h3>پایش ویزیت</h3><p>عملکرد روزانه، وضعیت بانک‌ها و خروجی فرصت</p></div>
      <a className="text-button" href="https://cpl.pakar.app/panel/crm/report" target="_blank" rel="noreferrer">گزارشات کلی در CPL</a></div>
    <div className="filter-row monitor-tabs">{plannedViews.map(([id,label])=><button key={id} className={view===id?'active':''} onClick={()=>setView(id)}>{label}</button>)}</div>
    <details className="analysis-card">
      <summary>ورود خروجی‌های CPL، اعضای بانک و فرصت‌ها</summary>
      <p>فایل CSV هر بخش را انتخاب کنید. داده‌های واردشده فقط در همین نشست و تا خروج از بخش «پایش شیت‌ها» قابل استفاده‌اند. برای گزارش کلی، خروجی تماس همه موضوعات را وارد کنید.</p>
      {(['calls','members','opportunities'] as const).map((kind,i)=><div className="visit-upload" key={kind}>
        <label>{['خروجی تماس CPL','فهرست اعضای بانک‌ها','خروجی فرصت‌های منتسب به بانک'][i]} <input type="file" accept=".csv,.tsv,text/csv" onChange={e=>{void importFile(kind,e.target.files?.[0]);e.target.value='';}}/></label>
        <small>{data[kind]&&fmt(data[kind]!.length)+' ردیف · '}ستون‌های قالب: {samples[kind].join('، ')}</small>
      </div>)}
      {notice&&<p role="status">{notice}</p>}
    </details>
    {view==='day'&&(data.calls?<div className="analysis-card">
      <div className="analysis-dates">
        <label>از <input value={from} placeholder="۱۴۰۵/۰۸/۰۱" onChange={e=>setFrom(e.target.value)}/></label>
        <label>تا <input value={to} placeholder="۱۴۰۵/۰۸/۳۰" onChange={e=>setTo(e.target.value)}/></label>
        <select aria-label="اپراتور" value={staff} onChange={e=>setStaff(e.target.value)}><option value="">همه اپراتورها</option>{breakdown(visits,operator).map(([n])=><option key={n}>{n}</option>)}</select>
        <select aria-label="بانک" value={selectedBank} onChange={e=>setBank(e.target.value)}><option value="">همه بانک‌ها</option>{bankNames.map(n=><option key={n}>{n}</option>)}</select>
      </div>
      {hasRangeError&&<p role="status">بازه تاریخ معتبر نیست.</p>}
      <Counts values={[[ 'کل تلاش‌ها',visible.length],...outcomes.map((o):[string,number]=>[o,visible.filter(r=>outcome(r)===o).length]),['نتیجه نامشخص',visible.filter(r=>!outcomes.includes(outcome(r))).length]]}/>
      <h4>تلاش‌ها به تفکیک روز</h4><Bars values={dates.map(d=>[dateLabel(d),visible.filter(r=>sheetDate(date(r))===d).length])}/>
      <h4>مرحله پیگیری</h4><Bars values={breakdown(visible,r=>get(r,'مرحله پیگیری')||topic(r).match(/مرحله پیگیری[:：]\s*(.*?)(?=وضعیت همکاری|نوع مجموعه|$)/)?.[1]?.trim()||'ثبت نشده')}/>
      <h4>اقدام بعدی</h4><Bars values={breakdown(visible,next)}/>
    </div>:<div className="analysis-card"><h4>گزارش روزانه شیت قربانی</h4><p>تفکیک نتیجه تماس و اپراتور با ورود خروجی CPL فعال می‌شود.</p><Bars values={daily.slice(-15).reverse().filter(r=>typeof r[1]==='number').map(r=>[String(r[0])+' · '+String(r[6]??'بانک'),Number(r[1])])}/></div>)}
    {view==='banks'&&<div className="analysis-card"><h4>آخرین وضعیت اعضای هر بانک</h4>
      <p>هر عضو در هر بانک یک‌بار شمرده می‌شود. آمار «بدون تماس در فایل» فقط با فهرست کامل اعضا و سابقه معتبر قابل تفسیر است.</p>
      {uncertain>0&&<p role="status">{fmt(uncertain)} تماس ویزیت برای اتصال قطعی به عضو و بانک، اطلاعات کافی ندارد.</p>}
      {bankNames.map(b=>{
        const roster=members.filter(r=>bank(r)===b);
        const hasMatch=roster.some(r=>latest.has(b+'\u001f'+member(r)));
        const status=roster.map(r=>latest.get(b+'\u001f'+member(r))).map(r=>r?state(r):'بدون تماس در فایل');
        const meta=banks.find(r=>r[0]===b);
        return <details className="visit-bank" key={b}><summary>{b} · {roster.length?fmt(roster.length):meta?.[2]??'—'} عضو</summary>
          {data.calls&&roster.length>0&&hasMatch?<><Counts values={[['پوشش در فایل',fmt(100*status.filter(s=>s!=='بدون تماس در فایل').length/roster.length)+'٪'],...['بدون تماس در فایل','در فرایند','تمام شده','توقف تماس'].map((s):[string,number]=>[s,status.filter(x=>x===s).length])]} />
          <Bars values={breakdown(roster.flatMap(r=>{const x=latest.get(b+'\u001f'+member(r));return x?[x]:[]}),next)}/></>:<p>برای محاسبه وضعیت اعضا، فهرست اعضای بانک و تماس‌های دارای شناسه مشترک لازم است. پوشش ثبت‌شده در شیت: {meta?.[5]??'نامشخص'}</p>}
        </details>;
      })}
    </div>}
    {view==='opps'&&<div className="analysis-card"><h4>فرصت‌های منتسب به بانک</h4>
      {!data.opportunities?<p>خروجی فرصت‌ها را با شناسه فرصت، بانک و وضعیت بارگذاری کنید. عدد «پیگیری منجر به فرصت» در شیت قربانی معیار تأیید فرصت نیست.</p>:<>
      {oppBanks.size>verified.length&&<p role="status">{fmt(oppBanks.size-verified.length)} فرصت به چند بانک نسبت داده شده و از شمارش کنار گذاشته شد.</p>}
      {[...new Set(verified.map(bank))].map(b=>{
        const rows=verified.filter(r=>bank(r)===b);
        const status=(r:Row)=>get(r,'وضعیت','وضعیت فرصت');
        const ids=new Set(rows.map(member).filter(Boolean));
        return <div className="visit-bank" key={b}><strong>{b}</strong><Counts values={[['ثبت‌شده',rows.length],['تأییدشده',rows.filter(r=>/^(تأیید شده|تایید شده|منتشر شده|تایید|تأیید)$/.test(status(r))).length],['در انتظار بررسی',rows.filter(r=>/^(در انتظار بررسی|در حال بررسی|در انتظار تأیید|در انتظار تایید)$/.test(status(r))).length],['اعضای دارای فرصت',ids.size?ids.size:'—']]}/><Bars values={breakdown(rows,status)}/></div>;
      })}</>}
    </div>}
    {view==='overall'&&<div className="analysis-card"><h4>گزارش کلی مرکز تماس · همه موضوعات</h4>
      {!data.calls?<p>خروجی کامل تماس‌ها را برای محاسبه گزارش کلی وارد کنید.</p>:<>
      <p>{startDate&&endDate?dateLabel(startDate)+' تا '+dateLabel(endDate)+' · بر اساس آخرین تاریخ داخل فایل':'تاریخ معتبر در فایل موجود نیست.'}</p>
      <Counts values={[[ 'کل تلاش‌ها',last30.length],...outcomes.map((o):[string,number]=>[o,last30.filter(r=>outcome(r)===o).length])]}/>
      <h4>تماس اپراتورها به تفکیک روز</h4><Bars values={breakdown(last30,r=>dateLabel(sheetDate(date(r))!)+' · '+operator(r))}/>
      <h4>موضوعات تماس</h4><Bars values={breakdown(last30,r=>visit(r)?'ویزیت':topic(r).split(/مرحله پیگیری|وضعیت همکاری|نوع مجموعه/)[0]?.trim())}/>
      <h4>سهم اپراتورها</h4><Bars values={breakdown(last30,operator)}/>
      <h4>اقدام بعدی تماس‌ها</h4><Bars values={breakdown(last30,next)}/>
      <p>وضعیت کاربران CRM و وضعیت فرصت‌های کل مرکز تماس به خروجی جداگانه CPL نیاز دارند.</p></>}
    </div>}
  </div>;
}
