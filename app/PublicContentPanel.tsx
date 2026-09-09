"use client";

import FeedbackAdmin from "./FeedbackAdmin";
import { FormEvent, useState } from "react";
import { cn, moduleSurface } from "./ui/TailwindPrimitives";

type Campus = { id: string; name: string };
type Download = { id: string; title: string; description: string | null; original_name: string; size_bytes: number; status: string; campus_name: string | null };
type NewsEvent = { id: string; kind: string; title: string; summary: string; event_starts_at: number | null; location: string | null; status: string; campus_name: string | null };
type UploadedPart = { partNumber: number; etag: string };

const MULTIPART_CHUNK_SIZE = 10 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}

export type PublicContentData = {
  campuses: Campus[];
  downloads: Download[];
  newsEvents: NewsEvent[];
  canManage: boolean;
};

export default function PublicContentPanel({ data: initial, initialTab }: { data: PublicContentData; initialTab: "downloads" | "news" }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState(initialTab);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  async function reload() {
    const response = await fetch("/api/public-content", { cache: "no-store" });
    if (response.ok) setData(await response.json());
  }

  async function addDownload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 1) { setMessage("Choose a file to upload."); return; }
    setBusy(true); setMessage(""); setUploadProgress(0);
    let uploadId = "", key = "";
    try {
      const initiateResponse = await fetch("/api/public-content/downloads/multipart", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
          action: "initiate", title: String(form.get("title") ?? ""), description: String(form.get("description") ?? ""),
          campusId: String(form.get("campusId") ?? ""), fileName: file.name, contentType: file.type, size: file.size,
        }),
      });
      const initiated = await initiateResponse.json();
      if (!initiateResponse.ok) throw new Error(initiated.error ?? "Could not start upload.");
      uploadId = initiated.uploadId; key = initiated.key;
      const parts: UploadedPart[] = [];
      const totalParts = Math.ceil(file.size / MULTIPART_CHUNK_SIZE);
      for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
        const start = (partNumber - 1) * MULTIPART_CHUNK_SIZE;
        const chunk = file.slice(start, Math.min(start + MULTIPART_CHUNK_SIZE, file.size));
        const response = await fetch(`/api/public-content/downloads/multipart?uploadId=${encodeURIComponent(uploadId)}&key=${encodeURIComponent(key)}&partNumber=${partNumber}`, { method: "PUT", body: chunk });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? `Part ${partNumber} failed.`);
        parts.push({ partNumber, etag: result.etag });
        setUploadProgress(Math.round((partNumber / totalParts) * 100));
      }
      const completeResponse = await fetch("/api/public-content/downloads/multipart", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "complete", uploadId, key, parts }),
      });
      const completed = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(completed.error ?? "Could not finish upload.");
      setMessage("Download published on the website."); formElement.reset(); await reload();
    } catch (error) {
      if (uploadId && key) await fetch(`/api/public-content/downloads/multipart?uploadId=${encodeURIComponent(uploadId)}&key=${encodeURIComponent(key)}`, { method: "DELETE" }).catch(() => undefined);
      setMessage(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally { setBusy(false); setUploadProgress(null); }
  }

  async function addNews(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/public-content/news-events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form.entries())) });
    const result = await response.json(); setBusy(false); setMessage(result.error ?? `${form.get("kind") === "event" ? "Event" : "News item"} published on the website.`);
    if (response.ok) { event.currentTarget.reset(); await reload(); }
  }

  async function remove(kind: "downloads" | "news-events", id: string) {
    if (!confirm("Remove this item from the public website?")) return;
    setBusy(true); const response = await fetch(`/api/public-content/${kind}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const result = await response.json(); setBusy(false); setMessage(result.error ?? "Item removed."); if (response.ok) await reload();
  }

  return <div className={cn("foundation-page public-content-page", moduleSurface)}>
    <div className="phase-heading"><div><span className="eyebrow">PUBLIC WEBSITE</span><h1>Downloads, News &amp; Events</h1><p>Publish files and school updates directly to the public landing page.</p></div><span className="phase-badge complete">Live content</span></div>
    <nav className="config-tabs"><button className={tab === "downloads" ? "active" : ""} onClick={() => setTab("downloads")}>⬇ Downloads</button><button className={tab === "news" ? "active" : ""} onClick={() => setTab("news")}>📰 News &amp; Events</button></nav>
    {message && <p className="access-message">{message}</p>}
    {tab === "downloads" ? <div className="public-content-layout">
      <form className="config-card public-content-form" onSubmit={addDownload}><div className="card-title"><h2>Publish a download</h2><p>Large files upload in secure 10 MB parts and become available after the upload completes.</p></div><div className="public-content-form-fields"><label className="wide">Public title<input name="title" required maxLength={120} /></label><label className="wide">Description<textarea name="description" maxLength={500} rows={4} /></label><label>Campus<select name="campusId"><option value="">All campuses</option>{data.campuses.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>File<input name="file" type="file" required /></label>{uploadProgress !== null && <div className="upload-progress wide" aria-live="polite"><div><span>Uploading file</span><strong>{uploadProgress}%</strong></div><progress max="100" value={uploadProgress} /></div>}</div><div className="public-content-form-actions"><button className="primary" disabled={busy || !data.canManage}>{busy ? `Uploading${uploadProgress !== null ? ` ${uploadProgress}%` : ""}…` : "Publish download"}</button></div></form>
      <section className="config-card public-content-feed"><div className="card-title"><h2>Published downloads</h2><p>{data.downloads.length} file{data.downloads.length === 1 ? "" : "s"} currently shown publicly.</p></div><div className="public-content-list">{data.downloads.length ? data.downloads.map(item => <article key={item.id}><span>⬇</span><div><strong>{item.title}</strong><small>{item.campus_name ?? "All campuses"} · {item.original_name} · {formatBytes(item.size_bytes)}</small>{item.description && <p>{item.description}</p>}</div><button type="button" className="danger" disabled={busy} onClick={() => remove("downloads", item.id)}>Remove</button></article>) : <p className="empty-state">No public downloads yet.</p>}</div></section>
    </div> : <div className="public-content-layout">
      <form className="config-card public-content-form" onSubmit={addNews}><div className="card-title"><h2>Publish news or an event</h2><p>Add a concise update for families and visitors.</p></div><div className="public-content-form-fields"><label>Type<select name="kind"><option value="news">News</option><option value="event">Event</option></select></label><label>Title<input name="title" required maxLength={140} /></label><label className="wide">Summary<textarea name="summary" required maxLength={1000} rows={5} /></label><label>Campus<select name="campusId"><option value="">All campuses</option>{data.campuses.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>Event date and time<input name="eventStartsAt" type="datetime-local" /></label><label className="wide">Location<input name="location" maxLength={160} /></label></div><div className="public-content-form-actions"><button className="primary" disabled={busy || !data.canManage}>{busy ? "Publishing…" : "Publish update"}</button></div></form>
      <section className="config-card public-content-feed"><div className="card-title"><h2>Published updates</h2><p>{data.newsEvents.length} item{data.newsEvents.length === 1 ? "" : "s"} currently shown publicly.</p></div><div className="public-content-list">{data.newsEvents.length ? data.newsEvents.map(item => <article key={item.id}><span>{item.kind === "event" ? "📅" : "📰"}</span><div><strong>{item.title}</strong><small>{item.campus_name ?? "All campuses"}{item.event_starts_at ? ` · ${new Date(item.event_starts_at).toLocaleString()}` : ""}</small><p>{item.summary}</p>{item.location && <small>📍 {item.location}</small>}</div><button type="button" className="danger" disabled={busy} onClick={() => remove("news-events", item.id)}>Remove</button></article>) : <p className="empty-state">No news or events published yet.</p>}</div></section>
    </div>}
  {data.canManage && <FeedbackAdmin />}</div>;
}
