import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import CountUp from './CountUp';

export const CARD =
  'glass-card surface-card rounded-2xl border backdrop-blur-sm transition-all duration-200 ease-out';

export const BTN_PRESS = 'btn-animate transition-all duration-150 ease-out';

export const GRADIENT_BTN =
  'btn-animate rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 font-medium text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-purple-500';

export const INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none transition-all duration-150 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500';

export function GlassCard({ children, className = '', delay = 0, borderTop = '' }) {
  return (
    <div
      className={`stat-card-enter ${CARD} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {borderTop && <div className={`h-1 rounded-t-2xl bg-gradient-to-r ${borderTop}`} />}
      {children}
    </div>
  );
}

export function PageHero({ title, subtitle, children, pills }) {
  return (
    <div className="page-fade-in overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700/50">
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 px-6 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {subtitle && <p className="text-sm font-medium text-indigo-100/90">{subtitle}</p>}
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          </div>
          {pills && <div className="flex flex-wrap gap-2">{pills}</div>}
        </div>
      </div>
      {children && (
        <div className="border-t border-slate-200 bg-white/80 px-6 py-3 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/50">
          {children}
        </div>
      )}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, displayValue, iconClass, trend, delay = 0, pulse = false }) {
  const isNum = typeof value === 'number';
  const shown =
    displayValue ??
    (isNum ? <CountUp value={value} duration={1000} className="text-3xl font-bold" /> : value);

  return (
    <GlassCard className={`relative p-5 ${pulse ? 'ring-1 ring-amber-500/30' : ''}`} delay={delay}>
      <div className={`mb-4 inline-flex rounded-xl p-2.5 ${iconClass}`}>
        <Icon className={`h-5 w-5 ${pulse && value > 0 ? 'animate-pulse' : ''}`} />
      </div>
      <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{shown}</p>
      <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      {trend && (
        <span
          className={`absolute bottom-4 right-4 flex items-center gap-0.5 rounded-full px-2 py-0.5 font-mono text-xs font-medium ${
            trend.up ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'
          }`}
        >
          {trend.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {trend.text}
        </span>
      )}
    </GlassCard>
  );
}

export function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur-md dark:border-slate-600/60 dark:bg-slate-900/95">
      <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
        {formatter ? formatter(payload[0].value) : payload[0].value}
      </p>
    </div>
  );
}

export function Pill({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm ${className}`}
    >
      {children}
    </span>
  );
}

export function PillTabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700/50 dark:bg-slate-900/40">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors duration-200 ${BTN_PRESS} ${
            active === tab
              ? 'bg-indigo-600 text-white shadow shadow-indigo-500/30'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

export function OrderStatusBadge({ status }) {
  const s = (status || 'pending').toLowerCase();
  const map = {
    cancelled: 'bg-red-500/20 text-red-600 dark:text-red-400',
    fulfilled: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    paid: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    pending: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  };
  const cls = map[s] || map.pending;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>{status}</span>
  );
}

export function Avatar({ name, size = 'md' }) {
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const sz = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 font-semibold text-white ${sz}`}
    >
      {initials}
    </div>
  );
}

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function ViewAllLink({ to }) {
  return (
    <Link to={to} className={`link-underline text-sm font-medium text-indigo-600 dark:text-indigo-400 ${BTN_PRESS}`}>
      View All →
    </Link>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800/80 dark:text-slate-500">
          <Icon className="h-8 w-8" />
        </div>
      )}
      <p className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-200">{title}</p>
      {description && <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>}
      {action}
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonRow, SkeletonText } from './Skeleton';
