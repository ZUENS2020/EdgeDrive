"use client";

import hljs from "highlight.js/lib/core";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import xml from "highlight.js/lib/languages/xml";
import { LoaderCircle } from "lucide-react";
import { useEffect, useId, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { PublicShareFile } from "@/server/v2/shares";

hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("html", xml);

function MermaidBlock({ source }: { source: string }) {
  const reactId = useId();
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    void import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "dark" });
      try {
        const result = await mermaid.render(`mermaid-${reactId.replace(/:/g, "")}`, source);
        if (live) setSvg(result.svg);
      } catch { if (live) setFailed(true); }
    });
    return () => { live = false; };
  }, [reactId, source]);
  if (failed) return <pre><code>{source}</code></pre>;
  if (!svg) return <div className="preview-loading"><LoaderCircle className="spin" size={18} />Rendering diagram</div>;
  return <div className="mermaid-output" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const source = String(children || "").replace(/\n$/, "");
  const language = /language-([\w-]+)/.exec(className || "")?.[1];
  if (language === "mermaid") return <MermaidBlock source={source} />;
  const result = language && hljs.getLanguage(language) ? hljs.highlight(source, { language }) : hljs.highlightAuto(source);
  return <pre><code className="hljs" dangerouslySetInnerHTML={{ __html: result.value }} /></pre>;
}

export function PublicPreview({ file }: { file: PublicShareFile }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const isMarkdown = /markdown/i.test(file.mime || "") || /\.md$/i.test(file.name);
  const isText = isMarkdown || Boolean(file.mime?.startsWith("text/")) || /\.(txt|log|json|csv|ya?ml|toml)$/i.test(file.name);
  useEffect(() => {
    if (!isText) return;
    let live = true;
    void fetch(file.previewUrl).then((response) => {
      if (!response.ok) throw new Error("preview-failed");
      return response.text();
    }).then((value) => { if (live) setText(value); }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [file.previewUrl, isText]);
  if (file.mime?.startsWith("image/")) return <img src={file.previewUrl} alt={file.name} />;
  if (file.mime?.startsWith("video/")) return <video controls preload="metadata" src={file.previewUrl} />;
  if (file.mime?.startsWith("audio/")) return <audio controls preload="metadata" src={file.previewUrl} />;
  if (isText) {
    if (error) return <div className="preview-loading">Preview unavailable. Download the file to continue.</div>;
    if (text == null) return <div className="preview-loading"><LoaderCircle className="spin" size={18} />Loading preview</div>;
    return isMarkdown ? <article className="markdown-preview"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={{ code: CodeBlock }}>{text}</ReactMarkdown></article> : <pre className="text-preview">{text}</pre>;
  }
  return <iframe src={file.previewUrl} title={file.name} />;
}
