import { useEffect, useState } from 'react';
import { bidsApi, auditApi, inputsApi, reportsApi } from '../api/client';
import { adaptBid, adaptAuditEntry } from '../utils/adapt';

function poll(fetcher, deps, pollMs, setData, setError) {
  let alive = true;
  let timer = null;
  setError(null);
  const tick = () => fetcher()
    .then(d => { if (alive) setData(d); })
    .catch(e => {
      if (!alive) return;
      if (e?.name === 'AbortError' || e?.code === 'ERR_CANCELED') return;
      setError(e);
    });
  tick();
  if (pollMs > 0) timer = setInterval(tick, pollMs);
  return () => { alive = false; if (timer) clearInterval(timer); };
}

export function useBids(pollMs = 10000) {
  const [bids, setBids]     = useState(null);
  const [error, setError]   = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => poll(
    () => bidsApi.getAll().then(rows => rows.map(adaptBid)),
    [reload, pollMs], pollMs, setBids, setError
  ), [reload, pollMs]);
  return { bids, error, refresh: () => setReload(n => n + 1) };
}

export function useBidDetail(bidRef, pollMs = 5000) {
  const [bid, setBid]           = useState(null);
  const [sections, setSections] = useState(null);
  const [risks, setRisks]       = useState(null);
  const [error, setError]       = useState(null);
  const [reload, setReload]     = useState(0);

  useEffect(() => {
    if (!bidRef) return;
    let alive = true;
    let timer = null;
    setError(null);
    const tick = () => Promise.all([
      bidsApi.getById(bidRef),
      bidsApi.getSections(bidRef),
      bidsApi.getRisks(bidRef),
    ]).then(([b, s, r]) => {
      if (alive) { setBid(adaptBid(b)); setSections(s); setRisks(r); }
    }).catch(e => { if (alive) setError(e); });
    tick();
    if (pollMs > 0) timer = setInterval(tick, pollMs);
    return () => { alive = false; if (timer) clearInterval(timer); };
  }, [bidRef, reload, pollMs]);

  return { bid, sections, risks, error, refresh: () => setReload(n => n + 1) };
}

export function useAuditLog(params = {}, pollMs = 0) {
  const [entries, setEntries] = useState(null);
  const [error, setError]     = useState(null);
  const key = JSON.stringify(params);

  useEffect(() => {
    let alive = true;
    let timer = null;
    setError(null);
    const tick = () => auditApi.list(params)
      .then(rows => { if (alive) setEntries(rows.map(adaptAuditEntry)); })
      .catch(e => { if (alive) setError(e); });
    tick();
    if (pollMs > 0) timer = setInterval(tick, pollMs);
    return () => { alive = false; if (timer) clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pollMs]);

  return { entries, error };
}

export function useInputs(pollMs = 30000) {
  const [data, setData]   = useState(null);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => poll(
    () => inputsApi.list(),
    [reload, pollMs], pollMs, setData, setError
  ), [reload, pollMs]);
  return { data, error, refresh: () => setReload(n => n + 1) };
}

export function useDashboardMetrics(pollMs = 15000) {
  const [data, setData]   = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => poll(
    () => reportsApi.dashboard(),
    [pollMs], pollMs, setData, setError
  ), [pollMs]);
  return { data, error };
}
