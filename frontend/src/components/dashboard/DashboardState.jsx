import { AlertCircle, RefreshCw } from "lucide-react";

export function DashboardLoading() { return <div className="dashboard-state" role="status" aria-live="polite"><span className="dashboard-state__spinner" aria-hidden="true" /><p>Making your space ready…</p></div>; }

export function DashboardError({ onRetry }) { return <div className="dashboard-state dashboard-state--error" role="alert"><AlertCircle size={28} aria-hidden="true" /><h1>We couldn&apos;t load your dashboard.</h1><p>Please check your connection and try again.</p><button type="button" className="btn btn-primary" onClick={onRetry}><RefreshCw size={17} aria-hidden="true" /> Try again</button></div>; }
