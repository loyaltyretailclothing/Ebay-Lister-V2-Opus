import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-24">
      <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        eBay Lister
      </h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        AI-powered listings in seconds, not minutes.
      </p>
      <div className="mt-10">
        <Link
          href="/generate"
          className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Create Listing
        </Link>
      </div>
    </div>
  );
}
