import {useState} from 'react';
type Cell=string|number|null;
const fmt=(n:number)=>n.toLocaleString('fa-IR',{maximumFractionDigits:2});
const colors=['#007c5c','#7652c8','#187bb1','#cb5c25','#bc3971','#547531','#5869bc','#a26515'];
const months='فروردین اردیبهشت خرداد تیر مرداد شهریور مهر آبان آذر دی بهمن اسفند'.split(' ');
const clean=(value:Cell)=>String(value??'').replace(/[۰-۹٠-٩]/g,c=>String(c.charCodeAt(0)&15)).replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200f\u200e]/g,' ').trim();
const key=(y:number,m:number,d:number)=>y*10000+m*100+d;
const valid=(y:number,m:number,d:number)=>m>=1&&m<=12&&d>=1&&d<=(m<=6?31:30)?key(y,m,d):null;
export function sheetDate(value:Cell){
  const s=clean(value);
  const full=s.match(/\b(1[34]\d{2})[/.\-](\d{1,2})[/.\-](\d{1,2})\b/);
  if(full) return valid(+full[1],+full[2],+full[3]);
  const iso=s.match(/^(20\d{2})-(\d{2})-(\d{2})(?:\b|T)/);
  if(iso){
    const day=new Date(s.slice(0,10)+'T12:00:00Z');
    if(!Number.isFinite(+day)||day.toISOString().slice(0,10)!==s.slice(0,10))return null;
    const parts=new Intl.DateTimeFormat('en-u-ca-persian',{timeZone:'UTC',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(day);
    return key(...(['year','month','day'].map(type=>Number(parts.find(p=>p.type===type)?.value)) as [number,number,number]));
  }
  const named=s.replace(/ابان/g,'آبان').replace(/اذر/g,'آذر').match(/(\d{1,2})\s*(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)(?:\s+(1[34]\d{2}))?/);
  if(named) return valid(Number(named[3]??1405),months.indexOf(named[2])+1,+named[1]);
  const short=s.match(/^(\d{1,2})[/.](\d{1,2})$/);
  return short?valid(1405,+short[1],+short[2]):null;
}
export const isPublished=(value:Cell)=>/^منتشر\s*شده$/.test(clean(value));
export const blogProduced=(value:Cell)=>isPublished(value)||/^(آماده(?:\s+انتشار)?|تولید\s*شده|تکمیل\s*شده|نهایی\s*شده)$/.test(clean(value));

export function EditorialCharts({source,rows}:{source:string;rows:Cell[][]}){
  const [mode,setMode]=useState('bar'),[metric,setMetric]=useState('produced');
  const [selected,setSelected]=useState('');
  const blog=source==='blog';
  const grouped=new Map<string,{produced:number;published:number;total:number}>();
  for(const row of rows){
    const label=clean(row[blog?2:3])||'بدون دسته‌بندی';
    const group=grouped.get(label)??{produced:0,published:0,total:0};
    group.total++;
    if(blog?blogProduced(row[1]):row[5]==='انجام شده')group.produced++;
    if(blog?isPublished(row[1]):row[6]==='انجام شده')group.published++;
    grouped.set(label,group);
  }
  const metricKey=metric as 'produced'|'published'|'total';
  const entries=[...grouped].map(([label,stats],i)=>({label,...stats,color:colors[i%colors.length]})).sort((a,b)=>b[metricKey]-a[metricKey]);
  const total=entries.reduce((n,e)=>n+e[metricKey],0);
  const max=entries[0]?.[metricKey]||1;
  let angle=0;
  const segments=entries.filter(e=>e[metricKey]).map(e=>{
    const next=angle+e[metricKey]*100/total;
    const segment=e.color+' '+angle+'% '+next+'%';angle=next;return segment;
  });
  const active=entries.find(e=>e.label===selected);
  return <div className="analysis-card">
    <div className="analysis-heading"><div><h3>{blog?'ترکیب خوشه‌های بلاگ':'ترکیب دسته‌های محتوا'}</h3><p>سهم هر دسته از کل اقلام همین بازه</p></div>
      <div className="analysis-controls">
        <select aria-label="شاخص نمودار" value={metric} onChange={e=>setMetric(e.target.value)}><option value="produced">تولیدشده</option><option value="published">منتشرشده</option><option value="total">کل برنامه</option></select>
        <button type="button" aria-pressed={mode==='bar'} onClick={()=>setMode('bar')}>میله‌ای</button>
        <button type="button" aria-pressed={mode==='pie'} onClick={()=>setMode('pie')}>دایره‌ای</button>
      </div>
    </div>
    {!total&&<p className="analysis-empty">برای این شاخص در بازه انتخابی داده‌ای وجود ندارد.</p>}
    <div className={'category-layout '+(mode==='pie'&&total?'with-pie':'')}>
      {mode==='pie'&&total>0&&<div className="chart-donut" aria-label="نمودار دایره‌ای" style={{background:'conic-gradient('+segments.join(',')+')'}}><div><strong>{fmt(active?.[metricKey]??total)}</strong><span>{active?.label??'مجموع'}</span></div></div>}
      <ul className="category-list">{entries.map(e=><li key={e.label}>
        <button type="button" className="category-item" aria-pressed={selected===e.label} onClick={()=>setSelected(selected===e.label?'':e.label)}>
          <span className="category-label"><i style={{background:e.color}}/>{e.label}</span><b>{fmt(e[metricKey])} <small>· {fmt(total?100*e[metricKey]/total:0)}٪</small></b>
          {mode==='bar'&&<span className="bar-track"><i style={{width:100*e[metricKey]/max+'%',background:e.color}}/></span>}
          <small className="category-detail">{fmt(e.produced)} تولید · {fmt(e.published)} انتشار · {fmt(e.total)} در برنامه</small>
        </button>
      </li>)}</ul>
    </div>
  </div>;
}

function windowTotals(rows:Cell[][],index:number){
  const known=rows.filter(r=>typeof r[index]==='number'&&Number(r[index])>=0);
  const total=known.reduce((sum,r)=>sum+Number(r[index]),0);
  const paired=known.filter(r=>typeof r[4]==='number'&&Number(r[4])>0);
  const sends=paired.reduce((sum,r)=>sum+Number(r[4]),0);
  const visits=paired.reduce((sum,r)=>sum+Number(r[index]),0);
  return {label:known.length?fmt(total):'—',rate:sends?100*visits/sends:null,paired:paired.length};
}

export function SmsCharts({rows}:{rows:Cell[][]}){
  const [dimension,setDimension]=useState('audience');
  const [metric,setMetric]=useState('utm');
  const sent=rows.filter(r=>r[3]==='انجام شده');
  const utm=windowTotals(sent,5),unique=windowTotals(sent,6);
  const groups=new Map<string,Cell[][]>();
  for(const row of sent){
    const label=clean(row[({stage:1,list:0,audience:11,type:12,approach:13} as Record<string,number>)[dimension]])||'نامشخص';
    const list=groups.get(label)??[];
    list.push(row);groups.set(label,list);
  }
  const index=metric==='utm'?5:6;
  const values=[...groups].map(([name,list])=>({name,list,...windowTotals(list,index)})).sort((a,b)=>(b.rate??-1)-(a.rate??-1));
  const max=Math.max(1,...values.map(v=>v.rate??0));
  return <>
    <div className="sms-kpis">
      <div><span>ورودی ثبت‌شده UTM</span><strong>{utm.label}</strong><small>{utm.rate===null?'نرخ نامشخص':fmt(utm.rate)+'٪ نسبت به ارسال'} · {fmt(utm.paired)} از {fmt(sent.length)} ردیف قابل محاسبه</small></div>
      <div><span>جمع رکورد یکتای ارسال‌ها</span><strong>{unique.label}</strong><small>{unique.rate===null?'نرخ نامشخص':fmt(unique.rate)+'٪ نسبت به ارسال'} · {fmt(unique.paired)} از {fmt(sent.length)} ردیف قابل محاسبه</small></div>
    </div>
    <div className="analysis-card">
      <div className="analysis-heading"><div><h3>خروجی ارسال‌ها به تفکیک گروه</h3><p>نرخ از مجموع رکوردها بر مجموع ارسال‌های دارای داده محاسبه می‌شود. رکورد یکتا در سطح هر ردیف گزارش شده است.</p></div>
      <div className="analysis-controls"><select aria-label="گروه‌بندی پیامک" value={dimension} onChange={e=>setDimension(e.target.value)}><option value="audience">مخاطب</option><option value="list">لیست ارسال</option><option value="stage">مرحله</option><option value="type">نوع پیامک</option><option value="approach">رویکرد</option></select>
      <select aria-label="شاخص پیامک" value={metric} onChange={e=>setMetric(e.target.value)}><option value="utm">نرخ ورودی UTM</option><option value="unique">نرخ رکورد یکتا</option></select></div></div>
      {values.length===0&&<p>در بازه انتخابی ارسال ثبت نشده است.</p>}
      <ul className="category-list">{values.map(v=><li key={v.name}><div className="category-item">
        <span className="category-label">{v.name}</span><b>{v.rate===null?'—':fmt(v.rate)+'٪'}</b>
        <span className="bar-track"><i style={{width:(v.rate??0)*100/max+'%',background:'#007c5c'}}/></span>
        <small className="category-detail">{fmt(v.list.length)} ردیف ارسال · {v.label} رکورد · پوشش نرخ {fmt(v.paired)} از {fmt(v.list.length)}</small>
      </div></li>)}</ul>
    </div>
  </>;
}
