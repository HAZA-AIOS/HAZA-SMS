"use client";
import Link from "next/link";

export default function ErrorBoundary({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <main className="production-error"><section><span>🛡️</span><p>THE MENTOR SCHOOL</p><h1>This workspace could not be loaded.</h1><small>Retry the page, or return to the dashboard if the problem continues.</small><div><button onClick={reset}>Try again</button><Link href="/?portal=dashboard">Return to dashboard</Link></div></section></main>
}
