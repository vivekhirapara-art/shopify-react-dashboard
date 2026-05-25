import { useEffect, useRef, useState } from 'react';
import {
  ShoppingBag,
  Link2,
  Package,
  ShoppingCart,
  BarChart3,
  RefreshCw,
  Bell,
  TrendingUp,
  Tags,
  Store,
  Shield,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { GlassCard, Pill, BTN_PRESS, CARD } from '../components/premium-ui';

const STEPS = [
  {
    num: 1,
    icon: Link2,
    title: 'Connect Your Store',
    description:
      'Enter your Shopify store URL and Access Token to securely connect your store in seconds.',
    illustration: 'login',
  },
  {
    num: 2,
    icon: Package,
    title: 'Manage Products',
    description:
      'View, edit, add and bulk-manage all your Shopify products from one clean dashboard. Import/export CSV.',
    illustration: 'products',
  },
  {
    num: 3,
    icon: ShoppingCart,
    title: 'Track Orders',
    description:
      'Get real-time order notifications via webhooks. Track order status, customer details, and revenue.',
    illustration: 'orders',
  },
  {
    num: 4,
    icon: BarChart3,
    title: 'Analyze Performance',
    description:
      'View sales trends, inventory value, stock alerts and store health score in beautiful charts.',
    illustration: 'charts',
  },
];

const FEATURES = [
  { icon: RefreshCw, title: 'Real-time Sync', desc: 'Auto-sync products every 5 minutes from Shopify' },
  { icon: Bell, title: 'Live Notifications', desc: 'Instant webhook notifications for new orders' },
  { icon: TrendingUp, title: 'Analytics Dashboard', desc: 'Revenue charts, stock distribution, top products' },
  { icon: Tags, title: 'Bulk Operations', desc: 'Bulk delete, bulk price update, import/export CSV' },
  { icon: Store, title: 'Multi-Store Support', desc: 'Switch between multiple Shopify stores easily' },
  { icon: Shield, title: 'Secure Connection', desc: 'Your credentials stored locally, never on our servers' },
];

const FAQS = [
  {
    q: 'Where is my data stored?',
    a: "All data is stored locally on your machine in SQLite database. Your Shopify credentials are saved in your browser's localStorage only.",
  },
  {
    q: 'How do I get my Access Token?',
    a: 'Go to Shopify Partners → Your App → Configuration → API credentials → Generate Admin API access token.',
  },
  {
    q: 'What are webhooks and how to set them up?',
    a: 'Webhooks allow Shopify to notify your dashboard instantly when orders are placed. Go to Settings page and follow the webhook setup instructions.',
  },
  {
    q: 'Can I connect multiple stores?',
    a: 'Yes! Click "Switch Store" in the sidebar to connect a different Shopify store anytime.',
  },
  {
    q: 'Is my access token safe?',
    a: "Your token is stored only in your browser's localStorage and sent directly to your local server. It never leaves your machine.",
  },
  {
    q: 'Why is my inventory not updating?',
    a: 'Make sure webhooks are configured in Shopify Admin. The dashboard updates inventory automatically when orders are received via webhooks.',
  },
];

const TECH = [
  { name: 'React 18', emoji: '⚛️' },
  { name: 'Vite', emoji: '⚡' },
  { name: 'Node.js', emoji: '🟢' },
  { name: 'Express', emoji: '🔷' },
  { name: 'SQLite', emoji: '🗄️' },
  { name: 'Tailwind CSS', emoji: '🎨' },
  { name: 'Recharts', emoji: '📊' },
  { name: 'Socket.io', emoji: '🔌' },
  { name: 'Shopify API', emoji: '🛍️' },
];

function StepIllustration({ type }) {
  if (type === 'login') {
    return (
      <div className="mx-auto flex h-28 w-full max-w-[200px] flex-col gap-2 rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-600/50 dark:bg-slate-900/60 p-3">
        <div className="h-3 w-3/4 rounded bg-slate-700/80" />
        <div className="h-3 w-full rounded bg-slate-700/60" />
        <div className="mt-1 h-6 w-full rounded-lg bg-gradient-to-r from-indigo-600/60 to-purple-600/60" />
      </div>
    );
  }
  if (type === 'products') {
    return (
      <div className="mx-auto grid h-28 w-full max-w-[200px] grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border border-slate-600/40 bg-gradient-to-br from-indigo-900/40 to-purple-900/30 p-2">
            <div className="mb-1 h-8 rounded bg-slate-700/50" />
            <div className="h-1.5 w-2/3 rounded bg-slate-600" />
          </div>
        ))}
      </div>
    );
  }
  if (type === 'orders') {
    return (
      <div className="mx-auto h-28 w-full max-w-[200px] space-y-1.5 rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-600/50 dark:bg-slate-900/60 p-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-2 rounded bg-slate-800/50 px-2 py-1">
            <div className="h-2 w-8 rounded bg-indigo-500/40" />
            <div className="h-2 flex-1 rounded bg-slate-600" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mx-auto flex h-28 w-full max-w-[200px] items-end justify-center gap-1 rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-600/50 dark:bg-slate-900/60 px-4 pb-3">
      {[40, 65, 45, 80, 55].map((h, i) => (
        <div
          key={i}
          className="w-4 rounded-t bg-gradient-to-t from-indigo-600 to-purple-500"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

function FadeSection({ children, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'} ${className}`}
    >
      {children}
    </div>
  );
}

function FaqItem({ q, a, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={`overflow-hidden rounded-2xl border transition-all ${CARD} ${
        open ? 'border-indigo-500/40 bg-indigo-50 dark:bg-slate-800/60' : 'border-slate-200 dark:border-slate-700/50'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left ${BTN_PRESS}`}
      >
        <span className="font-medium text-slate-900 dark:text-slate-100">{q}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <p className="border-l-2 border-indigo-500/60 px-5 pb-4 pl-6 text-sm leading-relaxed text-slate-400">{a}</p>
        </div>
      </div>
    </div>
  );
}

export default function About() {
  return (
    <div className="space-y-16 pb-12">
      <div className="page-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700/50 dark:bg-transparent">
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 px-6 py-14 text-center sm:py-16">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 shadow-xl backdrop-blur-sm">
            <ShoppingBag className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Shopify Dashboard</h1>
          <Pill className="mx-auto mt-3 bg-white/20">v1.0.0</Pill>
          <p className="mx-auto mt-4 max-w-md text-indigo-100/90">
            Your complete Shopify store management tool
          </p>
        </div>
      </div>

      <FadeSection>
        <h2 className="mb-8 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-2xl font-bold text-transparent">
          How It Works
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <GlassCard
              key={step.num}
              delay={i * 80}
              className="group p-6 transition-all hover:-translate-y-1 hover:border-indigo-500/40"
            >
              <span className="mb-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                {step.num}
              </span>
              <StepIllustration type={step.illustration} />
              <div className="mt-4 flex items-center gap-2">
                <step.icon className="h-5 w-5 text-indigo-400" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{step.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.description}</p>
            </GlassCard>
          ))}
        </div>
      </FadeSection>

      <FadeSection>
        <h2 className="mb-8 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-2xl font-bold text-transparent">
          Everything You Need
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <GlassCard key={f.title} delay={i * 50} className="p-5">
              <div className="mb-3 inline-flex rounded-xl bg-gradient-to-br from-indigo-600/30 to-purple-600/30 p-2.5">
                <f.icon className="h-5 w-5 text-indigo-400" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{f.desc}</p>
            </GlassCard>
          ))}
        </div>
      </FadeSection>

      <FadeSection>
        <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
          <HelpCircle className="h-7 w-7 text-indigo-400" />
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Frequently Asked Questions
          </span>
        </h2>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} defaultOpen={i === 0} />
          ))}
        </div>
      </FadeSection>

      <FadeSection>
        <h2 className="mb-6 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-2xl font-bold text-transparent">
          Built With
        </h2>
        <div className="flex flex-wrap gap-2">
          {TECH.map((t) => (
            <span
              key={t.name}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-300"
            >
              <span>{t.emoji}</span>
              {t.name}
            </span>
          ))}
        </div>
      </FadeSection>

      <FadeSection>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 py-8 text-center backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/30">
          <p className="text-slate-500 dark:text-slate-300">Made with ❤️ for Shopify store owners</p>
          <p className="mt-2 text-sm text-slate-500">Version v1.0.0 | © 2026</p>
        </div>
      </FadeSection>
    </div>
  );
}
