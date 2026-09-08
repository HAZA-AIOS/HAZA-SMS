"use client";

export default function ErrorBoundary({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <main className="production-error"><section><span>🛡️</span><p>THE MENTOR SCHOOL</p><h1>This workspace could not be loaded.</h1><small>Your data has not been changed. Retry the page, or return to the dashboard if the problem continues.</small><div><button onClick={reset}>Try again</button><a href="/?portal=dashboard">Return to dashboard</a></div></section></main>
}
