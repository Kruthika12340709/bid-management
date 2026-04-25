// Dashboard, Bids list, Bid detail, HIL Approval, Audit screens

const fmtMoney = (v, c='GBP') => {
  const sym = c==='GBP'?'£':c==='EUR'?'€':'$';
  if (v >= 1000000) return sym + (v/1000000).toFixed(2) + 'M';
  if (v >= 1000) return sym + (v/1000).toFixed(0) + 'k';
  return sym + v;
};
const stageBadge = (k) => {
  const s = window.BID_DATA.stages.find(s=>s.key===k) || {label:k, color:'#94A3B8'};
  const cls = k==='approved'?'badge-success':k==='submitted'?'badge-pink':k==='pending'?'badge-primary':k==='compiling'?'badge-cyan':'badge-neutral';
  return <span className={`badge ${cls}`}>{s.label}</span>;
};

// ─────────────────────────────────────────────
// DASHBOARD
function Dashboard({ user, onOpenBid }) {
  const D = window.BID_DATA;
  const myBids = D.bids.filter(b => b.assigned === user.id);
  const allBids = D.bids;

  const isDirector = user.id === 'director';
  const headline = isDirector ? 'HIL Approval Queue' : 'Compilation Pipeline';
  const headlineSub = isDirector
    ? `${D.bids.filter(b=>b.stage==='pending').length} bids awaiting your sign-off · ${D.bids.filter(b=>b.daysLeft<=5 && b.stage!=='submitted').length} within 5 days of deadline`
    : `${D.bids.filter(b=>['validating','compiling'].includes(b.stage)).length} bids in compilation · ${D.bids.reduce((s,b)=>s+b.flags.lowConf,0)} low-confidence flags pending`;

  const winRate = Math.round(D.timeseries.won.reduce((a,b)=>a+b,0) / D.timeseries.submitted.reduce((a,b)=>a+b,0) * 100);
  const totalPipeline = D.bids.filter(b=>b.stage!=='submitted').reduce((s,b)=>s+b.value,0);

  return (
    <div>
      <div className="page-banner">
        <div className="page-banner-dot"/>
        <div className="page-banner-text">
          <div className="page-banner-title">{headline}</div>
          <div className="page-banner-sub">{headlineSub}</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn">View pipeline</button>
          <button className="page-banner-btn primary">{isDirector?'Open HIL queue':'New compilation'}</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <KPI label="Active Pipeline Value" value={fmtMoney(totalPipeline)} tone="primary" trend="up" trendVal="+18%" sparkData={[3.2,3.6,4.1,4.6,5.2,5.1,6.0]}/>
        <KPI label={isDirector?'Pending Approvals':'Active Compilations'} value={isDirector ? D.bids.filter(b=>b.stage==='pending').length : D.bids.filter(b=>b.stage==='compiling'||b.stage==='validating').length} tone="pink" sub={isDirector?`Avg cycle time 4h 12m`:`Avg compile 13m 04s`}/>
        <KPI label="Win Rate (8 weeks)" value={`${winRate}%`} tone="success" trend="up" trendVal="+6 pts" sparkData={D.timeseries.won}/>
        <KPI label="HIL Override Rate" value="14%" tone="warning" trend="down" trendVal="-3 pts" sub="Pricing & risk lead"/>
      </div>

      {/* Charts row 1 */}
      <div className="dash-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{Icon.briefcase(14)} Submissions vs Wins</div>
              <div className="card-sub">Weekly · last 7 weeks · pipeline learning input</div>
            </div>
            <div style={{display:'flex', gap:12, fontSize:11, color:'#64748B'}}>
              <span style={{display:'flex', alignItems:'center', gap:6}}><span className="dot dot-primary"/>Submitted</span>
              <span style={{display:'flex', alignItems:'center', gap:6}}><span className="dot" style={{background:'#CF008B'}}/>Won</span>
            </div>
          </div>
          <div className="card-pad">
            <BarPair labels={D.timeseries.weeks} a={D.timeseries.submitted} b={D.timeseries.won}/>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{Icon.shield(14)} Compilation Accuracy</div>
              <div className="card-sub">Sections passing automated validation</div>
            </div>
          </div>
          <div className="card-pad" style={{display:'flex', alignItems:'center', gap:24, justifyContent:'center'}}>
            <Donut value={87} total={100} color="#5929d0" label="87%" sub="last 30 days"/>
            <div style={{flex:1}}>
              {[
                {label:'Effort', value: 92, color:'#5929d0'},
                {label:'Schedule', value: 88, color:'#22D3EE'},
                {label:'Pricing', value: 96, color:'#16A34A'},
                {label:'Risks', value: 78, color:'#E4902E'},
                {label:'Quality', value: 90, color:'#CF008B'}
              ].map((row,i)=>(
                <div key={i} style={{marginBottom:10}}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:11.5, marginBottom:4, color:'#475569', fontWeight:600}}>
                    <span>{row.label}</span><span>{row.value}%</span>
                  </div>
                  <div style={{height:5, background:'#F1F5F9', borderRadius:999, overflow:'hidden'}}>
                    <div style={{width:`${row.value}%`, height:'100%', background:row.color, borderRadius:999}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="dash-grid-3 mb-16">
        <div className="card">
          <div className="card-header">
            <div className="card-title">{Icon.clock(14)} Approval Cycle Time</div>
          </div>
          <div className="card-pad">
            <div style={{fontSize:28, fontWeight:700, color:'#0F172A', letterSpacing:'-0.01em'}}>4h 12m</div>
            <div style={{fontSize:11.5, color:'#64748B', marginBottom:10}}>Median · queue entry → sign-off</div>
            <MiniArea data={[6.1, 5.4, 5.8, 4.9, 4.6, 4.3, 4.2]} color="#5929d0" gradientId="g1"/>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:10, color:'#94A3B8', marginTop:4}}>
              <span>W12</span><span>W18</span>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">{Icon.alert(14)} Flag Mix · This Week</div>
          </div>
          <div className="card-pad">
            <div style={{fontSize:28, fontWeight:700, color:'#0F172A', letterSpacing:'-0.01em'}}>23</div>
            <div style={{fontSize:11.5, color:'#64748B', marginBottom:14}}>Flags raised across 7 active bids</div>
            <StackedBar segments={[
              {label:'Low confidence', value: 9, color:'#5929d0'},
              {label:'Schedule conflict', value: 4, color:'#E4902E'},
              {label:'Missing rate card', value: 2, color:'#DC2626'},
              {label:'High-rated risk', value: 6, color:'#CF008B'},
              {label:'Other', value: 2, color:'#94A3B8'}
            ]}/>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:10.5, marginTop:10, color:'#475569', flexWrap:'wrap', gap:8}}>
              <span><span className="dot" style={{background:'#5929d0'}}/> Low conf · 9</span>
              <span><span className="dot" style={{background:'#E4902E'}}/> Schedule · 4</span>
              <span><span className="dot" style={{background:'#DC2626'}}/> Rate · 2</span>
              <span><span className="dot" style={{background:'#CF008B'}}/> High risk · 6</span>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">{Icon.pound(14)} Pricing Variance</div>
          </div>
          <div className="card-pad">
            <div style={{fontSize:28, fontWeight:700, color:'#0F172A', letterSpacing:'-0.01em'}}>+2.4%</div>
            <div style={{fontSize:11.5, color:'#64748B', marginBottom:10}}>Avg variance: bid → final approved</div>
            <MiniArea data={[3.8, 3.2, 3.0, 2.7, 2.5, 2.6, 2.4]} color="#CF008B" gradientId="g2"/>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:10, color:'#94A3B8', marginTop:4}}>
              <span>W12</span><span>W18</span>
            </div>
          </div>
        </div>
      </div>

      {/* My Queue */}
      <div className="card mb-16">
        <div className="card-header">
          <div>
            <div className="card-title">{isDirector?'My HIL Queue':'My Active Compilations'}</div>
            <div className="card-sub">{myBids.length} bids assigned to {user.name}</div>
          </div>
          <button className="btn btn-secondary btn-sm">View all bids {Icon.arrow(11)}</button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Bid / ID</th><th>Client</th><th>RFP Reference</th><th>Stage</th>
              <th>Value</th><th>Sections</th><th>Deadline</th><th>Flags</th><th>Owner</th><th></th>
            </tr>
          </thead>
          <tbody>
            {myBids.slice(0,5).map(b => (
              <BidRow key={b.id} bid={b} onClick={()=>onOpenBid(b)}/>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({ label, value, sub, tone='primary', trend, trendVal, sparkData }) {
  return (
    <div className={`kpi k-${tone==='primary'?'':tone}`}>
      <div className="kpi-label">{label}</div>
      <div style={{display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:8}}>
        <div className="kpi-value">{value}</div>
        {sparkData && <div style={{width:80, opacity:0.7}}><Sparkline data={sparkData} color={tone==='pink'?'#CF008B':tone==='success'?'#16A34A':tone==='warning'?'#E4902E':'#5929d0'}/></div>}
      </div>
      <div className="kpi-meta">
        {trend && <span className={`kpi-trend ${trend}`}>{trend==='up'?Icon.trendUp(11):Icon.trendDown(11)} {trendVal}</span>}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

function BidRow({ bid, onClick }) {
  const D = window.BID_DATA;
  const totalFlags = bid.flags.lowConf + bid.flags.conflicts + bid.flags.missingRate + bid.flags.highRisk;
  const urgent = bid.daysLeft <= 3 && bid.stage !== 'submitted';
  const owner = D.users[bid.assigned];
  return (
    <tr onClick={onClick} style={{cursor:'pointer'}}>
      <td>
        <div style={{fontWeight:600, color:'#0F172A', fontSize:13}}>{bid.title}</div>
        <div style={{fontSize:11, color:'#64748B', fontFamily:'ui-monospace, monospace'}}>{bid.id}</div>
      </td>
      <td style={{fontSize:12, color:'#475569'}}>{bid.client}</td>
      <td style={{fontFamily:'ui-monospace, monospace', fontSize:11, color:'#5929d0', whiteSpace:'nowrap'}}>{bid.rfp}</td>
      <td>{stageBadge(bid.stage)}</td>
      <td>
        <div style={{fontWeight:700, fontSize:13, color:'#0F172A'}}>{fmtMoney(bid.value, bid.currency)}</div>
        <div style={{fontSize:10, color:'#94A3B8'}}>{bid.currency}</div>
      </td>
      <td>
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          <div style={{width:52, height:4, background:'#E2E8F0', borderRadius:2, overflow:'hidden'}}>
            <div style={{width:`${(bid.sectionsComplete/bid.sectionsTotal)*100}%`, height:'100%', background:'#5929d0'}}/>
          </div>
          <span style={{fontSize:11, color:'#64748B'}}>{bid.sectionsComplete}/{bid.sectionsTotal}</span>
        </div>
      </td>
      <td>
        <div style={{fontSize:12, fontWeight:700, color: urgent ? '#DC2626' : '#0F172A'}}>
          {bid.daysLeft < 0 ? `${-bid.daysLeft}d ago` : `${bid.daysLeft}d`}
        </div>
        <div style={{fontSize:10.5, color:'#94A3B8'}}>{new Date(bid.deadline).toLocaleDateString('en-GB', {day:'2-digit', month:'short'})}</div>
      </td>
      <td>
        {totalFlags === 0
          ? <span className="badge badge-success" style={{fontSize:10}}>clean</span>
          : <span className="badge badge-warning" style={{fontSize:10}}>{totalFlags} flag{totalFlags>1?'s':''}</span>}
      </td>
      <td>
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          <div className={`user-avatar ${owner.avatarClass}`} style={{width:22, height:22, fontSize:9}}>{owner.initials}</div>
          <span style={{fontSize:11.5, color:'#475569'}}>{owner.name.split(' ')[0]}</span>
        </div>
      </td>
      <td style={{color:'#94A3B8', fontSize:14}}>›</td>
    </tr>
  );
}

window.Dashboard = Dashboard;
window.BidRow = BidRow;
window.fmtMoney = fmtMoney;
window.stageBadge = stageBadge;
