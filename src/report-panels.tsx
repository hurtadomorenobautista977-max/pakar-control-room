type Row = (string | number | null)[];
const format = (n:number) => n.toLocaleString('fa-IR',{maximumFractionDigits:1});
const colors = ['#008f87','#40565e','#e4a12d','#c65d60'];

export function ReportPanels({source,rows}:{source:string;rows:Row[]}) {
  if(!rows.length) return null;
  if(source==='cpl-q3') {
    const indicators=rows.filter(row=>row[4]!=null && row[4]!=='');
    return <div className="okr-tiles">{indicators.map(row=>{
      const progress=parseFloat(String(row[5]));
      return <article key={String(row[2])+String(row[1])}>
        <small dir="ltr">{row[0]}</small><h3>{row[1]}</h3>
        <strong>{Number.parseFloat(String(row[4])).toLocaleString('fa-IR',{maximumFractionDigits:2})}{String(row[4]).includes('%')?'٪':''}</strong>
        <span>هدف فصل · {row[3]}</span>
        {Number.isFinite(progress)&&<><div className="okr-track"><i style={{width:Math.min(100,Math.max(0,progress))+'%'}}/></div><small>پیشرفت · {format(progress)}٪</small></>}
      </article>
    })}</div>;
  }
  if(source!=='cpl-visits') return null;
  const labels=['موفق','ناموفق','اشغال','شماره اشتباه'];
  const counts=labels.map((_,i)=>rows.reduce((n,r)=>n+Number(r[i+3]||0),0));
  const total=counts.reduce((a,b)=>a+b,0);
  if(!total) return null;
  let end=0;
  const stops=counts.map((v,i)=>{const start=end;end+=v/total*100;return colors[i]+' '+start+'% '+end+'%'}).join(',');
  const days=new Map<string,number>();
  rows.forEach(r=>{const date=String(r[0]||'');if(date)days.set(date,(days.get(date)||0)+Number(r[2]||0))});
  const recent=[...days].sort(([a],[b])=>b.localeCompare(a)).slice(0,7);
  const peak=Math.max(1,...recent.map(([,n])=>n));
  return <div className="visit-visuals"><article><h3>نتیجه تماس‌های ویزیت</h3><div className="visit-mix">
    <div className="visit-ring" style={{background:'conic-gradient('+stops+')'}}><b>{format(total)}<small>تماس</small></b></div>
    <ul>{labels.map((label,i)=><li key={label}><i style={{background:colors[i]}}/>{label}<b>{format(counts[i])}</b></li>)}</ul></div></article>
    <article><h3>حجم تماس در ۷ روز اخیر دارای ثبت</h3>{recent.map(([d,n])=><div className="day-bar" key={d}><time dir="ltr">{d}</time><div><i style={{width:n/peak*100+'%'}}/></div><b>{format(n)}</b></div>)}</article></div>
}
