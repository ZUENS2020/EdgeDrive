"use client";

import { RotateCcw } from "lucide-react";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="setup-shell"><section className="setup-card"><p className="eyebrow">EDGEDRIVE</p><h1>Something went wrong</h1><p className="setup-intro">The admin workspace could not be loaded.</p><button className="button primary" onClick={reset}><RotateCcw size={16} />Try again</button></section></main>;
}
