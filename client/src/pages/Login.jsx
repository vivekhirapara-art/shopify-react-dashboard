import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Package, ShoppingCart, CheckCircle2 } from 'lucide-react';
import ConnectStoreForm from '../components/ConnectStoreForm';

export default function Login() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 transition-colors duration-300 dark:bg-slate-900">
      <div className="login-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div className="login-blob login-blob-1" aria-hidden />
      <div className="login-blob login-blob-2" aria-hidden />
      <div className="login-blob login-blob-3" aria-hidden />

      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
        <div className="login-slide-left flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-[60%] lg:px-16 xl:px-24">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/30">
                <ShoppingBag className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Shopify Dashboard</span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">
              Connect Your Store
            </h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400">Enter your Shopify credentials to get started</p>

            <div className="surface-card mt-8 rounded-2xl border p-6 backdrop-blur-sm">
              <ConnectStoreForm onSuccess={() => navigate('/', { replace: true })} />
            </div>
          </div>
        </div>

        <div className="login-slide-right relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-700 lg:flex lg:w-[40%]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.12),_transparent_50%)]" />
          <div className="relative flex h-full w-full flex-col items-center justify-center p-12">
            <div className="relative h-72 w-full max-w-sm">
              <div className="login-float-card login-float-1 absolute left-0 top-8 rounded-2xl border border-white/20 bg-white/10 px-5 py-4 shadow-2xl backdrop-blur-md">
                <Package className="mb-2 h-6 w-6 text-indigo-200" />
                <p className="text-2xl font-bold text-white">All</p>
                <p className="text-sm text-indigo-100/80">Products</p>
              </div>
              <div className="login-float-card login-float-2 absolute right-0 top-24 rounded-2xl border border-white/20 bg-white/10 px-5 py-4 shadow-2xl backdrop-blur-md">
                <ShoppingCart className="mb-2 h-6 w-6 text-purple-200" />
                <p className="text-2xl font-bold text-white">All</p>
                <p className="text-sm text-purple-100/80">Orders</p>
              </div>
              <div className="login-float-badge absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-100 backdrop-blur-sm">
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
                Connected
              </div>
            </div>

            <p className="mt-8 max-w-xs text-center text-lg font-medium text-white/90">
              Manage your Shopify store from one place
            </p>
            <ul className="mt-6 space-y-3 text-sm text-indigo-100/90">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                Real-time order notifications
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                Inventory management
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                Advanced analytics
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
