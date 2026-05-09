"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-8">
      <div className="border border-red-500/40 bg-red-500/10 rounded-sm p-6 max-w-lg">
        <h1 className="text-red-400 font-semibold tracking-wider uppercase text-sm mb-2">
          Dashboard error
        </h1>
        <pre className="text-xs font-mono text-slate-400 whitespace-pre-wrap">{error.message}</pre>
        <button
          onClick={reset}
          className="mt-4 bg-[#EE3124] hover:bg-[#cc2820] text-white text-xs uppercase tracking-wider px-3 py-1.5 rounded-sm"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
