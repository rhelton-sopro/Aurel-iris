import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Defensive coercion for jsonb fields. Postgres jsonb may store strings,
// objects, or arrays where TypeScript types declare an array — typically
// from legacy/partial rows or upstream pipeline drift. Always coerce before
// .map / .filter / .join / for...of to avoid runtime "X.map is not a function".
export function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}
