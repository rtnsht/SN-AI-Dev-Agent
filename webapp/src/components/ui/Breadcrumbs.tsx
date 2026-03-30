'use client';

import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  className?: string;
}

export function Breadcrumbs({ items, showHome = true, className = '' }: BreadcrumbsProps) {
  const allItems = showHome
    ? [{ label: 'Home', href: '/app' }, ...items]
    : items;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1 text-sm ${className}`}
    >
      <ol className="flex items-center gap-1">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          const isFirst = index === 0 && showHome;

          return (
            <li key={index} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="w-4 h-4 text-zinc-500" aria-hidden="true" />
              )}
              {isLast ? (
                <span className="text-zinc-300" aria-current="page">
                  {isFirst && <Home className="w-4 h-4 inline mr-1" />}
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  {isFirst && <Home className="w-4 h-4 inline mr-1" />}
                  {item.label}
                </Link>
              ) : (
                <span className="text-zinc-400">
                  {isFirst && <Home className="w-4 h-4 inline mr-1" />}
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
