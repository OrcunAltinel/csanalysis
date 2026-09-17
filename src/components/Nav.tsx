"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/watchlist", label: "Watchlist" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 border-b border-neutral-800 px-6 py-3">
      <span className="mr-4 text-sm font-semibold tracking-wide text-neutral-300">
        csanalysis
      </span>
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-neutral-800 text-neutral-50"
                : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
