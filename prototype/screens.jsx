// Bids list, Bid detail / HIL Approval screens, Audit log

function BidsList({ user, onOpenBid }) {
  const D = window.BID_DATA;
  const [filter, setFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const isDirector = user.id === 'director';

  const filters = [
    { k:'all', label:'All bids', count: D.bids.length },
    { k:'mine', label:isDirector?'My queue':'Assigned to me', count: D.bids.filter(b=>b.assigned===user.id).length },
    { k:'pending', label:'Pending HIL', count: D.bids.filter(b=>b.stage==='pending').length },
    { k:'compiling', label:'Compiling', count: D.bids.filter(b=>b.stage==='compiling').length },
    { k:'flagged', label:'Flagged', count: D.bids.filter(b=>(b.flags.lowConf+b.flags.conflicts+b.flags.missingRate+b.flags.highRisk)>0).length },
    { k:'urgent', label:'< 5 days', count: D.bids.filter(b=>b.daysLeft<=5 && b.stage!=='submitted').length }
  ];

  let visible = D.bids;
  if (filter==='mine') visible = visible.filter(b=>b.assigned===user.id);
  else if (filter==='pending') visible = visible.filter(b=>b.stage==='pending');
  else if (filter==='compiling') visible = visible.filter(b=>b.stage==='compiling'||b.stage==='validating');
  else if (filter==='flagged') visible = visible.filter(b => (b.flags.lowConf+b.flags.conflicts+b.flags.missingRate+b.flags.highRisk)>0);
  else if (filter==='urgent') visible = visible.filter(b=>b.daysLeft<=5 && b.stage!=='submitted');
  if (search) {
    const s = search.toLowerCase();
    visible = visible.filter(b => b.title.toLowerCase().includes(s) || b.client.toLowerCase().includes(s) || b.id.toLowerCase().includes(s));
  }

  return (
    <div>
      <div className="page-banner" style={{background:'linear-gradient(90deg, #5929d0 0%, #8b3fb8 50%, #CF008B 100%)'}}>
        <div className="page-banner-dot"/>
        <div className="page-banner-text">
          <div className="page-banner-title">Bid Pipeline · {visible.length} of {D.bids.length} bids</div>
          <div className="page-banner-sub">RFP reference, deadline, days remaining and stage status across the active book</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn">Export</button>
          {!isDirector && <button className="page-banner-btn primary">+ New compilation</button>}
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-search">
          {Icon.search(14)}
          <input placeholder="Search by client, RFP, bid ID…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div className="filter-pills">
          {filters.map(f => (
            <button key={f.k} className={`filter-pill ${filter===f.k?'active':''}`} onClick={()=>setFilter(f.k)}>
              {f.label} <span className="count">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bids-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>Bid / ID</th>
              <th>Client</th>
              <th>RFP Reference</th>
              <th>Stage</th>
              <th>Value</th>
              <th>Sections</th>
              <th>Deadline</th>
              <th>Flags</th>
              <th>Owner</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map(b => <BidRow key={b.id} bid={b} onClick={()=>onOpenBid(b)}/>)}
            {visible.length === 0 && <tr><td colSpan="10" style={{padding:40, textAlign:'center', color:'#94A3B8', fontSize:13}}>No bids match the current filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// BID DETAIL / HIL APPROVAL
function BidDetail({ bid, user, onBack }) {
  const D = window.BID_DATA;
  const isDirector = user.id === 'director';
  const [activeSection, setActiveSection] = React.useState('pricing');
  const [sectionStates, setSectionStates] = React.useState(() => {
    const st = {};
    D.sections.forEach(s => st[s.id] = s.status);
    return st;
  });
  const [acks, setAcks] = React.useState({}); // for high-risk acks
  const [margin, setMargin] = React.useState(bid.currentMargin);
  const [overrideRequested, setOverrideRequested] = React.useState(false);

  const section = D.sections.find(s => s.id === activeSection);

  function updateSection(id, status) {
    setSectionStates(prev => ({...prev, [id]: status }));
  }

  const totalCost = D.pricingLines.reduce((s,l)=>s+l.rate*l.hours, 0);
  const totalBid = D.pricingLines.reduce((s,l)=>s+l.rate*l.hours*(1+(l.task.includes('Pipeline Build — Transformation')||l.task.includes('ML')?margin:l.margin)/100), 0);

  const allApproved = Object.values(sectionStates).every(s => s === 'approved');

  return (
    <div>
      <div className="detail-header">
        <div className="detail-crumb">
          <a onClick={onBack}>Bids</a> {Icon.arrow(10)} {bid.id}
        </div>
        <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:24}}>
          <div style={{flex:1}}>
            <div className="detail-title">{bid.title}</div>
            <div className="detail-sub">
              <div>{Icon.briefcase(12)} {bid.client}</div>
              <div>{Icon.doc(12)} {bid.rfp}</div>
              <div>{Icon.clock(12)} Due {new Date(bid.deadline).toLocaleDateString('en-GB',{day:'2-digit', month:'short'})} · <strong style={{color: bid.daysLeft<=3?'#DC2626':'#0F172A', marginLeft:4}}>{bid.daysLeft}d left</strong></div>
              <div>{stageBadge(bid.stage)}</div>
              {bid.tags.map((t,i)=><span key={i} className="badge badge-neutral" style={{fontSize:10.5}}>{t}</span>)}
            </div>
          </div>
          <div style={{display:'flex', gap:8}}>
            <button className="btn btn-outline">Audit log</button>
            {isDirector && <button className="btn btn-secondary">Reject section</button>}
            {isDirector && allApproved
              ? <button className="btn btn-success">{Icon.check(12)} Sign-off & route to Bid Manager</button>
              : isDirector
                ? <button className="btn btn-primary" disabled>{Object.values(sectionStates).filter(s=>s==='approved').length}/8 sections approved</button>
                : allApproved
                  ? <button className="btn btn-primary">Confirm & submit</button>
                  : <button className="btn btn-outline" disabled>Awaiting Director sign-off</button>}
          </div>
        </div>
        <div className="detail-meta-row">
          <div><div className="detail-meta-label">Bid Value</div><div className="detail-meta-value">{fmtMoney(bid.value, bid.currency)}</div></div>
          <div><div className="detail-meta-label">Win Probability</div><div className="detail-meta-value">{Math.round(bid.winProb*100)}%</div></div>
          <div><div className="detail-meta-label">Compile Time</div><div className="detail-meta-value">{bid.compileTime}</div></div>
          <div><div className="detail-meta-label">Assigned To</div><div className="detail-meta-value">{D.users[bid.assigned].name}</div></div>
        </div>
        <div style={{marginTop:16}}>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'#64748B', fontWeight:600, marginBottom:6}}>
            <span>HIL APPROVAL PROGRESS</span>
            <span>{Object.values(sectionStates).filter(s=>s==='approved').length} / 8 sections approved</span>
          </div>
          <div className="approval-progress">
            {D.sections.map(s => {
              const st = sectionStates[s.id];
              const cls = st==='approved'?'done':st==='flagged'?'flagged':st==='rejected'?'rejected':'current';
              return <div key={s.id} className={`progress-step ${cls}`} title={s.name}/>;
            })}
          </div>
        </div>
      </div>

      <div className="section-tabs">
        {D.sections.map(s => {
          const st = sectionStates[s.id];
          return (
            <button key={s.id} className={`section-tab ${activeSection===s.id?'active':''}`} onClick={()=>setActiveSection(s.id)}>
              {s.name}
              {st==='approved' && <span className="badge badge-success">{Icon.check(8)}</span>}
              {st==='flagged' && <span className="badge badge-warning">!</span>}
            </button>
          );
        })}
      </div>

      {activeSection === 'pricing' && (
        <PricingSection bid={bid} margin={margin} setMargin={setMargin}
          overrideRequested={overrideRequested} setOverrideRequested={setOverrideRequested}
          isDirector={isDirector} totalCost={totalCost} totalBid={totalBid}
          onApprove={()=>updateSection('pricing', 'approved')}
          status={sectionStates.pricing}/>
      )}
      {activeSection === 'risks' && (
        <RisksSection acks={acks} setAcks={setAcks} isDirector={isDirector}
          onApprove={()=>updateSection('risks', 'approved')} status={sectionStates.risks}/>
      )}
      {activeSection !== 'pricing' && activeSection !== 'risks' && (
        <GenericSection section={section} status={sectionStates[activeSection]} isDirector={isDirector}
          onApprove={()=>updateSection(activeSection, 'approved')}/>
      )}
    </div>
  );
}

// Pricing Review Panel (UI-04)
function PricingSection({ bid, margin, setMargin, overrideRequested, setOverrideRequested, isDirector, totalCost, totalBid, onApprove, status }) {
  const D = window.BID_DATA;
  return (
    <div>
      <div className="card mb-16">
        <div className="card-header">
          <div>
            <div className="card-title">{Icon.pound(14)} Pricing Review · {bid.currency}</div>
            <div className="card-sub">Rate card applied · 18 lines · margin overrides logged per BR-003</div>
          </div>
          <div style={{display:'flex', gap:8}}>
            {status === 'approved'
              ? <span className="badge badge-success">{Icon.check(10)} Section approved</span>
              : isDirector
                ? <button className="btn btn-success btn-sm" onClick={onApprove}>{Icon.check(11)} Approve section</button>
                : <span className="badge badge-primary">Awaiting Director</span>}
          </div>
        </div>

        {overrideRequested && (
          <div style={{padding:'10px 20px', background:'#FFF7ED', borderBottom:'1px solid #FED7AA', color:'#9A3412', fontSize:12.5, display:'flex', alignItems:'center', gap:10}}>
            {Icon.alert(14)}
            <strong>Override pending Bid Manager confirmation.</strong>
            Margin change 20% → {margin}% on 4 pipeline tasks. New bid total {fmtMoney(totalBid, bid.currency)}.
            <span className="spacer"/>
            {!isDirector && <button className="btn btn-success btn-sm" onClick={()=>setOverrideRequested(false)}>{Icon.check(10)} Confirm override</button>}
          </div>
        )}

        <div className="card-pad" style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14}}>
          <div className="kpi k-cyan" style={{margin:0}}>
            <div className="kpi-label">Total Cost</div>
            <div className="kpi-value">{fmtMoney(totalCost, bid.currency)}</div>
            <div className="kpi-meta">12 tasks · 3 roles · 676h</div>
          </div>
          <div className="kpi" style={{margin:0}}>
            <div className="kpi-label">Bid Price</div>
            <div className="kpi-value">{fmtMoney(totalBid, bid.currency)}</div>
            <div className="kpi-meta">After margin · {bid.currency}</div>
          </div>
          <div className="kpi k-pink" style={{margin:0}}>
            <div className="kpi-label">Effective Margin</div>
            <div className="kpi-value">{((totalBid/totalCost - 1)*100).toFixed(1)}%</div>
            <div className="kpi-meta">{margin !== bid.margin && <span className="badge badge-warning" style={{fontSize:10}}>override</span>}</div>
          </div>
        </div>

        {isDirector && (
          <div style={{padding:'14px 20px', borderTop:'1px solid #E2E8F0', background:'#FAFBFD', display:'flex', alignItems:'center', gap:14}}>
            <div style={{fontSize:12, fontWeight:600, color:'#475569'}}>Adjust margin (Pipeline Build & ML lines)</div>
            <input type="range" min="18" max="32" step="1" value={margin} onChange={e=>{setMargin(+e.target.value); setOverrideRequested(true);}} style={{flex:1}}/>
            <div style={{fontSize:14, fontWeight:700, color:'#5929d0', minWidth:50, textAlign:'right'}}>{margin}%</div>
            {margin !== bid.margin && <span className="badge badge-warning" style={{fontSize:10}}>{Icon.flag(10)} Override workflow active</span>}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Line items</div>
          <div className="card-sub">{D.pricingLines.length} lines · grouped by task</div>
        </div>
        <table className="dt" style={{borderRadius:0, border:'none'}}>
          <thead>
            <tr><th>Task</th><th>Role</th><th className="num">Rate</th><th className="num">Hours</th><th className="num">Margin</th><th className="num">Subtotal</th></tr>
          </thead>
          <tbody>
            {D.pricingLines.map((l, i) => {
              const overridden = (l.task.includes('Pipeline Build — Transformation') || l.task.includes('ML')) && margin !== bid.margin;
              const useM = overridden ? margin : l.margin;
              const subtotal = l.rate * l.hours * (1 + useM/100);
              return (
                <tr key={i}>
                  <td><strong>{l.task}</strong></td>
                  <td>{l.role}</td>
                  <td className="num">£{l.rate.toLocaleString()}</td>
                  <td className="num">{l.hours}</td>
                  <td className="num">{useM}% {overridden && <span className="badge badge-pink" style={{fontSize:9, marginLeft:4}}>O</span>}</td>
                  <td className="num"><strong>£{Math.round(subtotal).toLocaleString()}</strong></td>
                </tr>
              );
            })}
            <tr style={{background:'#FAFBFD', fontWeight:700}}>
              <td colSpan="5" style={{textAlign:'right'}}>Bid Total</td>
              <td className="num"><strong style={{color:'#5929d0'}}>£{Math.round(totalBid).toLocaleString()}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Risks Review (UI-05)
function RisksSection({ acks, setAcks, isDirector, onApprove, status }) {
  const D = window.BID_DATA;
  const high = D.risks.filter(r => r.sev === 'High');
  const allHighAcked = high.every(r => acks[r.id] || r.ack);
  return (
    <div>
      <div className="card mb-16">
        <div className="card-header">
          <div>
            <div className="card-title">{Icon.alert(14)} Risk Register · {D.risks.length} risks · {high.length} High-rated</div>
            <div className="card-sub">High-severity risks require explicit Bid Director acknowledgement (BR-005)</div>
          </div>
          <div>
            {status === 'approved'
              ? <span className="badge badge-success">{Icon.check(10)} Approved</span>
              : isDirector
                ? <button className="btn btn-success btn-sm" disabled={!allHighAcked} onClick={onApprove}>
                    {allHighAcked ? <span>{Icon.check(11)} Approve section</span> : `Ack ${high.length} High first`}
                  </button>
                : <span className="badge badge-primary">Awaiting Director</span>}
          </div>
        </div>
        <div style={{padding:'14px 20px'}}>
          <div style={{display:'flex', gap:14, marginBottom:16}}>
            <div className="kpi k-success" style={{margin:0, flex:1}}>
              <div className="kpi-label">Coverage</div>
              <div className="kpi-value">{Math.round((D.risks.filter(r=>r.owner!=='—').length/D.risks.length)*100)}%</div>
              <div className="kpi-meta">{D.risks.filter(r=>r.owner==='—').length} missing owner</div>
            </div>
            <div className="kpi k-pink" style={{margin:0, flex:1}}>
              <div className="kpi-label">High Severity</div>
              <div className="kpi-value">{high.length}</div>
              <div className="kpi-meta">{high.filter(r=>acks[r.id]||r.ack).length} acknowledged</div>
            </div>
            <div className="kpi k-warning" style={{margin:0, flex:1}}>
              <div className="kpi-label">Categories</div>
              <div className="kpi-value">{new Set(D.risks.map(r=>r.cat)).size}</div>
              <div className="kpi-meta">Data, Compliance, ML, Schedule…</div>
            </div>
          </div>
          <table className="dt">
            <thead><tr><th>ID</th><th>Risk</th><th>Cat</th><th>P</th><th>I</th><th>Sev</th><th>Mitigation</th><th>Owner</th><th>Ack</th></tr></thead>
            <tbody>
              {D.risks.map(r => {
                const acked = acks[r.id] || r.ack;
                return (
                  <tr key={r.id} style={{background: r.sev==='High' && !acked ? '#FEF2F2' : 'transparent'}}>
                    <td><strong>{r.id}</strong></td>
                    <td style={{maxWidth:240, lineHeight:1.4}}>{r.desc}</td>
                    <td><span className="badge badge-neutral" style={{fontSize:10}}>{r.cat}</span></td>
                    <td>{r.prob}</td><td>{r.impact}</td>
                    <td><span className={`badge ${r.sev==='High'?'badge-error':r.sev==='Medium'?'badge-warning':'badge-success'}`} style={{fontSize:10}}>{r.sev}</span></td>
                    <td style={{maxWidth:220, fontSize:11.5, color:'#475569'}}>{r.mit}</td>
                    <td>{r.owner==='—' ? <span className="badge badge-error" style={{fontSize:10}}>missing</span> : r.owner}</td>
                    <td>
                      {r.sev !== 'High' ? <span className="muted" style={{fontSize:11}}>—</span>
                        : acked
                          ? <span className="badge badge-success" style={{fontSize:10}}>{Icon.check(9)} ack</span>
                          : isDirector
                            ? <button className="btn btn-outline btn-sm" onClick={()=>setAcks(p=>({...p, [r.id]: true}))}>ack</button>
                            : <span className="badge badge-warning" style={{fontSize:10}}>req</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GenericSection({ section, status, isDirector, onApprove }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{section.name}</div>
          <div className="card-sub">{section.sub}</div>
        </div>
        <div>
          {status === 'approved'
            ? <span className="badge badge-success">{Icon.check(10)} Approved</span>
            : isDirector
              ? <button className="btn btn-success btn-sm" onClick={onApprove}>{Icon.check(11)} Approve section</button>
              : <span className="badge badge-primary">Awaiting Director</span>}
        </div>
      </div>
      <div className="card-pad">
        {status === 'flagged' && (
          <div className="flag-row" style={{marginBottom:14}}>
            {Icon.flag(13)}
            Section has open flags from upstream compilation. Review highlighted items before approval.
          </div>
        )}
        <SectionContent section={section}/>
      </div>
    </div>
  );
}

function SectionContent({ section }) {
  // Realistic content per section (effort, schedule etc.)
  if (section.id === 'effort') {
    const rows = [
      ['T-01','Discovery & Requirements','Solution Architect',40,0.92],
      ['T-02','Discovery & Requirements','Business Analyst',60,0.88],
      ['T-03','Data Source Mapping','Data Engineer',80,0.81],
      ['T-04','Data Source Mapping','Solution Architect',24,0.58],
      ['T-05','Reference Architecture','Solution Architect',48,0.84],
      ['T-06','Pipeline Build — Ingestion','Data Engineer',96,0.79],
      ['T-07','Pipeline Build — Transformation','Data Engineer',80,0.82],
      ['T-08','ML Feature Engineering','ML Engineer',56,0.75],
      ['T-09','Model Training & Validation','ML Engineer',72,0.61],
      ['T-10','API Layer & Integration','Backend Engineer',64,0.86],
      ['T-11','Compliance & Audit','Compliance Engineer',32,0.90],
      ['T-12','UAT Support & Handover','Solution Architect',24,0.88]
    ];
    return (
      <table className="dt">
        <thead><tr><th>Task</th><th>Description</th><th>Role</th><th className="num">Hours</th><th className="num">Confidence</th></tr></thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={i} style={{background: r[4]<0.65?'#FFFBEB':'transparent'}}>
              <td><strong>{r[0]}</strong></td>
              <td>{r[1]}</td>
              <td>{r[2]}</td>
              <td className="num">{r[3]}h</td>
              <td className="num">
                <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
                  {r[4].toFixed(2)}
                  {r[4]<0.65 && <span className="badge badge-warning" style={{fontSize:9}}>{Icon.flag(8)} low</span>}
                </span>
              </td>
            </tr>
          ))}
          <tr style={{background:'#FAFBFD', fontWeight:700}}>
            <td colSpan="3" style={{textAlign:'right'}}>Total</td>
            <td className="num">676h</td>
            <td className="num">avg 0.80</td>
          </tr>
        </tbody>
      </table>
    );
  }
  if (section.id === 'schedule') {
    const phases = [
      { name:'Discovery', weeks:[1,2,3], color:'#5929d0' },
      { name:'Build', weeks:[4,5,6,7,8,9,10], color:'#22D3EE' },
      { name:'UAT & Handover', weeks:[11,12,13,14], color:'#CF008B' }
    ];
    return (
      <div>
        <div className="flag-row" style={{marginBottom:14}}>
          {Icon.alert(13)} Resource conflict — Solution Architect double-booked, week 6. Bid Director resolution required.
        </div>
        <div style={{display:'grid', gridTemplateColumns:'140px repeat(14, 1fr)', gap:4, alignItems:'center', fontSize:11}}>
          <div style={{fontWeight:600, color:'#94A3B8'}}>Phase</div>
          {Array.from({length:14}, (_,i)=>(<div key={i} style={{textAlign:'center', color:'#94A3B8', fontSize:9.5}}>W{i+1}</div>))}
          {phases.map((p,pi)=>(
            <React.Fragment key={pi}>
              <div style={{fontWeight:600, fontSize:12}}>{p.name}</div>
              {Array.from({length:14}, (_,i)=>(
                <div key={i} style={{height:24, background: p.weeks.includes(i+1) ? p.color : '#F1F5F9', borderRadius:4, position:'relative'}}>
                  {i===5 && pi===1 && <span title="Conflict" style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11}}>!</span>}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }
  if (section.id === 'deliverables') {
    const items = [
      ['DV-01','Solution Design Document','PDF + DOCX','Approved by Solution Architect','Centific Lead Architect'],
      ['DV-02','Production Data Pipelines','Source code + IaC','Pipelines pass acceptance test suite','Centific Data Lead'],
      ['DV-03','Trained ML Models','Versioned artefacts','Validation against held-out test set','Centific ML Lead'],
      ['DV-04','Compliance & Audit Pack','PDF','IG sign-off received from NHS DPO','Centific Compliance Lead'],
      ['DV-05','Operations Runbook','Confluence + PDF','Reviewed in joint NHS+Centific session','Centific Delivery Lead']
    ];
    return (
      <table className="dt">
        <thead><tr><th>ID</th><th>Deliverable</th><th>Format</th><th>Acceptance</th><th>Responsible</th></tr></thead>
        <tbody>
          {items.map((r,i)=>(
            <tr key={i}><td><strong>{r[0]}</strong></td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td>{r[4]}</td></tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (section.id === 'dependencies') {
    const items = [
      ['DP-01','NHS Digital DPO IG sign-off','External','Discovery phase completion','NHS DPO'],
      ['DP-02','Trust EHR data extract feed','External','Pipeline ingestion start','Trust IT (per ICB)'],
      ['DP-03','HSCN network access provisioning','External','Production go-live','NHS Digital Networks'],
      ['DP-04','Internal Compliance review','Internal','Solution design freeze','Compliance Lead'],
      ['DP-05','Rate card sign-off (annual)','Internal','Bid submission','Bid Director'],
      ['DP-06','SC clearance for sub-contractors','Internal','Build start','People Ops'],
      ['DP-07','Cloud landing zone account','Internal','Pipeline build','Platform Team']
    ];
    return (
      <table className="dt">
        <thead><tr><th>ID</th><th>Dependency</th><th>Type</th><th>Linked to</th><th>Owner</th></tr></thead>
        <tbody>
          {items.map((r,i)=>(
            <tr key={i}><td><strong>{r[0]}</strong></td><td>{r[1]}</td><td><span className={`badge ${r[2]==='External'?'badge-pink':'badge-primary'}`} style={{fontSize:10}}>{r[2]}</span></td><td>{r[3]}</td><td>{r[4]}</td></tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (section.id === 'quality') {
    const items = [
      ['QS-01','ISO/IEC 27001 — Information Security','External audit certificate','Active certificate within scope','Document review'],
      ['QS-02','NHS Data Security & Protection Toolkit','Annual self-assessment','Standards Met','Toolkit submission'],
      ['QS-03','Cyber Essentials Plus','External assessment','Pass','Pen-test report'],
      ['QS-04','GDPR / UK Data Protection Act','DPIA + data flow map','DPIA approved by DPO','DPIA artefact'],
      ['QS-05','ISO 9001 — QMS','Annual surveillance audit','Active certificate','Document review'],
      ['QS-06','MLOps Quality Framework','Internal control library','100% control coverage','MLOps audit']
    ];
    return (
      <table className="dt">
        <thead><tr><th>Standard</th><th>Measurement</th><th>Target</th><th>Verification</th></tr></thead>
        <tbody>
          {items.map((r,i)=>(<tr key={i}><td><strong>{r[0]}</strong></td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td></tr>))}
        </tbody>
      </table>
    );
  }
  if (section.id === 'acceptance') {
    const items = [
      'Compiled clinical data flows match the documented data dictionary with zero unmapped fields.',
      'End-to-end pipeline latency for in-scope feeds is less than 90 minutes from source landing.',
      'Trained models meet or exceed the agreed AUC threshold of 0.82 on the held-out test set.',
      'All HSCN integrations pass NHS Digital security review before production cutover.',
      'Compliance pack (DPIA + IG approval + DSPT) is filed and acknowledged by NHS Digital.',
      'Operations runbook reviewed and signed off by NHS Digital Service Operations Lead.',
      'Centific delivers training to two cohorts of NHS Trust users (≤25 attendees each).',
      'Knowledge transfer artefacts delivered and reviewed in a joint handover workshop.',
      'Hypercare period of 30 calendar days post go-live with a defined SLA.'
    ];
    return (
      <ol style={{margin:0, paddingLeft:24, fontSize:13, lineHeight:1.7, color:'#1E293B'}}>
        {items.map((t,i)=>(<li key={i} style={{marginBottom:6}}>{t}</li>))}
      </ol>
    );
  }
  return <div style={{color:'#64748B'}}>Compiled content for {section.name}.</div>;
}

// AUDIT LOG
function AuditView({ user }) {
  // [timestamp, bidRef, section, actionType, originalValue, revisedValue, reviewer, details]
  const entries = [
    ['2026-04-25 09:14:02','BID-2026-041','Pricing','Compiled','—','Total £105,000','Bid Engine','Initial pricing draft from rate card'],
    ['2026-04-25 09:18:44','BID-2026-041','Schedule','Flagged','—','Resource conflict W6','Bid Engine','BR-002 conflict: ML Engineer over-allocated'],
    ['2026-04-25 09:31:12','BID-2026-041','Pricing','Override','20% margin','22% margin','Priya Menon','BR-003 margin override applied'],
    ['2026-04-25 09:34:08','BID-2026-041','Pricing','Confirm Override','£105,000','£107,140','Arjun Kapoor','Director sign-off on margin variance'],
    ['2026-04-25 09:42:51','BID-2026-041','Risks','Acknowledge','—','R-01 acknowledged','Priya Menon','BR-005 high-risk ack — vendor delay'],
    ['2026-04-25 09:48:19','BID-2026-041','Risks','Acknowledge','—','R-02 acknowledged','Priya Menon','BR-005 high-risk ack — data access'],
    ['2026-04-25 09:49:30','BID-2026-041','Feedback','Loop entry','—','R-05 owner gap → RFP Solution','Bid Engine','BR-006 corrective feedback dispatched'],
    ['2026-04-25 10:02:12','BID-2026-040','Validation','Input received','—','Talent Alignment payload','Bid Engine','BR-001 input registered'],
    ['2026-04-25 10:14:55','BID-2026-038','Submission','Approved','7/8','8/8 sections','Priya Menon','Final HIL approval gate cleared'],
    ['2026-04-25 10:24:01','BID-2026-038','Submission','Confirmed','—','DHL portal submitted','Arjun Kapoor','External submission receipt #DHL-RFP-2026-0411']
  ];
  return (
    <div>
      <div className="page-banner" style={{background:'linear-gradient(90deg, #001427 0%, #0E2E89 50%, #5929d0 100%)'}}>
        <div className="page-banner-dot"/>
        <div className="page-banner-text">
          <div className="page-banner-title">Audit Log & Correction History</div>
          <div className="page-banner-sub">Append-only · 7-year retention · BR-005, BR-006, AC-10 compliance</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn">Export CSV</button>
          <button className="page-banner-btn primary">Filter</button>
        </div>
      </div>
      <div className="toolbar">
        <div className="toolbar-search">{Icon.search(14)}<input placeholder="Search bid ID, section, action, reviewer…"/></div>
        <button className="filter-pill active">All actions <span className="count">{entries.length}</span></button>
        <button className="filter-pill">Overrides <span className="count">2</span></button>
        <button className="filter-pill">Approvals <span className="count">3</span></button>
        <button className="filter-pill">Feedback loop <span className="count">1</span></button>
      </div>
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <table className="dt" style={{borderRadius:0, border:'none'}}>
          <thead>
            <tr>
              <th style={{width:140}}>Timestamp (UTC)</th>
              <th>Bid Ref</th>
              <th>Section</th>
              <th>Action Type</th>
              <th>Original Value</th>
              <th>Revised Value</th>
              <th>Reviewer</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e,i)=>(
              <tr key={i}>
                <td style={{fontFamily:'ui-monospace, monospace', fontSize:11, color:'#475569', whiteSpace:'nowrap'}}>{e[0]}</td>
                <td><strong style={{fontSize:11.5, color:'#5929d0', fontFamily:'ui-monospace, monospace'}}>{e[1]}</strong></td>
                <td><span className="badge badge-neutral" style={{fontSize:10}}>{e[2]}</span></td>
                <td><strong style={{fontSize:11.5, fontWeight:600}}>{e[3]}</strong></td>
                <td style={{fontSize:11.5, color: e[4]==='—' ? '#CBD5E1':'#475569'}}>{e[4]}</td>
                <td style={{fontSize:11.5, color:'#0F172A', fontWeight:500}}>{e[5]}</td>
                <td style={{fontSize:11.5, color:'#475569'}}>{e[6]}</td>
                <td style={{fontSize:11, color:'#64748B'}}>{e[7]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.BidsList = BidsList;
window.BidDetail = BidDetail;
window.AuditView = AuditView;
