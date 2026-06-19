import type { Node, Edge } from "@xyflow/react";
import type { GraphData, GraphNode } from "@/modules/relationships/types";

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
        rawNode: n,
      },
      // Animate in with a staggered delay based on depth
      style: {
        opacity: 0,
        transform: "scale(0.85)",
        animation: `graphNodeIn 0.35s ease forwards`,
        animationDelay: `${(n.depth ?? 0) * 80}ms`,
      },
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
