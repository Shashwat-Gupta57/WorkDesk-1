import type { Node, Edge } from "@xyflow/react";
import type { GraphData, GraphNode } from "@/modules/relationships/types";

// ─────────────────────────────────────────────────────────────────────────────
// Floating layout — groups artifacts under their set header.
// Sets are placed left-to-right; artifacts fan out below each set.
// Orphan artifacts land on the far right. Relationship edges are drawn
// with animated dashed lines between artifact nodes.
// ─────────────────────────────────────────────────────────────────────────────

const F_ARTIFACT_W = 130;
const F_ARTIFACT_H = 80;
const F_SET_H = 50;
const F_COL_GAP = 60;   // horizontal gap between set groups
const F_ROW_GAP = 48;   // vertical gap between set header and first artifact row
const F_ITEM_GAP = 20;  // gap between artifact nodes within a group

const EDGE_COLORS: Record<string, string> = {
  BELONGS_TO:   "#58a6ff",
  RELATED_TO:   "#8b949e",
  DERIVED_FROM: "#d29922",
  REPLACES:     "#f85149",
};

export function buildFloatingGraph(data: GraphData): { nodes: Node[]; edges: Edge[] } {
  const { nodes: gNodes, edges: gEdges } = data;

  // Separate members (team view roots), sets, and artifacts
  const memberNodes = gNodes.filter(n => n.type === "member");
  const setNodes    = gNodes.filter(n => n.type === "set" || n.type === "subset");
  const artifactNodes = gNodes.filter(n => n.type === "artifact");

  // Group artifacts by parentId (set they belong to)
  const bySet = new Map<string, GraphNode[]>();
  const orphanArtifacts: GraphNode[] = [];
  for (const a of artifactNodes) {
    if (a.parentId) {
      const arr = bySet.get(a.parentId) ?? [];
      arr.push(a);
      bySet.set(a.parentId, arr);
    } else {
      orphanArtifacts.push(a);
    }
  }

  const flowNodes: Node[] = [];
  let cursorX = 60;
  const ARTIFACT_Y = 160; // y where artifact rows start (below set header)

  // Member nodes — float across the very top if team view
  if (memberNodes.length > 0) {
    memberNodes.forEach((m, i) => {
      flowNodes.push({
        id: m.id,
        type: "memberNode",
        position: { x: 60 + i * (F_ARTIFACT_W + F_ITEM_GAP), y: -120 },
        data: { label: m.label, depth: m.depth ?? 0, rawNode: m },
        draggable: true,
      });
    });
  }

  // Set groups — each set header + its artifacts in a grid below
  for (const setNode of setNodes) {
    const members = bySet.get(setNode.id) ?? [];
    const cols = Math.max(1, Math.ceil(Math.sqrt(members.length)));
    const groupW = Math.max(
      140,
      cols * F_ARTIFACT_W + (cols - 1) * F_ITEM_GAP,
    );

    // Set header node
    flowNodes.push({
      id: setNode.id,
      type: "setNode",
      position: { x: cursorX + (groupW - 140) / 2, y: 60 },
      data: {
        label: setNode.label,
        nodeType: setNode.type,
        depth: setNode.depth ?? 0,
        rawNode: setNode,
      },
      draggable: true,
    });

    // Artifact nodes in a grid below the set header
    members.forEach((a, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      flowNodes.push({
        id: a.id,
        type: "artifactNode",
        position: {
          x: cursorX + col * (F_ARTIFACT_W + F_ITEM_GAP),
          y: ARTIFACT_Y + row * (F_ARTIFACT_H + F_ITEM_GAP),
        },
        data: {
          label: a.label,
          nodeType: a.type,
          artifactType: a.artifactType,
          visibility: a.visibility,
          tags: a.tags ?? [],
          ownerName: a.ownerName,
          depth: a.depth ?? 0,
          rawNode: a,
        },
        draggable: true,
      });
    });

    cursorX += groupW + F_COL_GAP;
  }

  // Orphan artifacts — no set, placed in a row at the end
  if (orphanArtifacts.length > 0) {
    const cols = Math.max(1, Math.ceil(Math.sqrt(orphanArtifacts.length)));
    orphanArtifacts.forEach((a, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      flowNodes.push({
        id: a.id,
        type: "artifactNode",
        position: {
          x: cursorX + col * (F_ARTIFACT_W + F_ITEM_GAP),
          y: ARTIFACT_Y + row * (F_ARTIFACT_H + F_ITEM_GAP),
        },
        data: {
          label: a.label,
          nodeType: a.type,
          artifactType: a.artifactType,
          visibility: a.visibility,
          tags: a.tags ?? [],
          ownerName: a.ownerName,
          depth: a.depth ?? 0,
          rawNode: a,
        },
        draggable: true,
      });
    });
  }

  // Edges — only relationship edges are drawn in floating mode
  // (hierarchy is implied by spatial grouping, no connecting lines needed)
  const flowEdges: Edge[] = gEdges
    .filter(e => e.edgeType === "relationship")
    .map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      animated: true,
      label: e.relationshipType?.replace(/_/g, " ").toLowerCase(),
      labelStyle: { fill: "#8b949e", fontSize: 9, fontFamily: "Inter, sans-serif" },
      style: {
        stroke: EDGE_COLORS[e.relationshipType ?? "RELATED_TO"] ?? "#8b949e",
        strokeWidth: 1.5,
        strokeDasharray: "5 4",
      },
      markerEnd: {
        type: "arrowclosed" as const,
        color: EDGE_COLORS[e.relationshipType ?? "RELATED_TO"] ?? "#8b949e",
        width: 12,
        height: 12,
      },
    }));

  return { nodes: flowNodes, edges: flowEdges };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tree layout — top-down, breadth-first.
