import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const moduleSurface = "space-y-6 text-[15px] text-slate-700 [&_h1]:text-3xl [&_h1]:font-black [&_h1]:tracking-tight [&_h1]:text-slate-950 [&_h2]:font-extrabold [&_h2]:text-slate-950 [&_h3]:font-bold [&_h3]:text-slate-900 [&_label]:text-sm [&_label]:font-semibold [&_input:not([type=checkbox]):not([type=radio])]:min-h-11 [&_input:not([type=checkbox]):not([type=radio])]:rounded-lg [&_input:not([type=checkbox]):not([type=radio])]:border [&_input:not([type=checkbox]):not([type=radio])]:border-slate-300 [&_input:not([type=checkbox]):not([type=radio])]:bg-white [&_input:not([type=checkbox]):not([type=radio])]:px-3 [&_input:not([type=checkbox]):not([type=radio])]:text-sm [&_select]:min-h-11 [&_select]:rounded-lg [&_select]:border [&_select]:border-slate-300 [&_select]:bg-white [&_select]:px-3 [&_select]:text-sm [&_textarea]:min-h-24 [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-slate-300 [&_textarea]:bg-white [&_textarea]:px-3 [&_textarea]:py-2 [&_textarea]:text-sm [&_button]:min-h-10 [&_button]:rounded-lg [&_button]:px-3 [&_button]:py-2 [&_button]:text-sm [&_button]:font-semibold [&_button]:transition focus-within:[&_input]:border-red-500 focus-within:[&_select]:border-red-500";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn("inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 disabled:pointer-events-none disabled:opacity-50", className)} {...props} />;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)} {...props} />;
}

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex items-center rounded-full border border-yellow-300 bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-800", className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:bg-slate-100", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:bg-slate-100", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("min-h-28 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:bg-slate-100", className)} {...props} />;
}

export function TableShell({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full overflow-x-auto rounded-xl border border-slate-200 bg-white [&_table]:w-full [&_th]:bg-slate-50 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-slate-500 [&_td]:border-t [&_td]:border-slate-100 [&_td]:px-4 [&_td]:py-3 [&_td]:text-sm [&_td]:text-slate-700", className)} {...props} />;
}

export function DialogShell({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm [&>section]:max-h-[90vh] [&>section]:w-full [&>section]:max-w-2xl [&>section]:overflow-y-auto [&>section]:rounded-2xl [&>section]:bg-white [&>section]:p-6 [&>section]:shadow-2xl", className)} {...props} />;
}
