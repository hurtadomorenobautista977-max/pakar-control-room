const books = {
  daily: '1BUxzwRxSbw1xXfPFTxYaYSm8U7S94PbT2fWJE6AoceI',
  q3: '193MWKRWF0yZ6uJi364ObXIK1M-LnCMofj2E6VfwwXV0',
  finance: '16My4BOO6o43dHaEHj8OOI_uvtxbUxKkGB5LXLuLKBIk'
};

export const faText = (s: string) => s.replace(/[۰-۹٠-٩]/g, c => String(c.charCodeAt(0) & 15))
  .replace(/ي/g,'ی').replace(/ك/g,'ک').trim();
const present = (s: string) => Boolean(s?.trim()) && !/^#/.test(s.trim());
function num(s: string) {
  if (!present(s)) return null;
  const value = faText(s).replace(/[,٬\s$]/g,'').replace(/٫/g,'.').replace(/(?:تومان|ریال)$/,'').replace(/٪/,'%');
  if (!/^-?\d+(?:\.\d+)?%?$/.test(value)) return null;
  return Number(value.replace('%','')) / (value.endsWith('%') ? 100 : 1);
}
const checked = (s: string) => s?.toUpperCase() === 'TRUE';
const tick = (s: string) => checked(s) ? 'انجام شده' : s?.toUpperCase()==='FALSE' ? 'در انتظار' : 'نامشخص';
const percent = (v: number | null) => v === null ? '—' : (v * 100).toLocaleString('fa-IR',{maximumFractionDigits:1}) + '٪';
const dash = (s: string) => present(s) ? s : '—';
function progress(r: string[]) {
  const [base, goal, current] = r.slice(3,6).map(num);
  if (current === null || goal === null || current < 0) return 'نیازمند داده معتبر';
  if (r[1] === 'KR 1.1' || r[1] === 'KR 1.4') return 'نیازمند بازبینی تعریف یا پوشش داده';
  if (base === null) return r[1] === 'KR 3.2' && goal > 0 ? percent(current / goal) : 'خط پایه نامشخص';
  if (base === goal) return 'پایه و هدف یکسان';
  return percent(Math.max(0,(current-base)/(goal-base)));
}
function source(book: keyof typeof books, gid: number, range: string, title: string, columns: string[], header: [number, RegExp], map: (rows: string[][]) => (string|number|null)[][]) {
  return {book,gid,range,title,columns,header,map};
}
export const sources = {
  content: source('daily',0,'A3:P1003','تقویم محتوا',['تاریخ','کانال','قالب','دسته','شرح','تولید','انتشار'],[0,/^تاریخ$/],
    rows => rows.filter(r=>present(r[0])).flatMap(r=>[
      ['پست اینستاگرام',r[1],r[2],r[3],r[4],r[5]],
      ['کانال‌ها',r[6],r[7],r[8],r[9],r[10]],
      ['استوری',r[11],r[12],r[13],r[14],r[15]]
    ].filter(x=>present(x[2])||present(x[3])).map(([channel,format,category,description,production,published])=>[r[0],channel,format,category,description,tick(production),tick(published)]))),
  blog: source('daily',1624795745,'A1:I1001','تقویم بلاگ',['تاریخ برنامه','وضعیت','خوشه','عنوان','اولویت سئو'],[4,/عنوان کامل/],
    rows=>rows.filter(r=>present(r[4])).map(r=>[r[1],r[2],r[3],r[4],r[7]])),
  sms: source('daily',908301894,'A1:O2001','پیامک',['کمپین','مرحله','تاریخ','وضعیت ارسال','تعداد ارسال','ورودی UTM','ورودی یکتا','نرخ ورودی ثبت‌شده','هزینه هر ورودی (ریال)','هزینه ریالی تأییدشده','مبلغ با واحد نامشخص'],[0,/^لیست$/],
    rows=>rows.filter(r=>present(r[0])).map(r=>{
      const count=num(r[6]), visits=num(r[13]), cost=num(r[11]);
      const isRial=/ریال/.test(r[11]||'');
      return [r[0],r[3],r[10],tick(r[12]),count,visits,num(r[14]),
        percent(count && visits!==null && checked(r[12]) ? visits/count : null),isRial && cost!==null && visits && checked(r[12]) ? Math.round(cost/visits) : null,
        isRial ? cost : null, isRial ? null : cost];
    })),
  banks: source('daily',1079608698,'A1:F1001','بانک ویزیت',['بانک','مسئول','اندازه بانک','تماس‌گرفته‌شده','وضعیت','پوشش تماس'],[0,/نام بانک/],
    rows=>rows.filter(r=>present(r[0])).map(r=>[r[0],r[1],num(r[2]),num(r[3]),r[4],num(r[3])===null || !num(r[2]) ? 'نیازمند داده معتبر' : percent(num(r[3])!/num(r[2])!)])),
  visits: source('daily',95950132,'A1:K2001','ویزیت روزانه · قربانی',['تاریخ','کل تماس','ویزیت جدید','پیگیری ثبت‌شده','خروج از چرخه','پیگیری منجر به فرصت','بانک'],[1,/تاریخ/],
    rows=>rows.filter(r=>present(r[1])).map(r=>{
      const followups=r.slice(4,8).map(num);
      return [r[1],num(r[2]),num(r[3]),followups.some(v=>v===null) ? null : followups.reduce<number>((a,b)=>a+(b??0),0),num(r[8]),num(r[9]),r[10]];
    })),
  okr: source('q3',0,'B5:L501','اهداف و نتایج کلیدی Q3',['هدف','کد شاخص','نتیجه کلیدی','خط پایه','هدف نهایی','مقدار فعلی','پیشرفت محاسبه‌شده','وضعیت شیت','پروژه مرتبط'],[1,/کد سنجه/],
    rows=>{
      let objective='', code='';
      return rows.filter(r=>present(r[2])).map(r=>{
        if(present(r[0])) objective=r[0];
        if(present(r[1])) code=r[1];
        return [objective,r[1]||code,r[2],dash(r[3]),dash(r[4]),dash(r[5]),progress(r),r[7],r[9]];
      });
    }),
  rice: source('q3',1347670070,'B5:J501','اولویت پروژه‌ها (RICE)',['پروژه','حوزه','امتیاز','اولویت','سنجه‌های مرتبط'],[0,/نام پروژه/],
    rows=>rows.filter(r=>present(r[0])).map(r=>[r[0],r[1],num(r[6]),r[7],r[8]])),
  roadmap: source('q3',1806805202,'B5:I1001','نقشه راه پاییز ۱۴۰۵',['مایلستون','پروژه','مسئول','شروع','پایان','کد شاخص','وضعیت'],[0,/مایلستون/],
    rows=>rows.filter(r=>present(r[0])).map(r=>[r[0],r[1],r[2],faText(r[4]||'').replace(/^1403(?=[/-])/,'1405'),faText(r[5]||'').replace(/^1403(?=[/-])/,'1405'),r[6],r[7]])),
  requests: source('finance',0,'C8:I501','درخواست‌های واریزی',['عنوان','مبلغ (تومان)','اولویت','وضعیت پرداخت'],[0,/عنوان درخواست/],
    rows=>rows.filter(r=>present(r[0])).map(r=>[r[0],num(r[3]),r[4],tick(r[5])==='انجام شده'?'پرداخت‌شده':tick(r[5])])),
  settlements: source('finance',1255810493,'A1:I2001','تسویه فرصت‌های مالی',['عنوان فرصت','مبلغ (تومان)','تاریخ تسویه','وضعیت پرداخت'],[0,/عنوان فرصت/],
    rows=>rows.filter(r=>present(r[0])).map(r=>{
      const status=faText(r[5]||'');
      const paid=checked(r[8]);
      const hasTick=/^(TRUE|FALSE)$/i.test(r[8]||'');
      const settled=/^(تسویه|تسویه شده|تسویه‌شده)$/.test(status);
      return [r[0],num(r[3]),r[4],!hasTick ? 'نامشخص' : paid!==settled ? 'مغایرت وضعیت' : paid ? 'تسویه‌شده' : 'تسویه نشده'];
    }))
};
type Source = (typeof sources)[keyof typeof sources];
export function sourceUrl(s: Source) {
  return 'https://docs.google.com/spreadsheets/d/'+books[s.book]+'/edit?gid='+s.gid;
}

