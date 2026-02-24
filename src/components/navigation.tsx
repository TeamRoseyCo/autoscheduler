"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/tasks", label: "Tasks" },
  { href: "/settings", label: "Settings" },
];

export function Navigation() {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (!session) return null;

  return (
    <nav className="border-b border-[#2a2a3a] bg-[#16161f]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-lg font-semibold text-gray-100">
              AutoScheduler
            </span>
            <div className="flex gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    pathname === link.href
                      ? "bg-[#2a2a3a] text-gray-100"
                      : "text-gray-400 hover:bg-[#2a2a3a] hover:text-gray-200"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {session.user?.image && (
              <img
                src={session.user.image}
                alt=""
                className="h-8 w-8 rounded-full"
              />
            )}
            <span className="text-sm text-gray-400">{session.user?.name}</span>
            <button
              onClick={() => signOut()}
              className="rounded-md px-3 py-1.5 text-sm text-gray-400 hover:bg-[#2a2a3a] hover:text-gray-200 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