// Positions nodes in horizontal bands per depth level.
// Each subtree is centred over its children.
// ─────────────────────────────────────────────────────────────────────────────

const NODE_W = 160;
const NODE_H = 70;
const H_GAP = 28;   // horizontal gap between siblings
const V_GAP = 80;   // vertical gap between levels

export function buildFlowGraph(data: GraphData): { nodes: Node[]; edges: Edge[] } {
  const { nodes: gNodes, edges: gEdges } = data;

  // Build children map
  const childrenOf = new Map<string | null, string[]>();
  gNodes.forEach(n => {
    const parent = n.parentId ?? null;
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent)!.push(n.id);
  });

  // For team view, member nodes are roots (parentId undefined)
  // For personal view, depth-1 nodes without parentId are roots.
  const nodeMap = new Map<string, GraphNode>(gNodes.map(n => [n.id, n]));

  const xPos = new Map<string, number>();
  const yPos = new Map<string, number>();

  // Assign x positions via post-order traversal (leaf → root centring)
  let leafCounter = 0;

  function assignX(id: string): { left: number; right: number } {
    const children = childrenOf.get(id) ?? [];
    if (children.length === 0) {
      const x = leafCounter * (NODE_W + H_GAP);
      leafCounter++;
      xPos.set(id, x);
      return { left: x, right: x };
    }
    const spans = children.map(c => assignX(c));
    const leftMost = Math.min(...spans.map(s => s.left));
    const rightMost = Math.max(...spans.map(s => s.right));
    xPos.set(id, (leftMost + rightMost) / 2);
    return { left: leftMost, right: rightMost };
  }

  function assignY(id: string, depth: number) {
    yPos.set(id, depth * (NODE_H + V_GAP));
    const children = childrenOf.get(id) ?? [];
    children.forEach(c => assignY(c, depth + 1));
  }

  // Find true roots: nodes with no parent in the node set
  const allIds = new Set(gNodes.map(n => n.id));
  const roots = gNodes.filter(n => {
    if (!n.parentId) return true;
    return !allIds.has(n.parentId);
  });

  // Assign positions for each root tree
  roots.forEach(r => {
    assignX(r.id);
    assignY(r.id, 0);
  });

  // Build React Flow nodes
  const flowNodes: Node[] = gNodes.map(n => {
    const x = xPos.get(n.id) ?? 0;
    const y = yPos.get(n.id) ?? 0;

    let type = "setNode";
    if (n.type === "member") type = "memberNode";
    else if (n.type === "artifact") type = "artifactNode";

    return {
      id: n.id,
      type,
      position: { x, y },
      data: {
        label: n.label,
        nodeType: n.type,
        artifactType: n.artifactType,
        visibility: n.visibility,
        tags: n.tags ?? [],
        ownerName: n.ownerName,
        ownerId: n.ownerId,
        depth: n.depth ?? 0,
        rawNode: n,
      },
      draggable: true,
      // NOTE: no `style.animation`/`transform` here. React Flow drives the
      // wrapper's `transform` for positioning & dragging — animating transform
      // on the wrapper freezes the node in place. The entrance animation lives
      // on each node component's inner <div> instead (opacity-only).
    };
  });

  // Build React Flow edges
  const flowEdges: Edge[] = gEdges.map(e => {
    const isRelationship = e.edgeType === "relationship";
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      animated: isRelationship,
      label: isRelationship ? e.relationshipType?.replace("_", " ").toLowerCase() : undefined,
      labelStyle: { fill: "#8b949e", fontSize: 9, fontFamily: "Inter, sans-serif" },
      style: {
        stroke: isRelationship ? "#bc8cff" : "#30363d",
        strokeWidth: isRelationship ? 1.5 : 1,
        strokeDasharray: isRelationship ? "4 3" : undefined,
      },
      markerEnd: isRelationship ? { type: "arrowclosed" as const, color: "#bc8cff", width: 12, height: 12 } : undefined,
    };
  });

  return { nodes: flowNodes, edges: flowEdges };
}
