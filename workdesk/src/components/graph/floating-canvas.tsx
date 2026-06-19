"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  kind: "set" | "artifact";
  artifact_type?: string;
  set_id?: string | null;
  visibility?: string;
  set_name?: string | null;
  parent_id?: string | null;
}

interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: "set-parent" | "artifact-set";
}

// ── Colour palette — constellation / space aesthetic ──────────────────────────

const NODE_COLOR: Record<string, string> = {
  set:      "#58A6FF",   // blue star (larger)
  document: "#8B949E",   // grey dwarf
  pdf:      "#F85149",   // red giant
  image:    "#3FB950",   // green star
  video:    "#D29922",   // amber star
  archive:  "#A371F7",   // purple nebula
  docx:     "#79c0ff",   // light blue
  pptx:     "#ffa657",   // orange
  zip:      "#8b949e",   // grey
  other:    "#8B949E",
};

function nodeColor(n: GraphNode): string {
  if (n.kind === "set") return NODE_COLOR.set;
  const t = (n.artifact_type ?? "other").toLowerCase();
  return NODE_COLOR[t] ?? NODE_COLOR.other;
}

function nodeRadius(n: GraphNode): number {
  return n.kind === "set" ? 11 : 6;
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { color: NODE_COLOR.set,      label: "Set" },
    { color: NODE_COLOR.document, label: "Document" },
    { color: NODE_COLOR.pdf,      label: "PDF" },
    { color: NODE_COLOR.image,    label: "Image" },
    { color: NODE_COLOR.video,    label: "Video" },
    { color: NODE_COLOR.archive,  label: "Archive" },
  ];
  return (
    <div style={{
      position: "absolute", bottom: 16, left: 16, zIndex: 10,
      background: "rgba(22,27,34,0.85)", backdropFilter: "blur(8px)",
      border: "1px solid #30363d", borderRadius: 8,
      padding: "8px 12px", fontFamily: "Inter, sans-serif",
    }}>
      <p style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, margin: "0 0 6px" }}>Legend</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 16px" }}>
        {items.map(i => (
          <div key={i.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: i.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: "#8b949e" }}>{i.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function Tooltip({ node, x, y }: { node: GraphNode; x: number; y: number }) {
  return (
    <div style={{
      position: "fixed", left: x + 14, top: y - 10, zIndex: 9999,
      pointerEvents: "none",
      background: "#1c2128", border: "1px solid #30363d",
      borderRadius: 8, padding: "7px 11px", maxWidth: 200,
      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      fontFamily: "Inter, sans-serif",
    }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "#e6edf3", margin: 0 }}>{node.label}</p>
      <p style={{ fontSize: 10, color: "#8b949e", margin: "2px 0 0" }}>
        {node.kind === "set" ? "Set" : (node.artifact_type?.toUpperCase() ?? "Artifact")}
        {node.set_name ? ` · ${node.set_name}` : ""}
      </p>
      <p style={{ fontSize: 10, color: "#58a6ff", margin: "3px 0 0" }}>Double-click to open</p>
    </div>
  );
}

// ── Main floating canvas ───────────────────────────────────────────────────────

interface Props {
  search: string;
}

export function FloatingCanvas({ search }: Props) {
  const router = useRouter();
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef     = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const nodesRef   = useRef<GraphNode[]>([]);
  const edgesRef   = useRef<GraphEdge[]>([]);
  const zoomRef    = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  // stable ref for raw data — filter applies when search changes
  const rawNodesRef = useRef<GraphNode[]>([]);
  const rawEdgesRef = useRef<GraphEdge[]>([]);

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [tooltip, setTooltip] = useState<{ node: GraphNode; x: number; y: number } | null>(null);

  // ── draw ──────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Starfield background — draw once, very cheap
    const t = transformRef.current;
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    const nodes = nodesRef.current;
    const edges = edgesRef.current;

    // Draw edges
    for (const edge of edges) {
      const s  = edge.source as GraphNode;
      const tg = edge.target as GraphNode;
      if (s.x == null || s.y == null || tg.x == null || tg.y == null) continue;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tg.x, tg.y);
      if (edge.type === "set-parent") {
        ctx.strokeStyle = "rgba(88,166,255,0.35)";
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = "rgba(139,148,158,0.18)";
        ctx.lineWidth = 0.8;
      }
      ctx.stroke();
    }

    // Draw nodes
    for (const node of nodes) {
      if (node.x == null || node.y == null) continue;
      const r     = nodeRadius(node);
      const color = nodeColor(node);

      if (node.kind === "set") {
        // Outer glow ring
        const grad = ctx.createRadialGradient(node.x, node.y, r * 0.5, node.x, node.y, r * 2.8);
        grad.addColorStop(0, color + "44");
        grad.addColorStop(1, color + "00");
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 2.8, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Pulse ring
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = color + "55";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Core
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Dark outline
      ctx.strokeStyle = "rgba(13,17,23,0.6)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Labels — only at sufficient zoom
      if (t.k > 0.55) {
        const isSet = node.kind === "set";
        ctx.fillStyle = isSet ? "#e6edf3" : "#8b949e";
        ctx.font = `${isSet ? 600 : 400} ${isSet ? 11 : 10}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const lbl = node.label.length > 24 ? node.label.slice(0, 22) + "…" : node.label;
        ctx.fillText(lbl, node.x, node.y + r + 3);
      }
    }

    ctx.restore();
  }, []);

  // ── apply search filter to raw data ───────────────────────────────────────
  const applyFilter = useCallback((q: string) => {
    const allNodes = rawNodesRef.current;
    const allEdges = rawEdgesRef.current;
    if (!q) {
      nodesRef.current = allNodes;
      edgesRef.current = allEdges;
    } else {
      const lq = q.toLowerCase();
      const visible = allNodes.filter(n => n.label.toLowerCase().includes(lq));
      const ids = new Set(visible.map(n => n.id));
      nodesRef.current = visible;
      edgesRef.current = allEdges.filter(e => {
        const sId = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
        const tId = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
        return ids.has(sId) && ids.has(tId);
      });
    }
    setNodeCount(nodesRef.current.length);
    // Restart sim with filtered nodes
    if (simRef.current) {
      simRef.current.nodes(nodesRef.current);
      (simRef.current.force("link") as d3.ForceLink<GraphNode, GraphEdge>).links(edgesRef.current);
      simRef.current.alpha(0.5).restart();
    }
  }, []);

  // ── load data + init sim ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/graph");
        if (!res.ok) throw new Error("Failed to load graph");
        const data = await res.json() as { nodes: GraphNode[]; edges: GraphEdge[] };
        if (cancelled) return;

        rawNodesRef.current = data.nodes;
        rawEdgesRef.current = data.edges;

        const canvas = canvasRef.current!;
        const W = canvas.width  || canvas.clientWidth  || 800;
        const H = canvas.height || canvas.clientHeight || 600;

        data.nodes.forEach(n => {
          n.x = W / 2 + (Math.random() - 0.5) * 300;
          n.y = H / 2 + (Math.random() - 0.5) * 300;
        });

        nodesRef.current = data.nodes;
        edgesRef.current = data.edges;
        setNodeCount(data.nodes.length);

        const sim = d3.forceSimulation<GraphNode>(data.nodes)
          .force("link", d3.forceLink<GraphNode, GraphEdge>(data.edges)
            .id(n => n.id)
            .distance(d => (d as GraphEdge).type === "set-parent" ? 90 : 55)
            .strength(0.45)
          )
          .force("charge", d3.forceManyBody<GraphNode>()
            .strength(n => (n as GraphNode).kind === "set" ? -220 : -70)
          )
          .force("center", d3.forceCenter(W / 2, H / 2))
          .force("collision", d3.forceCollide<GraphNode>()
            .radius(n => nodeRadius(n as GraphNode) + 10)
          )
          .on("tick", draw)
          .on("end", draw);

        simRef.current = sim;
        setLoading(false);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      simRef.current?.stop();
    };
  }, [draw]);

  // ── re-filter when search prop changes ───────────────────────────────────
  useEffect(() => {
    if (!loading) applyFilter(search);
  }, [search, loading, applyFilter]);

  // ── canvas resize ─────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      const dpr = window.devicePixelRatio;
      canvas.width  = width  * dpr;
      canvas.height = height * dpr;
      canvas.style.width  = width  + "px";
      canvas.style.height = height + "px";
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
      simRef.current?.alpha(0.1).restart();
      draw();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  // ── zoom ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 5])
      .on("zoom", e => { transformRef.current = e.transform as d3.ZoomTransform; draw(); });
    zoomRef.current = zoom;
    const sel = d3.select(canvas).call(zoom);
    // Disable D3's built-in double-click zoom so our dblclick handler works
    sel.on("dblclick.zoom", null);
    return () => { d3.select(canvas).on(".zoom", null); };
  }, [draw]);

  // ── drag + click + hover ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cv = canvas;

    function hitNode(ex: number, ey: number): GraphNode | null {
      const t = transformRef.current;
      const x = (ex - t.x) / t.k;
      const y = (ey - t.y) / t.k;
      for (let i = nodesRef.current.length - 1; i >= 0; i--) {
        const n  = nodesRef.current[i];
        const r  = nodeRadius(n) + 5;
        const dx = (n.x ?? 0) - x;
        const dy = (n.y ?? 0) - y;
        if (dx * dx + dy * dy <= r * r) return n;
      }
      return null;
    }

    let dragNode: GraphNode | null = null;
    let moved = false;

    function onMouseDown(e: MouseEvent) {
      const rect = cv.getBoundingClientRect();
      dragNode = hitNode(e.clientX - rect.left, e.clientY - rect.top);
      moved = false;
      if (dragNode) {
        simRef.current?.alphaTarget(0.3).restart();
        dragNode.fx = dragNode.x;
        dragNode.fy = dragNode.y;
        (e as Event & { stopImmediatePropagation(): void }).stopImmediatePropagation();
      }
    }

    function onMouseMove(e: MouseEvent) {
      const rect = cv.getBoundingClientRect();
      const t    = transformRef.current;
      if (dragNode) {
        moved = true;
        dragNode.fx = (e.clientX - rect.left - t.x) / t.k;
        dragNode.fy = (e.clientY - rect.top  - t.y) / t.k;
        return;
      }
      const hov = hitNode(e.clientX - rect.left, e.clientY - rect.top);
      if (hov) {
        setTooltip({ node: hov, x: e.clientX, y: e.clientY });
        cv.style.cursor = "pointer";
      } else {
        setTooltip(null);
        cv.style.cursor = "default";
      }
    }

    function onMouseUp() {
      if (dragNode) {
        simRef.current?.alphaTarget(0);
        dragNode.fx = null;
        dragNode.fy = null;
        dragNode = null;
      }
    }

    function onDblClick(e: MouseEvent) {
      const rect = cv.getBoundingClientRect();
      const node = hitNode(e.clientX - rect.left, e.clientY - rect.top);
      if (!node) return;
      if (node.kind === "set") router.push(`/archive?set=${node.id}`);
      else router.push(`/archive/${node.id}`);
    }

    cv.addEventListener("mousedown", onMouseDown);
    cv.addEventListener("mousemove", onMouseMove);
    cv.addEventListener("mouseup",   onMouseUp);
    cv.addEventListener("dblclick",  onDblClick);
    return () => {
      cv.removeEventListener("mousedown", onMouseDown);
      cv.removeEventListener("mousemove", onMouseMove);
      cv.removeEventListener("mouseup",   onMouseUp);
      cv.removeEventListener("dblclick",  onDblClick);
    };
  }, [router]);

  function zoomBy(f: number) {
    const canvas = canvasRef.current;
    const zoom   = zoomRef.current;
    if (!canvas || !zoom) return;
    d3.select(canvas).transition().duration(250).call(zoom.scaleBy, f);
  }

  function resetZoom() {
    const canvas = canvasRef.current;
    const zoom   = zoomRef.current;
    if (!canvas || !zoom) return;
    d3.select(canvas).transition().duration(300).call(zoom.transform, d3.zoomIdentity);
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", background: "#0d1117", overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />

      {/* Zoom controls */}
      <div style={{
        position: "absolute", top: 16, right: 16, zIndex: 10,
        display: "flex", flexDirection: "column",
        background: "#161b22", border: "1px solid #30363d",
        borderRadius: 8, overflow: "hidden",
      }}>
        <button onClick={() => zoomBy(1.3)} title="Zoom in" style={zoomBtnStyle}>
          <ZoomIn size={13} color="#8b949e" />
        </button>
        <div style={{ height: 1, background: "#30363d" }} />
        <button onClick={() => zoomBy(1 / 1.3)} title="Zoom out" style={zoomBtnStyle}>
          <ZoomOut size={13} color="#8b949e" />
        </button>
        <div style={{ height: 1, background: "#30363d" }} />
        <button onClick={resetZoom} title="Reset zoom" style={zoomBtnStyle}>
          <Maximize2 size={12} color="#8b949e" />
        </button>
      </div>

      {loading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <div style={{ width: 24, height: 24, border: "2.5px solid #30363d", borderTopColor: "#58a6ff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <p style={{ fontSize: 13, color: "#8b949e", fontFamily: "Inter, sans-serif" }}>Building constellation…</p>
        </div>
      )}

      {error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontSize: 13, color: "#f85149", fontFamily: "Inter, sans-serif" }}>{error}</p>
        </div>
      )}

      {!loading && nodeCount === 0 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#e6edf3", fontFamily: "Inter, sans-serif" }}>Nothing to show</p>
          <p style={{ fontSize: 12, color: "#8b949e", fontFamily: "Inter, sans-serif" }}>Create sets and artifacts in your Archive first.</p>
        </div>
      )}

      <Legend />

      {tooltip && !loading && (
        <Tooltip node={tooltip.node} x={tooltip.x} y={tooltip.y} />
      )}

      <div style={{
        position: "absolute", bottom: 16, right: 16, zIndex: 10,
        fontSize: 10, color: "#6e7681", fontFamily: "Inter, sans-serif",
        background: "rgba(22,27,34,0.8)", backdropFilter: "blur(4px)",
        border: "1px solid #30363d", borderRadius: 5, padding: "3px 8px",
      }}>
        Drag to move · Scroll to zoom · Double-click to open
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  width: 30, height: 30, display: "flex", alignItems: "center",
  justifyContent: "center", background: "none", border: "none",
  cursor: "pointer",
};
