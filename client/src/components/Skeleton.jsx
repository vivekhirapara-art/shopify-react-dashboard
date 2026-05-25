export function Skeleton({ className = '' }) {
  return <div className={`skeleton-shimmer rounded-xl ${className}`} />;
}

export function SkeletonText({ className = 'h-4 w-full' }) {
  return <div className={`skeleton-shimmer rounded-md ${className}`} />;
}

export function SkeletonRow({ className = '' }) {
  return (
    <div className={`flex items-center gap-3 py-3 ${className}`}>
      <div className="skeleton-shimmer h-10 w-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="skeleton-shimmer h-4 w-3/4 rounded-md" />
        <div className="skeleton-shimmer h-3 w-1/2 rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`surface-card rounded-2xl border p-5 ${className}`}>
      <div className="skeleton-shimmer mb-4 h-10 w-10 rounded-xl" />
      <div className="skeleton-shimmer mb-2 h-8 w-24 rounded-md" />
      <div className="skeleton-shimmer h-4 w-32 rounded-md" />
    </div>
  );
}
