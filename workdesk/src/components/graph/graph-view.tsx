"use client";

import "@xyflow/react/dist/style.css";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";

import { useGraphData, useCreateRelationship, useDeleteRelationship } from "@/modules/graph/hooks";
import { useAuth } from "@/lib/auth-context";
import { LoadingState, ErrorState } from "@/components/ui/states";
import type { GraphArtifactNode, GraphRelationshipEdge, RelationshipType } from "@/modules/graph/types";

// ─────────────────────────────────────────────────────────────────────────────
// Colour helpers
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  TEXT:  "#a2c9ff",
  PDF:   "#ffba42",
  DOCX:  "#3FB950",
  PPTX:  "#f78166",
  IMAGE: "#bc8cff",
  ZIP:   "#8b949e",
  OTHER: "#8b949e",
};

const EDGE_COLOR: Record<RelationshipType, string> = {
  BELONGS_TO:  "#a2c9ff",
  RELATED_TO:  "#8b949e",
  DERIVED_FROM:"#ffba42",
  REPLACES:    "#f78166",
};

// ─────────────────────────────────────────────────────────────────────────────
// Custom node — one per artifact
// ─────────────────────────────────────────────────────────────────────────────

function ArtifactNode({ data }: { data: GraphArtifactNode & { selected?: boolean } }) {
  const color = TYPE_COLOR[data.type] ?? "#8b949e";
  const isPublic = data.visibility === "PUBLIC";
  const isShared = data.visibility === "SHARED";

  return (
    <div
      className="group flex flex-col items-center gap-1 cursor-pointer"
      style={{ minWidth: 80 }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          background: "#1c2026",
          border: `2px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: data.selected ? `0 0 0 3px ${color}55` : undefined,
          position: "relative",
        }}
      >
        <FileTypeIcon type={data.type} color={color} />
        {isPublic && (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#3FB950",
              border: "1.5px solid #0d1117",
            }}
            title="Public"
          />
        )}
        {isShared && !isPublic && (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#a2c9ff",
              border: "1.5px solid #0d1117",
            }}
            title="Shared"
          />
        )}
      </div>
      <div
        style={{
          maxWidth: 100,
          textAlign: "center",
          fontSize: 11,
          color: "#e6edf3",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          background: "#161b22cc",
          borderRadius: 4,
          padding: "1px 4px",
        }}
        title={data.title}
      >
        {data.title}
      </div>
    </div>
  );
}

function FileTypeIcon({ type, color }: { type: string; color: string }) {
  // Simple letter-based icons matching the type
  const letter = type.charAt(0);
  return (
    <span style={{ fontSize: 14, fontWeight: 700, color, letterSpacing: -0.5 }}>
      {letter}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Set cluster node — one per distinct set
// ─────────────────────────────────────────────────────────────────────────────

function SetClusterNode({ data }: { data: { label: string } }) {
  return (
    <div
      style={{
        padding: "4px 12px",
        borderRadius: 6,
        background: "#da960022",
        border: "1.5px solid #da9600",
        color: "#ffba42",
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {data.label}
    </div>
  );
}

const NODE_TYPES: NodeTypes = {
  artifact: ArtifactNode as NodeTypes[string],
  set: SetClusterNode as NodeTypes[string],
};

// ─────────────────────────────────────────────────────────────────────────────
// Layout helper — simple grid layout for initial positions
// ─────────────────────────────────────────────────────────────────────────────

function layoutNodes(artifacts: GraphArtifactNode[]): Node[] {
  // Group by set, then orphans last
  const bySet = new Map<string, GraphArtifactNode[]>();
  const orphans: GraphArtifactNode[] = [];
  for (const a of artifacts) {
    if (a.set_id) {
      const arr = bySet.get(a.set_id) ?? [];
      arr.push(a);
      bySet.set(a.set_id, arr);
    } else {
      orphans.push(a);
    }
  }

  const nodes: Node[] = [];
  let groupX = 80;

  // Render each set group as a cluster
  for (const [setId, members] of bySet.entries()) {
    const setName = members[0].set_name ?? "Unnamed Set";
    // Set label node
    nodes.push({
      id: `set-${setId}`,
      type: "set",
      position: { x: groupX, y: 30 },
      data: { label: setName },
      draggable: true,
      selectable: false,
    });
    // Artifact nodes below
    members.forEach((a, i) => {
      nodes.push({
        id: a.id,
        type: "artifact",
        position: { x: groupX + i * 120, y: 120 },
        data: { ...a },
        draggable: true,
      });
    });
    groupX += Math.max(members.length, 1) * 120 + 80;
  }

  // Orphan artifacts on the right
  orphans.forEach((a, i) => {
    nodes.push({
      id: a.id,
      type: "artifact",
      position: { x: groupX + i * 120, y: 120 },
      data: { ...a },
      draggable: true,
    });
  });

  return nodes;
}

function buildEdges(rels: GraphRelationshipEdge[]): Edge[] {
  return rels.map((r) => ({
    id: r.id,
    source: r.from_id,
    target: r.to_id,
    label: r.type.replace("_", " "),
    type: "smoothstep",
    animated: r.type === "DERIVED_FROM",
    style: { stroke: EDGE_COLOR[r.type], strokeWidth: 1.5 },
    labelStyle: { fill: "#8b949e", fontSize: 10 },
    labelBgStyle: { fill: "#161b22", fillOpacity: 0.8 },
    data: { relId: r.id, relType: r.type },
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail panel — shown when a node is selected
// ─────────────────────────────────────────────────────────────────────────────

function DetailPanel({
  node,
  edges,
  onClose,
  onDeleteEdge,
  userId,
}: {
  node: GraphArtifactNode;
  edges: Edge[];
  onClose: () => void;
  onDeleteEdge: (relId: string) => void;
  userId: string;
}) {
  const router = useRouter();
  const nodeEdges = edges.filter((e) => e.source === node.id || e.target === node.id);
  const color = TYPE_COLOR[node.type] ?? "#8b949e";

  return (
    <div
      style={{
        width: 280,
        background: "#161b22",
        border: "1px solid #30363d",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #30363d",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#0d1117",
        }}
      >
        <h3 style={{ color: "#e6edf3", fontSize: 14, fontWeight: 600, margin: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {node.title}
        </h3>
        <button
          onClick={onClose}
          style={{ color: "#8b949e", background: "none", border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 0 0 8px" }}
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {/* Properties */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: "#8b949e", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, margin: "0 0 8px" }}>Properties</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Prop label="Type">
              <span style={{ color, fontWeight: 600 }}>{node.type}</span>
            </Prop>
            <Prop label="Visibility">{node.visibility}</Prop>
            {node.set_name && <Prop label="Set">{node.set_name}</Prop>}
            <Prop label="Owner">{node.owner_name}</Prop>
            {(node.tags as string[]).length > 0 && (
              <div style={{ gridColumn: "1 / -1" }}>
                <p style={{ color: "#8b949e", fontSize: 10, margin: "0 0 4px" }}>Tags</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {(node.tags as string[]).map((t) => (
                    <span
                      key={t}
                      style={{ background: "#a2c9ff15", border: "1px solid #a2c9ff30", color: "#a2c9ff", borderRadius: 4, fontSize: 10, padding: "1px 6px" }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Relations */}
        {nodeEdges.length > 0 && (
          <div>
            <p style={{ color: "#8b949e", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
              Relations ({nodeEdges.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {nodeEdges.map((e) => {
                const isFrom = e.source === node.id;
                const relType = (e.data as { relType: RelationshipType }).relType;
                const relId   = (e.data as { relId: string }).relId;
                return (
                  <div
                    key={e.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "#1c2026",
                      borderRadius: 4,
                      padding: "4px 8px",
                      fontSize: 11,
                    }}
                  >
                    <span style={{ color: EDGE_COLOR[relType], fontWeight: 600, marginRight: 6 }}>
                      {isFrom ? "→" : "←"}
                    </span>
                    <span style={{ color: "#c0c7d4", flex: 1 }}>{relType.replace(/_/g, " ")}</span>
                    <button
                      onClick={() => onDeleteEdge(relId)}
                      style={{ color: "#8b949e", background: "none", border: "none", cursor: "pointer", fontSize: 12, padding: 0 }}
                      title="Remove relationship"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid #30363d", background: "#0d1117" }}>
        <button
          onClick={() => router.push(`/archive/${node.id}`)}
          style={{
            width: "100%",
            height: 32,
            background: "#1c2026",
            border: "1px solid #30363d",
            borderRadius: 6,
            color: "#e6edf3",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Open in Archive →
        </button>
      </div>
    </div>
  );
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ color: "#8b949e", fontSize: 10, margin: "0 0 2px" }}>{label}</p>
      <p style={{ color: "#e6edf3", fontSize: 12, margin: 0 }}>{children}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add-relationship modal
// ─────────────────────────────────────────────────────────────────────────────

const REL_TYPES: RelationshipType[] = ["RELATED_TO", "BELONGS_TO", "DERIVED_FROM", "REPLACES"];

function AddRelModal({
  fromNode,
  allNodes,
  onAdd,
  onClose,
}: {
  fromNode: GraphArtifactNode;
  allNodes: GraphArtifactNode[];
  onAdd: (toId: string, type: RelationshipType) => void;
  onClose: () => void;
}) {
  const [toId, setToId]   = useState("");
  const [type, setType]   = useState<RelationshipType>("RELATED_TO");
  const targets = allNodes.filter((n) => n.id !== fromNode.id);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#00000080",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#161b22",
          border: "1px solid #30363d",
          borderRadius: 8,
          padding: 24,
          width: 360,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ color: "#e6edf3", fontSize: 16, margin: "0 0 16px" }}>Add Relationship</h3>
        <p style={{ color: "#8b949e", fontSize: 12, margin: "0 0 16px" }}>
          From: <strong style={{ color: "#a2c9ff" }}>{fromNode.title}</strong>
        </p>

        <div style={{ marginBottom: 12 }}>
          <label style={{ color: "#8b949e", fontSize: 12, display: "block", marginBottom: 4 }}>Target artifact</label>
          <select
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, color: "#e6edf3", padding: "6px 8px", fontSize: 13 }}
          >
            <option value="">— select —</option>
            {targets.map((n) => (
              <option key={n.id} value={n.id}>{n.title}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ color: "#8b949e", fontSize: 12, display: "block", marginBottom: 4 }}>Relationship type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as RelationshipType)}
            style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, color: "#e6edf3", padding: "6px 8px", fontSize: 13 }}
          >
            {REL_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "6px 14px", background: "none", border: "1px solid #30363d", borderRadius: 6, color: "#8b949e", cursor: "pointer", fontSize: 13 }}
          >
            Cancel
          </button>
          <button
            onClick={() => { if (toId) { onAdd(toId, type); onClose(); } }}
            disabled={!toId}
            style={{ padding: "6px 14px", background: "#a2c9ff", border: "none", borderRadius: 6, color: "#00315c", fontWeight: 600, cursor: toId ? "pointer" : "not-allowed", fontSize: 13, opacity: toId ? 1 : 0.5 }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Graph View component
// ─────────────────────────────────────────────────────────────────────────────

export function GraphView() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useGraphData();
  const createRel = useCreateRelationship();
  const deleteRel = useDeleteRelationship();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [addRelFromId, setAddRelFromId] = useState<string | null>(null);

  // Build react-flow nodes and edges from API data
  const initialNodes = useMemo(() => {
    if (!data) return [];
    let artifacts = data.nodes;
    if (search) artifacts = artifacts.filter((a) => a.title.toLowerCase().includes(search.toLowerCase()));
    if (typeFilter) artifacts = artifacts.filter((a) => a.type === typeFilter);
    return layoutNodes(artifacts);
  }, [data, search, typeFilter]);

  const initialEdges = useMemo(() => {
    if (!data) return [];
    const visibleIds = new Set(initialNodes.map((n) => n.id));
    return buildEdges(data.edges.filter((e) => visibleIds.has(e.from_id) && visibleIds.has(e.to_id)));
  }, [data, initialNodes]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when data changes (re-query or filters change)
  useMemo(() => {
    // useNodesState / useEdgesState init from first render, so we force-update by
    // re-computing and passing new arrays when the upstream data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNodes, initialEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  const selectedArtifact = useMemo<GraphArtifactNode | null>(() => {
    if (!selectedNodeId || !data) return null;
    return data.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId, data]);

  const addRelFromArtifact = useMemo<GraphArtifactNode | null>(() => {
    if (!addRelFromId || !data) return null;
    return data.nodes.find((n) => n.id === addRelFromId) ?? null;
  }, [addRelFromId, data]);

  async function handleAddRelationship(toId: string, type: RelationshipType) {
    if (!addRelFromId) return;
    await createRel.mutateAsync({ fromId: addRelFromId, toId, type });
  }

  async function handleDeleteEdge(relId: string) {
    await deleteRel.mutateAsync(relId);
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <ErrorState message="Failed to load graph data." onRetry={() => refetch()} />
      </div>
    );
  }

  const allTypes = Array.from(new Set((data?.nodes ?? []).map((n) => n.type)));

  return (
    <div style={{ display: "flex", height: "100%", flexDirection: "column", background: "#0d1117" }}>
      {/* Top bar */}
      <div
        style={{
          height: 48,
          background: "#0d1117",
          borderBottom: "1px solid #30363d",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 16,
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <h1 style={{ color: "#e6edf3", fontSize: 16, fontWeight: 600, margin: 0 }}>Graph View</h1>
        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{ position: "relative" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search artifacts…"
            style={{
              background: "#161b22",
              border: "1px solid #30363d",
              borderRadius: 6,
              color: "#e6edf3",
              padding: "5px 10px 5px 28px",
              fontSize: 13,
              width: 220,
              outline: "none",
            }}
          />
          <svg style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6, color: "#e6edf3", padding: "5px 8px", fontSize: 13 }}
        >
          <option value="">All types</option>
          {allTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Node count badge */}
        <span style={{ color: "#8b949e", fontSize: 12 }}>
          {nodes.filter((n) => n.type === "artifact").length} nodes · {edges.length} edges
        </span>

        {/* Add relationship from selected */}
        {selectedNodeId && user && (
          <button
            onClick={() => setAddRelFromId(selectedNodeId)}
            style={{ background: "#a2c9ff", border: "none", borderRadius: 6, color: "#00315c", fontSize: 12, fontWeight: 600, padding: "5px 12px", cursor: "pointer" }}
          >
            + Relationship
          </button>
        )}
      </div>

      {/* Graph canvas + detail panel */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* React Flow canvas */}
        <div style={{ flex: 1, position: "relative" }}>
          <ReactFlow
            nodes={initialNodes}
            edges={initialEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={NODE_TYPES}
            onNodeClick={(_, node) => {
              if (node.type === "artifact") {
                setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
              }
            }}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={2}
            style={{ background: "#0d1117" }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              color="#30363d"
              gap={24}
              size={1}
            />
            <Controls
              style={{
                background: "#161b22",
                border: "1px solid #30363d",
                borderRadius: 6,
              }}
            />
            <MiniMap
              style={{ background: "#0d1117", border: "1px solid #30363d" }}
              nodeColor={(n) => {
                if (n.type === "set") return "#da9600";
                const artifact = n.data as unknown as GraphArtifactNode;
                return TYPE_COLOR[artifact?.type] ?? "#8b949e";
              }}
            />

            {/* Legend panel */}
            <Panel position="bottom-left">
              <div
                style={{
                  background: "#161b22cc",
                  backdropFilter: "blur(8px)",
                  border: "1px solid #30363d",
                  borderRadius: 8,
                  padding: 12,
                  minWidth: 160,
                }}
              >
                <p style={{ color: "#e6edf3", fontSize: 11, fontWeight: 600, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Legend</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <LegendRow color="#da9600" shape="rect" label="Set cluster" />
                  {Object.entries(TYPE_COLOR).map(([type, color]) => (
                    <LegendRow key={type} color={color} shape="rect" label={type} />
                  ))}
                  <div style={{ borderTop: "1px solid #30363d", margin: "4px 0" }} />
                  {Object.entries(EDGE_COLOR).map(([type, color]) => (
                    <LegendRow key={type} color={color} shape="line" label={type.replace(/_/g, " ")} />
                  ))}
                </div>
              </div>
            </Panel>

            {/* Empty state overlay */}
            {initialNodes.length === 0 && (
              <Panel position="top-center">
                <div
                  style={{
                    background: "#161b22",
                    border: "1px solid #30363d",
                    borderRadius: 8,
                    padding: "16px 24px",
                    textAlign: "center",
                    marginTop: 80,
                  }}
                >
                  <p style={{ color: "#e6edf3", fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>No artifacts found</p>
                  <p style={{ color: "#8b949e", fontSize: 12, margin: 0 }}>
                    {search || typeFilter ? "Try clearing the filters." : "Create artifacts in the Archive to see them here."}
                  </p>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Detail panel */}
        {selectedArtifact && (
          <DetailPanel
            node={selectedArtifact}
            edges={edges}
            onClose={() => setSelectedNodeId(null)}
            onDeleteEdge={handleDeleteEdge}
            userId={user?.id ?? ""}
          />
        )}
      </div>

      {/* Add relationship modal */}
      {addRelFromArtifact && (
        <AddRelModal
          fromNode={addRelFromArtifact}
          allNodes={data?.nodes ?? []}
          onAdd={handleAddRelationship}
          onClose={() => setAddRelFromId(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Legend helper
// ─────────────────────────────────────────────────────────────────────────────

function LegendRow({ color, shape, label }: { color: string; shape: "rect" | "line"; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {shape === "rect" ? (
        <div style={{ width: 12, height: 12, borderRadius: 2, background: `${color}33`, border: `1.5px solid ${color}`, flexShrink: 0 }} />
      ) : (
        <div style={{ width: 16, height: 1.5, background: color, flexShrink: 0 }} />
      )}
      <span style={{ color: "#8b949e", fontSize: 10 }}>{label}</span>
    </div>
  );
}
