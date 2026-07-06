import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-black text-indigo-500 tabular-nums">404</p>
        <h1 className="mt-4 text-xl font-bold text-white">Admin page not found</h1>
        <p className="mt-2 text-gray-400 text-sm">
          This admin page doesn&apos;t exist.
        </p>
        <Link
          href="/admin"
          className="mt-6 inline-flex px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold"
        >
          Back to Admin
        </Link>
      </div>
    </div>
  );
}
