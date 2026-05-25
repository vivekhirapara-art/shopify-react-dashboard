import { ShoppingBag } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="loading-screen-fade surface-page fixed inset-0 z-[100] flex flex-col items-center justify-center">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-indigo-500 border-r-purple-500" style={{ animationDuration: '1.2s' }} />
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/30">
          <ShoppingBag className="h-7 w-7 text-white" />
        </div>
      </div>
      <p className="mt-6 text-sm font-medium text-slate-500 dark:text-slate-400">Connecting to your store...</p>
    </div>
  );
}
