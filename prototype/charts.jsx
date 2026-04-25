// Reusable chart components — pure SVG, no libraries

function MiniArea({ data, color = '#5929d0', height = 60, fill = true, gradientId='ma' }) {
  const w = 100, h = 100;
  const max = Math.max(...data, 1);
  const min = 0;
  const pts = data.map((v, i) => [i*(w/(data.length-1)), h - ((v-min)/(max-min)) * h * 0.85 - 5]);
  const linePath = pts.map((p,i) => (i===0?'M':'L') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' ');
  const areaPath = linePath + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{width:'100%', height}}>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {fill && <path d={areaPath} fill={`url(#${gradientId})`}/>}
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
      {pts.map((p,i)=> i===pts.length-1 ? <circle key={i} cx={p[0]} cy={p[1]} r="1.6" fill={color}/> : null)}
    </svg>
  );
}

function BarPair({ labels, a, b, colorA='#5929d0', colorB='#CF008B', height = 200 }) {
  const W = 360, H = 200, padL = 28, padB = 24, padT = 12;
  const max = Math.max(...a, ...b, 1);
  const cw = (W - padL - 8) / labels.length;
  const bw = cw * 0.32;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%', height}}>
      {[0,0.25,0.5,0.75,1].map((t,i)=>{
        const y = padT + (H - padT - padB) * (1-t);
        return <g key={i}>
          <line x1={padL} x2={W-4} y1={y} y2={y} stroke="#E2E8F0" strokeWidth="1"/>
          <text x={padL-6} y={y+3} fontSize="9" textAnchor="end" fill="#94A3B8">{Math.round(max*t)}</text>
        </g>;
      })}
      {labels.map((lab,i) => {
        const x = padL + i*cw + cw/2;
        const ah = (a[i]/max) * (H - padT - padB);
        const bh = (b[i]/max) * (H - padT - padB);
        const yA = (H - padB) - ah;
        const yB = (H - padB) - bh;
        return <g key={i}>
          <rect x={x - bw - 1} y={yA} width={bw} height={ah} fill={colorA} rx="2"/>
          <rect x={x + 1}      y={yB} width={bw} height={bh} fill={colorB} rx="2"/>
          <text x={x} y={H-8} fontSize="9" textAnchor="middle" fill="#64748B">{lab}</text>
        </g>;
      })}
    </svg>
  );
}

function Donut({ value, total = 100, color = '#5929d0', size = 140, label, sub }) {
  const r = 56, c = 2*Math.PI*r, pct = Math.min(value/total, 1);
  const dash = c * pct;
  return (
    <div style={{ position:'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#E2E8F0" strokeWidth="14"/>
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="14"
          strokeDasharray={`${dash} ${c}`} strokeDashoffset="0" strokeLinecap="round"
          transform="rotate(-90 70 70)" style={{ transition: 'stroke-dasharray 0.6s' }}/>
      </svg>
      <div style={{position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
        <div style={{fontSize:24, fontWeight:700, color:'#0F172A', lineHeight:1}}>{label}</div>
        <div style={{fontSize:10.5, color:'#64748B', marginTop:4}}>{sub}</div>
      </div>
    </div>
  );
}

function StackedBar({ segments, height=8 }) {
  const total = segments.reduce((s,x)=>s+x.value, 0);
  return (
    <div style={{display:'flex', height, borderRadius:999, overflow:'hidden', background:'#F1F5F9'}}>
      {segments.map((s,i)=>(
        <div key={i} title={`${s.label}: ${s.value}`} style={{
          width: `${(s.value/total)*100}%`,
          background: s.color,
          transition: 'width 0.4s'
        }}/>
      ))}
    </div>
  );
}

function Sparkline({ data, color='#5929d0', height=28 }) {
  const W=80, H=28;
  const max=Math.max(...data,1);
  const min=Math.min(...data,0);
  const pts = data.map((v,i)=>[i*(W/(data.length-1)), H - ((v-min)/((max-min)||1))*H*0.85 - 3]);
  const path = pts.map((p,i)=>(i===0?'M':'L')+p[0]+' '+p[1]).join(' ');
  return <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%', height}} preserveAspectRatio="none">
    <path d={path} stroke={color} strokeWidth="1.6" fill="none" vectorEffect="non-scaling-stroke"/>
  </svg>;
}

window.MiniArea = MiniArea;
window.BarPair = BarPair;
window.Donut = Donut;
window.StackedBar = StackedBar;
window.Sparkline = Sparkline;
