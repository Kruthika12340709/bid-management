// BRD-aligned screens: UI-01 Input Validation, UI-02 Compilation View,
// UI-04 Pricing Panel (standalone), UI-05 Risk Panel (standalone),
// HIL Approval Queue, Pipeline, Reports R-01..R-06

const { useState: bUseState } = React;

// ─────────────────────────────────────────────
// PIPELINE (full bid pipeline view, separate from "Bids" working list)
function PipelineScreen({ user, onOpenBid }) {
  const D = window.BID_DATA;
  const [stageFilter, setStageFilter] = bUseState('all');
  const stages = D.stages;
  const counts = stages.reduce((acc, s) => ({...acc, [s.key]: D.bids.filter(b=>b.stage===s.key).length}), {});

  let visible = D.bids;
  if (stageFilter !== 'all') visible = visible.filter(b=>b.stage===stageFilter);

  return (
    <div>
      <div className="page-banner" style={{background:'linear-gradient(90deg, #5929d0 0%, #8b3fb8 50%, #CF008B 100%)'}}>
        <div className="page-banner-dot"/>
        <div className="page-banner-text">
          <div className="page-banner-title">Bid Pipeline · UI-08</div>
          <div className="page-banner-sub">All bids across all pipeline stages — RFP reference, value, deadline, days remaining</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn">Export</button>
        </div>
      </div>

      {/* Stage funnel */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:10, marginBottom:18}}>
        <button onClick={()=>setStageFilter('all')} className={`stage-tile ${stageFilter==='all'?'active':''}`}>
          <div style={{fontSize:11, color:'#64748B'}}>All stages</div>
          <div style={{fontSize:24, fontWeight:700, color:'#0F172A'}}>{D.bids.length}</div>
        </button>
        {stages.map(s => (
          <button key={s.key} onClick={()=>setStageFilter(s.key)} className={`stage-tile ${stageFilter===s.key?'active':''}`}>
            <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:2}}>
              <span style={{width:8, height:8, borderRadius:'50%', background:s.color}}/>
              <span style={{fontSize:11, color:'#64748B', fontWeight:500}}>{s.label}</span>
            </div>
            <div style={{fontSize:24, fontWeight:700, color:'#0F172A'}}>{counts[s.key]||0}</div>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">{visible.length} bids · {stageFilter==='all'?'all stages':stages.find(s=>s.key===stageFilter)?.label}</div>
          <div style={{fontSize:11, color:'#64748B'}}>Sorted by deadline</div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Bid ID</th><th>Client / RFP</th><th>Value</th><th>Stage</th>
              <th>Sections</th><th>Flags</th><th>Deadline</th><th>Owner</th><th></th>
            </tr>
          </thead>
          <tbody>
            {visible.sort((a,b)=>a.daysLeft-b.daysLeft).map(b => {
              const stg = stages.find(s=>s.key===b.stage);
              const totalFlags = b.flags.lowConf + b.flags.conflicts + b.flags.missingRate + b.flags.highRisk;
              const owner = D.users[b.assigned];
              return (
                <tr key={b.id} onClick={()=>onOpenBid(b)} style={{cursor:'pointer'}}>
                  <td style={{fontFamily:'ui-monospace, monospace', fontSize:11.5, color:'#5929d0', fontWeight:600}}>{b.id}</td>
                  <td>
                    <div style={{fontWeight:600, color:'#0F172A'}}>{b.client}</div>
                    <div style={{fontSize:11, color:'#64748B'}}>{b.rfp} · {b.title.split('—')[1]?.trim() || b.title}</div>
                  </td>
                  <td style={{fontWeight:600}}>{b.currency==='GBP'?'£':'€'}{(b.value/1000).toFixed(0)}k</td>
                  <td><span className="badge" style={{background:stg.color+'22', color:stg.color, fontWeight:600}}>{stg.label}</span></td>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:6}}>
                      <div style={{width:60, height:5, background:'#E2E8F0', borderRadius:3, overflow:'hidden'}}>
                        <div style={{width:`${(b.sectionsComplete/b.sectionsTotal)*100}%`, height:'100%', background:'#5929d0'}}/>
                      </div>
                      <span style={{fontSize:11, color:'#64748B'}}>{b.sectionsComplete}/{b.sectionsTotal}</span>
                    </div>
                  </td>
                  <td>{totalFlags===0
                    ? <span style={{fontSize:11, color:'#16A34A', fontWeight:600}}>clean</span>
                    : <span className="badge badge-warning">{totalFlags} flag{totalFlags!==1?'s':''}</span>}
                  </td>
                  <td>
                    <div style={{fontSize:12, fontWeight:600, color: b.daysLeft<=5 && b.stage!=='submitted'?'#DC2626':'#0F172A'}}>
                      {b.daysLeft<0?`${-b.daysLeft}d ago`:`${b.daysLeft} days`}
                    </div>
                    <div style={{fontSize:10.5, color:'#94A3B8'}}>{new Date(b.deadline).toLocaleDateString('en-GB',{day:'2-digit', month:'short'})}</div>
                  </td>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:6}}>
                      <div className={`user-avatar ${owner.avatarClass}`} style={{width:24, height:24, fontSize:10}}>{owner.initials}</div>
                      <span style={{fontSize:11.5, color:'#475569'}}>{owner.name.split(' ')[0]}</span>
                    </div>
                  </td>
                  <td><span style={{color:'#94A3B8'}}>›</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// HIL APPROVAL QUEUE (UI-03 — Director primary, Manager co-approve / co-review)
function HILQueue({ user, onOpenBid }) {
  const D = window.BID_DATA;
  const isDirector = user.id==='director';
  const queue = D.bids.filter(b=>b.stage==='pending').sort((a,b)=>a.daysLeft-b.daysLeft);

  return (
    <div>
      <div className="page-banner" style={{background:'linear-gradient(90deg, #CF008B 0%, #8b3fb8 50%, #5929d0 100%)'}}>
        <div className="page-banner-dot"/>
        <div className="page-banner-text">
          <div className="page-banner-title">Interactive HIL Approval — UI-03 · {queue.length} awaiting</div>
          <div className="page-banner-sub">{isDirector ? 'Bid Director — primary approval gate (BR-002, BR-003, BR-005)' : 'Bid Manager — co-review and override secondary confirmation'}</div>
        </div>
      </div>

      {/* SLA window */}
      <div className="card" style={{marginBottom:18, background:'linear-gradient(135deg,#FFF7ED,#FEF3C7)', border:'1px solid #FCD34D'}}>
        <div className="card-pad" style={{display:'flex', alignItems:'center', gap:14}}>
          <div style={{width:38, height:38, borderRadius:10, background:'#F59E0B', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center'}}>{Icon.clock(18)}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13, fontWeight:700, color:'#92400E'}}>SLA · approval cycle target ≤ 4h</div>
            <div style={{fontSize:11.5, color:'#78350F', marginTop:2}}>2 of {queue.length} bids exceed the 4h SLA · oldest in-queue: 6h 14m</div>
          </div>
          <button className="btn btn-outline btn-sm">View SLA report</button>
        </div>
      </div>

      <div style={{display:'grid', gap:14}}>
        {queue.map(b => {
          const totalFlags = b.flags.lowConf + b.flags.conflicts + b.flags.missingRate + b.flags.highRisk;
          return (
            <div key={b.id} className="card" style={{cursor:'pointer'}} onClick={()=>onOpenBid(b)}>
              <div className="card-pad" style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr auto', gap:18, alignItems:'center'}}>
                <div>
                  <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
                    <span style={{fontFamily:'ui-monospace, monospace', fontSize:11, color:'#5929d0', fontWeight:600}}>{b.id}</span>
                    {b.daysLeft<=5 && <span className="badge badge-error">⏱ {b.daysLeft}d</span>}
                    {b.flags.highRisk>0 && <span className="badge badge-error">{b.flags.highRisk} High risk</span>}
                  </div>
                  <div style={{fontSize:14, fontWeight:700, color:'#0F172A'}}>{b.title}</div>
                  <div style={{fontSize:11.5, color:'#64748B', marginTop:2}}>{b.client} · {b.rfp}</div>
                </div>
                <div>
                  <div style={{fontSize:10, color:'#94A3B8', textTransform:'uppercase', letterSpacing:0.5}}>Bid value</div>
                  <div style={{fontSize:18, fontWeight:700, color:'#0F172A'}}>{b.currency==='GBP'?'£':'€'}{(b.value/1000).toFixed(0)}k</div>
                  <div style={{fontSize:11, color:'#64748B'}}>Margin {b.currentMargin}%</div>
                </div>
                <div>
                  <div style={{fontSize:10, color:'#94A3B8', textTransform:'uppercase', letterSpacing:0.5}}>Sections</div>
                  <div style={{fontSize:18, fontWeight:700, color:'#0F172A'}}>{b.sectionsComplete}/{b.sectionsTotal}</div>
                  <div style={{fontSize:11, color: totalFlags?'#DC2626':'#16A34A'}}>{totalFlags?`${totalFlags} flag${totalFlags!==1?'s':''}`:'clean'}</div>
                </div>
                <div>
                  <div style={{fontSize:10, color:'#94A3B8', textTransform:'uppercase', letterSpacing:0.5}}>Reviewer</div>
                  <div style={{display:'flex', alignItems:'center', gap:6, marginTop:4}}>
                    <div className={`user-avatar ${D.users[b.assigned].avatarClass}`} style={{width:24, height:24, fontSize:10}}>{D.users[b.assigned].initials}</div>
                    <span style={{fontSize:12, color:'#0F172A', fontWeight:600}}>{D.users[b.assigned].name.split(' ')[0]}</span>
                  </div>
                </div>
                <button className="btn btn-primary btn-sm">{isDirector?'Review & approve':'Open for co-review'} {Icon.arrow(11)}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// INPUT VALIDATION DASHBOARD (UI-01 — Bid Manager)
function InputValidationScreen({ user }) {
  const inputs = [
    { id:'BID-2026-039', client:'Centrica plc', cat:[
      { name:'RFP/RFQ document', status:'received', meta:'2026-04-22 · 4 attachments'},
      { name:'Effort estimation', status:'received', meta:'480h · v3'},
      { name:'Schedule', status:'pending', meta:'requested 2026-04-23'},
      { name:'Quality framework', status:'received', meta:'standard'},
      { name:'Deliverables', status:'received', meta:'5 outputs'},
      { name:'Risks & deps', status:'flagged', meta:'2 missing owners'},
      { name:'Pricing inputs', status:'pending', meta:'awaiting role rates'},
      { name:'Acceptance criteria', status:'received', meta:'9 conditions'}
    ]},
    { id:'BID-2026-040', client:'BNP Paribas', cat:[
      { name:'RFP/RFQ document', status:'received', meta:'2026-04-20'},
      { name:'Effort estimation', status:'received', meta:'320h · v2'},
      { name:'Schedule', status:'received', meta:'12 milestones'},
      { name:'Quality framework', status:'received', meta:'banking-grade'},
      { name:'Deliverables', status:'received', meta:'6 outputs'},
      { name:'Risks & deps', status:'received', meta:'7 risks'},
      { name:'Pricing inputs', status:'flagged', meta:'1 missing rate (Compliance Engineer)'},
      { name:'Acceptance criteria', status:'received', meta:'12 conditions'}
    ]}
  ];

  const statusStyle = {
    received: { bg:'#DCFCE7', fg:'#16A34A', label:'Received' },
    pending:  { bg:'#FEF3C7', fg:'#92400E', label:'Pending' },
    flagged:  { bg:'#FEE2E2', fg:'#DC2626', label:'Flagged' }
  };

  return (
    <div>
      <div className="page-banner" style={{background:'linear-gradient(90deg, #06B6D4 0%, #5929d0 60%, #CF008B 100%)'}}>
        <div className="page-banner-dot"/>
        <div className="page-banner-text">
          <div className="page-banner-title">Input Validation Dashboard · UI-01</div>
          <div className="page-banner-sub">Upstream input status per active bid · BR-001 (8 input categories must be present before compilation can start)</div>
        </div>
      </div>

      {inputs.map(b => {
        const total = b.cat.length;
        const received = b.cat.filter(c=>c.status==='received').length;
        const flagged = b.cat.filter(c=>c.status==='flagged').length;
        const ready = received === total && flagged === 0;
        return (
          <div key={b.id} className="card" style={{marginBottom:14}}>
            <div className="card-header">
              <div>
                <div className="card-title">{b.client}</div>
                <div style={{fontSize:11, color:'#64748B'}}>{b.id} · {received}/{total} received{flagged?` · ${flagged} flagged`:''}</div>
              </div>
              <span className={`badge ${ready?'badge-success':'badge-warning'}`}>{ready?'Ready to compile':'Not yet eligible'}</span>
            </div>
            <div style={{padding:'14px 20px', display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10}}>
              {b.cat.map(c => {
                const st = statusStyle[c.status];
                return (
                  <div key={c.name} style={{padding:10, border:'1px solid #E2E8F0', borderRadius:8, background:'#FAFBFD'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:6, marginBottom:4}}>
                      <div style={{fontSize:12, fontWeight:600, color:'#0F172A'}}>{c.name}</div>
                      <span style={{fontSize:9.5, fontWeight:700, padding:'2px 6px', borderRadius:4, background:st.bg, color:st.fg, textTransform:'uppercase'}}>{st.label}</span>
                    </div>
                    <div style={{fontSize:11, color:'#64748B'}}>{c.meta}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPILATION VIEW (UI-02 — Bid Manager)
function CompilationScreen({ user, onOpenBid }) {
  const D = window.BID_DATA;
  const compiling = D.bids.find(b=>b.stage==='compiling') || D.bids[0];
  const stages = [
    { name:'Inputs received', status:'done', t:'09:02:14' },
    { name:'Effort estimation', status:'done', t:'09:04:31', detail:'480h aggregated · 2 low-confidence flags' },
    { name:'Schedule generation', status:'done', t:'09:06:55', detail:'14 milestones · 1 resource conflict' },
    { name:'Quality framework', status:'done', t:'09:08:02', detail:'6 standards applied' },
    { name:'Deliverables register', status:'done', t:'09:09:18', detail:'5 contracted outputs' },
    { name:'Pricing compilation', status:'running', t:'09:14:00', detail:'computing 18 lines · 3/12 tasks remaining' },
    { name:'Risk register', status:'pending', t:'—' },
    { name:'Acceptance map', status:'pending', t:'—' }
  ];

  return (
    <div>
      <div className="page-banner" style={{background:'linear-gradient(90deg, #06B6D4 0%, #5929d0 100%)'}}>
        <div className="page-banner-dot"/>
        <div className="page-banner-text">
          <div className="page-banner-title">Bid Compilation · UI-02 · {compiling.id}</div>
          <div className="page-banner-sub">{compiling.client} · {compiling.title.split('—')[1]?.trim()}  · BR-001 → BR-002 pipeline</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn" onClick={()=>onOpenBid(compiling)}>Open bid</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Compilation pipeline</div>
          <span className="badge badge-warning">Compiling · 5/8</span>
        </div>
        <div style={{padding:'16px 20px'}}>
          {stages.map((s, i) => (
            <div key={s.name} style={{display:'grid', gridTemplateColumns:'30px 1fr auto', gap:12, alignItems:'flex-start', padding:'10px 0', borderBottom:i<stages.length-1?'1px solid #F1F5F9':'none'}}>
              <div style={{
                width:24, height:24, borderRadius:'50%',
                background: s.status==='done'?'#16A34A':s.status==='running'?'#5929d0':'#E2E8F0',
                color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11
              }}>
                {s.status==='done' ? Icon.check(13) : s.status==='running' ? '●' : i+1}
              </div>
              <div>
                <div style={{fontSize:13, fontWeight:600, color:'#0F172A'}}>{s.name}</div>
                {s.detail && <div style={{fontSize:11.5, color:'#64748B', marginTop:2}}>{s.detail}</div>}
              </div>
              <div style={{fontFamily:'ui-monospace, monospace', fontSize:11, color: s.status==='running'?'#5929d0':'#94A3B8', fontWeight:600}}>{s.t}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:14}}>
        <div className="card">
          <div className="card-header"><div className="card-title">Compilation telemetry</div></div>
          <div style={{padding:'14px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
            {[
              { l:'Elapsed', v:'14m 22s' },
              { l:'Sources merged', v:'8 / 8' },
              { l:'Confidence (avg)', v:'0.78' },
              { l:'Flags raised', v:'3' }
            ].map(x => (
              <div key={x.l}>
                <div style={{fontSize:10, color:'#94A3B8', textTransform:'uppercase', letterSpacing:0.5}}>{x.l}</div>
                <div style={{fontSize:20, fontWeight:700, color:'#0F172A'}}>{x.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">Inputs feeding the pipeline</div></div>
          <div style={{padding:'8px 14px'}}>
            {['RFP/RFQ document','Effort estimation','Delivery schedule','Quality framework','Deliverables register','Risk register','Pricing inputs','Acceptance criteria'].map((x,i)=>(
              <div key={x} style={{display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:i<7?'1px solid #F1F5F9':'none', fontSize:12.5}}>
                <span style={{width:6, height:6, borderRadius:'50%', background:'#16A34A'}}/>
                <span style={{color:'#0F172A'}}>{x}</span>
                <span style={{marginLeft:'auto', fontSize:11, color:'#94A3B8'}}>received</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// REPORTS (R-01 .. R-06)
function ReportsScreen({ user }) {
  const reports = [
    { id:'R-01', name:'Bid Pipeline Status Report', desc:'All active bids across pipeline stages, with submission deadlines and days remaining.', cadence:'Live', color:'#5929d0' },
    { id:'R-02', name:'Compilation Quality Report', desc:'Sections flagged during compilation, flag types by section, HIL override rate by section.', cadence:'Weekly', color:'#CF008B' },
    { id:'R-03', name:'Pricing Variance Report', desc:'Compiled vs approved price per bid, margin override frequency, pricing variance trends.', cadence:'Monthly', color:'#16A34A' },
    { id:'R-04', name:'Approval & Correction Report', desc:'Approval cycle time per bid, sections most frequently corrected, correction volume by reviewer.', cadence:'Monthly', color:'#E4902E' },
    { id:'R-05', name:'Outcome & Conversion Report', desc:'Win/loss analysis: awarded, not awarded, pending. Winning price bands and outcome patterns.', cadence:'Monthly', color:'#06B6D4' },
    { id:'R-06', name:'Risk Profile Report', desc:'Aggregated risk view: count by category and severity, mitigation coverage, High-rated risk %.', cadence:'Monthly', color:'#DC2626' }
  ];

  return (
    <div>
      <div className="page-banner" style={{background:'linear-gradient(90deg, #5929d0 0%, #CF008B 100%)'}}>
        <div className="page-banner-dot"/>
        <div className="page-banner-text">
          <div className="page-banner-title">Reports & Analytics — R-01 through R-06</div>
          <div className="page-banner-sub">Business intelligence and performance metrics across the bid management lifecycle</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn">Schedule export</button>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:14}}>
        {reports.map(r => (
          <div key={r.id} className="card" style={{cursor:'pointer'}}>
            <div className="card-pad">
              <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:10}}>
                <div style={{width:36, height:36, borderRadius:8, background:r.color+'22', color:r.color, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:11}}>{r.id}</div>
                <div style={{fontSize:13.5, fontWeight:700, color:'#0F172A', flex:1}}>{r.name}</div>
              </div>
              <div style={{fontSize:11.5, color:'#475569', lineHeight:1.55, minHeight:50}}>{r.desc}</div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14, paddingTop:12, borderTop:'1px solid #F1F5F9'}}>
                <span className="badge" style={{background:r.color+'22', color:r.color, fontWeight:600}}>{r.cadence}</span>
                <span style={{fontSize:10.5, color:'#94A3B8'}}>Updated {r.cadence==='Live'?'just now':r.cadence==='Weekly'?'Mon 09:00':'1st of month'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sample report rendering — R-01 live preview */}
      <div className="card" style={{marginTop:18}}>
        <div className="card-header">
          <div>
            <div className="card-title">R-01 · Bid Pipeline Status — Live Preview</div>
            <div style={{fontSize:11, color:'#64748B'}}>{window.BID_DATA.bids.length} bids · grouped by stage · refreshed continuously</div>
          </div>
          <button className="btn btn-outline btn-sm">Export CSV</button>
        </div>
        <div style={{padding:'14px 20px'}}>
          {window.BID_DATA.stages.map(s => {
            const list = window.BID_DATA.bids.filter(b=>b.stage===s.key);
            if (!list.length) return null;
            return (
              <div key={s.key} style={{marginBottom:14}}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                  <span style={{width:8, height:8, borderRadius:'50%', background:s.color}}/>
                  <span style={{fontSize:12, fontWeight:700, color:'#0F172A'}}>{s.label}</span>
                  <span style={{fontSize:11, color:'#64748B'}}>· {list.length}</span>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8}}>
                  {list.map(b => (
                    <div key={b.id} style={{padding:'8px 12px', background:'#FAFBFD', border:'1px solid #E2E8F0', borderRadius:6, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <div>
                        <div style={{fontSize:11.5, fontWeight:600, color:'#0F172A'}}>{b.client}</div>
                        <div style={{fontSize:10.5, color:'#64748B', fontFamily:'ui-monospace, monospace'}}>{b.id}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:12, fontWeight:600, color: b.daysLeft<=5 && b.stage!=='submitted'?'#DC2626':'#0F172A'}}>{b.daysLeft<0?`${-b.daysLeft}d ago`:`${b.daysLeft}d`}</div>
                        <div style={{fontSize:10.5, color:'#94A3B8'}}>{b.currency==='GBP'?'£':'€'}{(b.value/1000).toFixed(0)}k</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PRICING PANEL (UI-04 standalone — pricing across active bids)
function PricingPanelScreen({ user, onOpenBid }) {
  const D = window.BID_DATA;
  const isDirector = user.id==='director';
  const focused = D.bids.find(b=>b.id==='BID-2026-041') || D.bids[0];
  const [margin, setMargin] = bUseState(focused.currentMargin);
  const totalCost = D.pricingLines.reduce((s,l)=>s+l.rate*l.hours,0);
  const totalBid = Math.round(totalCost / (1 - margin/100));

  return (
    <div>
      <div className="page-banner" style={{background:'linear-gradient(90deg, #16A34A 0%, #5929d0 100%)'}}>
        <div className="page-banner-dot"/>
        <div className="page-banner-text">
          <div className="page-banner-title">Pricing Review Panel · UI-04</div>
          <div className="page-banner-sub">{focused.id} · {focused.client} · BR-003 (margin override requires director approval) · Rate card RC-2026-Q2</div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:14, marginBottom:14}}>
        <div className="card">
          <div className="card-header"><div className="card-title">Margin slider — bid total recomputes live</div></div>
          <div className="card-pad">
            <div style={{display:'flex', alignItems:'baseline', gap:14, marginBottom:12}}>
              <div style={{fontSize:34, fontWeight:700, color:'#5929d0', letterSpacing:'-0.02em'}}>{margin}%</div>
              <div style={{fontSize:11.5, color:'#64748B'}}>compiled default {focused.margin}%</div>
            </div>
            <input type="range" min="15" max="35" value={margin} onChange={e=>setMargin(+e.target.value)} disabled={!isDirector} style={{width:'100%', accentColor:'#5929d0'}}/>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:10, color:'#94A3B8', marginTop:4}}>
              <span>15%</span><span>20%</span><span>25%</span><span>30%</span><span>35%</span>
            </div>
            {margin !== focused.margin && (
              <div style={{marginTop:12, padding:10, background:'#FFD6F4', border:'1px solid #CF008B', borderRadius:8, fontSize:11.5, color:'#9C006A'}}>
                <strong>BR-003 · Override required.</strong> {isDirector ? 'Submit will trigger Bid Manager secondary confirmation.' : 'Director-only — read-only for Bid Manager.'}
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">Bid totals</div></div>
          <div className="card-pad" style={{display:'grid', gap:12}}>
            <div style={{display:'flex', justifyContent:'space-between'}}>
              <span style={{fontSize:12, color:'#64748B'}}>Total cost (rates × hours)</span>
              <strong style={{color:'#0F172A'}}>£{totalCost.toLocaleString()}</strong>
            </div>
            <div style={{display:'flex', justifyContent:'space-between'}}>
              <span style={{fontSize:12, color:'#64748B'}}>Margin applied</span>
              <strong style={{color:'#5929d0'}}>{margin}%</strong>
            </div>
            <div style={{display:'flex', justifyContent:'space-between', borderTop:'1px solid #E2E8F0', paddingTop:10}}>
              <span style={{fontSize:13, fontWeight:600, color:'#0F172A'}}>Bid total</span>
              <strong style={{fontSize:18, color:'#0F172A'}}>£{totalBid.toLocaleString()}</strong>
            </div>
            <div style={{display:'flex', justifyContent:'space-between'}}>
              <span style={{fontSize:11, color:'#94A3B8'}}>Variance vs compiled</span>
              <span style={{fontSize:11, color: margin>focused.margin?'#16A34A':'#DC2626', fontWeight:600}}>
                {margin>focused.margin?'+':''}£{(totalBid - Math.round(totalCost/(1-focused.margin/100))).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Task-wise pricing — {D.pricingLines.length} lines</div>
          <span style={{fontSize:11, color:'#64748B'}}>BR-003 · BR-004</span>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Task</th><th>Role</th><th>Rate</th><th>Hours</th><th>Cost</th><th>Margin</th><th>Bid line</th></tr>
          </thead>
          <tbody>
            {D.pricingLines.map((l,i) => {
              const cost = l.rate*l.hours;
              const lineBid = Math.round(cost / (1 - margin/100));
              return (
                <tr key={i}>
                  <td>{l.task}</td>
                  <td>{l.role}</td>
                  <td>£{l.rate}</td>
                  <td>{l.hours}h</td>
                  <td>£{cost.toLocaleString()}</td>
                  <td><span className="badge" style={{background:'#E8E5FF', color:'#5929d0'}}>{margin}%</span></td>
                  <td style={{fontWeight:600}}>£{lineBid.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// RISK PANEL (UI-05 standalone)
function RiskPanelScreen({ user }) {
  const D = window.BID_DATA;
  const isDirector = user.id==='director';
  const high = D.risks.filter(r=>r.sev==='High');
  const med = D.risks.filter(r=>r.sev==='Medium');
  const low = D.risks.filter(r=>r.sev==='Low');
  const sevColor = { High:'#DC2626', Medium:'#E4902E', Low:'#16A34A' };

  return (
    <div>
      <div className="page-banner" style={{background:'linear-gradient(90deg, #DC2626 0%, #5929d0 100%)'}}>
        <div className="page-banner-dot"/>
        <div className="page-banner-text">
          <div className="page-banner-title">Risk & Dependency Review · UI-05</div>
          <div className="page-banner-sub">BR-005 · High-rated risks must be explicitly acknowledged before approval · BID-2026-041</div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:14, marginBottom:14}}>
        {[['High', high, '#DC2626'], ['Medium', med, '#E4902E'], ['Low', low, '#16A34A']].map(([lbl, list, c]) => (
          <div key={lbl} className="card">
            <div className="card-pad">
              <div style={{fontSize:11, color:'#64748B', textTransform:'uppercase', letterSpacing:0.5}}>{lbl} severity</div>
              <div style={{fontSize:30, fontWeight:700, color:c, letterSpacing:'-0.01em'}}>{list.length}</div>
              <div style={{fontSize:11.5, color:'#64748B'}}>{list.filter(r=>r.ack).length} acknowledged · {list.filter(r=>!r.ack).length} pending</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Risk register · {D.risks.length} risks</div>
          <span style={{fontSize:11, color:'#64748B'}}>3 external dependencies linked</span>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>ID</th><th>Description</th><th>Category</th><th>Sev</th><th>Mitigation</th><th>Owner</th><th>Ack</th></tr>
          </thead>
          <tbody>
            {D.risks.map(r => (
              <tr key={r.id}>
                <td style={{fontFamily:'ui-monospace, monospace', fontSize:11.5, color:'#5929d0', fontWeight:600}}>{r.id}</td>
                <td>{r.desc}</td>
                <td><span style={{fontSize:11, color:'#475569'}}>{r.cat}</span></td>
                <td><span className="badge" style={{background:sevColor[r.sev]+'22', color:sevColor[r.sev], fontWeight:600}}>{r.sev}</span></td>
                <td style={{fontSize:11.5, color:'#475569'}}>{r.mit}</td>
                <td>{r.owner==='—'
                  ? <span style={{color:'#DC2626', fontWeight:600, fontSize:11}}>Missing</span>
                  : <span style={{fontSize:11.5}}>{r.owner}</span>}</td>
                <td>{r.ack
                  ? <span className="badge badge-success">✓ ack'd</span>
                  : (r.sev==='High'
                    ? (isDirector ? <button className="btn btn-primary btn-sm">Ack BR-005</button> : <span style={{fontSize:10.5, color:'#94A3B8'}}>Director only</span>)
                    : <span style={{fontSize:10.5, color:'#94A3B8'}}>—</span>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.PipelineScreen = PipelineScreen;
window.HILQueue = HILQueue;
window.InputValidationScreen = InputValidationScreen;
window.CompilationScreen = CompilationScreen;
window.ReportsScreen = ReportsScreen;
window.PricingPanelScreen = PricingPanelScreen;
window.RiskPanelScreen = RiskPanelScreen;