export function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [], value='', quoted=false;
  for (let i=0; i<csv.length; i++) {
    const c=csv[i];
    if (c==='"') {
      if (quoted && csv[i+1]==='"') { value+='"'; i++; }
      else quoted=!quoted;
    } else if (!quoted && (c===',' || c==='\n')) {
      row.push(value.trim()); value='';
      if (c==='\n') {rows.push(row); row=[];}
    } else value+=c;
  }
  if (quoted) throw Error('incomplete CSV');
  if (row.length || value) rows.push([...row,value.trim()]);
  return rows;
}
export async function readSource(s: Source) {
  const query = new URLSearchParams({format:'csv',gid:String(s.gid),range:s.range});
  const response = await fetch('https://docs.google.com/spreadsheets/d/'+books[s.book]+'/export?'+query,{signal:AbortSignal.timeout(15000),cache:'no-store'});
  if (!response.ok || !response.headers.get('content-type')?.includes('text/csv')) throw Error('CSV unavailable');
  const [header,...rows]=parseCsv((await response.text()).replace(/^\uFEFF/,''));
  if (!header || !s.header[1].test(faText(header[s.header[0]]||''))) throw Error('Unexpected sheet header');
  return {title:s.title,url:sourceUrl(s),columns:s.columns,rows:s.map(rows)};
}
