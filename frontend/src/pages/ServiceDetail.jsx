import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [service, setService]     = useState(null);
  const [values, setValues]       = useState({});
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError]         = useState('');
  const [mode, setMode]           = useState('body');

  useEffect(() => {
    fetch('/api/services')
      .then(r => r.json())
      .then(data => {
        const found = data.services[id];
        if (!found) { setError('Servicio no encontrado'); return; }
        setService(found);
        const inicial = {};
        found.params.forEach(p => { inicial[p.name] = p.default ?? ''; });
        setValues(inicial);
      })
      .catch(() => setError('Error cargando el servicio'))
      .finally(() => setLoading(false));
  }, [id]);

  const queryUrl = service
    ? service.endpoint + '/?' + service.params
        .map(p => {
          const v = values[p.name] ?? '';
          const num = v !== '' && !isNaN(v) ? parseInt(v) : v;
          return `${p.name}=${num}`;
        })
        .join('&')
    : '';

  const handleExecute = async () => {
    const empty = service.params.filter(p => p.required && String(values[p.name]).trim() === '');
    if (empty.length > 0) { setError(`Completa: ${empty.map(p => p.name).join(', ')}`); return; }
    setError('');

    const converted = {};
    Object.entries(values).forEach(([k, v]) => {
      const trimmed = v.trim().replace(',', '.');
      if (trimmed === '') {
        converted[k] = v;
      } else if (!isNaN(trimmed) && !trimmed.endsWith('.')) {
        converted[k] = Number(trimmed);
      } else {
        converted[k] = trimmed;
      }
    });

    setExecuting(true);
    setResult(null);
    try {
     if (mode === 'query') {
  const queryString = Object.entries(converted)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const url = service.endpoint + '/?' + queryString;
  console.log('URL mandada al backend:', url);  
  console.log('valores converted:', converted);  
  const res = await fetch(url, { method: 'GET' });
  const data = await res.json();
  setResult(data);
}else {
        const res = await fetch(service.endpoint + '/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(converted),
        });
        const data = await res.json();
        setResult(data);
      }
    } catch {
      setError('Error al ejecutar el servicio.');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex items-center gap-3 text-slate-400">
        <svg className="w-5 h-5 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
          <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
        </svg>
        Cargando servicio…
      </div>
    </div>
  );

  if (!service) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400">
      {error || 'Servicio no encontrado'}
    </div>
  );

  const langColor = service.language === 'python'
    ? 'bg-blue-900/30 text-blue-300 border-blue-700/40'
    : 'bg-yellow-900/30 text-yellow-300 border-yellow-700/40';
  const langIcon = service.language === 'python' ? '🐍' : '🟨';
  const lines = (service.code || '').split('\n');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      <div className="border-b border-slate-800 px-8 py-5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            Volver
          </button>
          <div className="w-px h-5 bg-slate-700" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold font-mono">{service.name}</h1>
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${langColor}`}>
                  {langIcon} {service.language}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{service.endpoint}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 flex flex-col gap-5">

        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700/60">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/70" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <span className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <div className="w-px h-4 bg-slate-700" />
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-violet-500 rounded-full" />
                <span className="text-sm font-semibold text-slate-200">Código fuente</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-600 font-mono">{lines.length} líneas</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${langColor}`}>
                {langIcon} {service.language}
              </span>
            </div>
          </div>
          <div className="flex bg-slate-950 max-h-56 overflow-y-auto">
            <div className="select-none px-4 py-4 text-right font-mono text-xs text-slate-600 bg-slate-900/50 border-r border-slate-700/40 min-w-[3rem]">
              {lines.map((_, i) => <div key={i} className="leading-6">{i + 1}</div>)}
            </div>
            <pre className="flex-1 px-4 py-4 text-sm font-mono text-slate-300 leading-6 overflow-x-auto whitespace-pre">
              {service.code}
            </pre>
          </div>
        </div>

        <div className="flex gap-5">

          <div className="flex-1 bg-slate-900 border border-slate-700/60 rounded-2xl p-6 flex flex-col gap-4">

            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-cyan-500 rounded-full" />
              <h2 className="text-sm font-semibold text-slate-200">Parámetros</h2>
              <span className="text-xs text-slate-600 font-mono">
                {service.params.length} param{service.params.length !== 1 ? 's' : ''}
              </span>
              <div className="ml-auto flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
                <button
                  onClick={() => setMode('body')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    mode === 'body' ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Body
                </button>
                <button
                  onClick={() => setMode('query')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    mode === 'query' ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Query
                </button>
              </div>
            </div>

            {mode === 'query' && (
              <div className="bg-slate-950 border border-slate-700/40 rounded-lg px-3 py-2 flex items-start gap-2">
                <span className="text-xs text-slate-500 shrink-0 mt-0.5">URL:</span>
                <span
                  onClick={() => {
                    if (result === null) return;
                    const ventana = window.open('', '_blank');
                    ventana.document.write(`
                      <html>
                        <head><title>Resultado</title></head>
                        <body style="background:#020617;color:#34d399;font-family:monospace;padding:2rem;">
                          <pre>${JSON.stringify(result, null, 2)}</pre>
                        </body>
                      </html>
                    `);
                    ventana.document.close();
                  }}
                  className={`text-xs font-mono text-cyan-400 break-all ${result !== null ? 'hover:underline cursor-pointer' : 'cursor-default'}`}
                >
                  {queryUrl}
                </span>
              </div>
            )}

            {service.params.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">Sin parámetros</p>
            ) : (
              <div className="flex flex-col gap-3">
                {service.params.map((p, i) => (
                  <div key={p.name}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-slate-600 font-mono">{i + 1}.</span>
                      <label className="text-sm font-medium text-slate-300 font-mono">{p.name}</label>
                      {p.required && <span className="text-cyan-400 text-xs">requerido</span>}
                      {p.type && <span className="text-slate-600 text-xs ml-auto">({p.type})</span>}
                    </div>
                    <input
                      value={values[p.name] ?? ''}
                      onChange={e => { setValues(prev => ({ ...prev, [p.name]: e.target.value })); setError(''); }}
                      placeholder={p.default !== null ? `Default: ${p.default}` : `Ingresa ${p.name}…`}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-cyan-600 placeholder:text-slate-600 transition-colors"
                    />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                {error}
              </div>
            )}

            <button
              onClick={handleExecute}
              disabled={executing}
              className="mt-auto w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {executing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                    <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                  Ejecutando…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                  Ejecutar
                </>
              )}
            </button>
          </div>

          <div className="flex-1 bg-slate-900 border border-slate-700/60 rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-emerald-500 rounded-full" />
              <h2 className="text-sm font-semibold text-slate-200">Resultado</h2>
              {result !== null && (
                <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  OK
                </span>
              )}
            </div>

            {result === null ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-slate-700 gap-3">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <p className="text-sm">Ejecuta el servicio para ver el resultado</p>
              </div>
            ) : (
              <pre className="flex-1 bg-slate-950 border border-slate-700/40 rounded-xl p-4 text-sm font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}