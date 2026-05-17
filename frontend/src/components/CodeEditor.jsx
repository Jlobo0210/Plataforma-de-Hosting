import { useRef } from 'react';

const PLACEHOLDER = {
  PYTHON: `from flask import Flask\napp = Flask(__name__)\n\n@app.route('/')\ndef index():\n    return 'OK'\n\napp.run(host='0.0.0.0', port=5000)`,
  JAVASCRIPT: `const express = require('express');\nconst app = express();\n\napp.get('/', (req, res) => {\n  res.json({ status: 'ok' });\n});\n\napp.listen(3000);`,
};

export default function CodeEditor({ value, onChange, language }) {
  const ref = useRef(null);
  const lines = (value || '').split('\n').length;

  const handleTab = (e) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const s = e.target.selectionStart;
    const newVal = value.substring(0, s) + '  ' + value.substring(e.target.selectionEnd);
    onChange(newVal);
    requestAnimationFrame(() => { ref.current.selectionStart = ref.current.selectionEnd = s + 2; });
  };

  return (
    <div className="rounded-lg overflow-hidden border border-slate-700">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-700">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500/70" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <span className="w-3 h-3 rounded-full bg-green-500/70" />
        </div>
        <span className="text-xs text-slate-500 font-mono">{language}</span>
        <span className="text-xs text-slate-600">{lines} líneas</span>
      </div>
      <div className="flex bg-slate-950">
        <div className="select-none px-3 py-3 text-xs font-mono text-slate-600 bg-slate-900/50 border-r border-slate-700/50 text-right min-w-[2.5rem]">
          {Array.from({ length: lines }, (_, i) => <div key={i} className="leading-6">{i + 1}</div>)}
        </div>
        <textarea
          ref={ref}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleTab}
          placeholder={PLACEHOLDER[language]}
          spellCheck={false}
          className="flex-1 bg-transparent text-slate-200 font-mono text-sm leading-6 p-3 outline-none resize-none min-h-[220px] placeholder:text-slate-700"
        />
      </div>
    </div>
  );
}