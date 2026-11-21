import Link from "next/link";
export default function NotFound() {
  return <div className="mx-auto max-w-md px-4 py-20 text-center"><div className="text-5xl">🚏</div><h1 className="mt-3 text-2xl font-bold">Page not found</h1><p className="mt-1 text-slate-500">The link may be wrong or expired.</p><Link href="/" className="btn-primary mt-5">Back to home</Link></div>;
}
