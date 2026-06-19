"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

// ─────────────────────────────────────────────────────────────────────────────
// Colour palette for node types — derived from WorkDesk design system
// ─────────────────────────────────────────────────────────────────────────────

export const NODE_COLORS = {
  member:  { bg: "#2d1f4e", border: "#bc8cff", text: "#e2c8ff", icon: "👤" },
  set:     { bg: "#0f2942", border: "#58a6ff", text: "#a5c8ff", icon: "📁" },
  subset:  { bg: "#0e2235", border: "#388bfd", text: "#89b4f7", icon: "📂" },
  TEXT:    { bg: "#0f2a1a", border: "#3fb950", text: "#7ee787", icon: "📝" },
  PDF:     { bg: "#2d1515", border: "#f85149", text: "#ffa198", icon: "📄" },
  IMAGE:   { bg: "#2a1f00", border: "#d29922", text: "#f0c040", icon: "🖼️" },
  DOCX:    { bg: "#0d2035", border: "#79c0ff", text: "#b0d9ff", icon: "📃" },
  PPTX:   { bg: "#2a1600", border: "#ffa657", text: "#ffcb8e", icon: "📊" },
  ZIP:     { bg: "#1a1a1a", border: "#8b949e", text: "#b1bac4", icon: "🗜️" },
  OTHER:   { bg: "#1c1c1c", border: "#6e7681", text: "#a0a8b0", icon: "📎" },
} as const;

export type ColorKey = keyof typeof NODE_COLORS;

function colorFor(nodeType: string, artifactType?: string): typeof NODE_COLORS[ColorKey] {
  if (nodeType === "member") return NODE_COLORS.member;
  if (nodeType === "set") return NODE_COLORS.set;
  if (nodeType === "subset") return NODE_COLORS.subset;
  if (artifactType && artifactType in NODE_COLORS) return NODE_COLORS[artifactType as ColorKey];
  return NODE_COLORS.OTHER;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handle style — invisible click target
// ─────────────────────────────────────────────────────────────────────────────

const handleStyle = { background: "transparent", border: "none", width: 8, height: 8 };

// ─────────────────────────────────────────────────────────────────────────────
// MemberNode — team member root (team view only)
// ─────────────────────────────────────────────────────────────────────────────

export const MemberNode = memo(({ data }: { data: { label: string; depth?: number } }) => {
  const color = NODE_COLORS.member;
  return (
    <div
      className="graph-node graph-node--member graph-node-in"
      style={{
        animationDelay: `${(data.depth ?? 0) * 80}ms`,
        background: color.bg,
        border: `2px solid ${color.border}`,
        borderRadius: "50%",
        width: 72,
        height: 72,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 0 0 4px ${color.border}22`,
        cursor: "pointer",
        transition: "box-shadow 0.2s ease",
      }}
    >
      <span style={{ fontSize: 24 }}>👤</span>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  );
});
MemberNode.displayName = "MemberNode";

// ─────────────────────────────────────────────────────────────────────────────
// SetNode — parent set or subset
// ─────────────────────────────────────────────────────────────────────────────

export const SetNode = memo(({ data }: {
  data: { label: string; nodeType: "set" | "subset"; artifactType?: string; depth?: number }
}) => {
  const color = colorFor(data.nodeType, data.artifactType);
  const isRoot = data.nodeType === "set";
  return (
    <div
      className="graph-node-in"
      style={{
        animationDelay: `${(data.depth ?? 0) * 80}ms`,
        background: color.bg,
        border: `1.5px solid ${color.border}`,
        borderRadius: isRoot ? 10 : 8,
        padding: "8px 14px",
        minWidth: 110,
        maxWidth: 160,
        textAlign: "center",
        boxShadow: isRoot
          ? `0 0 12px ${color.border}44, 0 2px 8px #00000066`
          : `0 0 6px ${color.border}33, 0 1px 4px #00000044`,
        cursor: "pointer",
        transition: "box-shadow 0.2s ease, transform 0.15s ease",
        position: "relative",
      }}
    >
      <div style={{ fontSize: 16, marginBottom: 2 }}>{isRoot ? "📁" : "📂"}</div>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: color.text,
        lineHeight: 1.3,
        wordBreak: "break-word",
        fontFamily: "Inter, sans-serif",
        letterSpacing: "0.01em",
      }}>
        {data.label}
      </div>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  );
});
SetNode.displayName = "SetNode";

// ─────────────────────────────────────────────────────────────────────────────
// ArtifactNode — leaf document node
// ─────────────────────────────────────────────────────────────────────────────

export const ArtifactNode = memo(({ data }: {
  data: {
    label: string;
    artifactType?: string;
    visibility?: string;
    tags?: string[];
    ownerName?: string;
    depth?: number;
  }
}) => {
  const color = colorFor("artifact", data.artifactType);
  const icon = color.icon;

  return (
    <div
      className="graph-node-in"
      style={{
        animationDelay: `${(data.depth ?? 0) * 80}ms`,
        background: color.bg,
        border: `1.5px solid ${color.border}`,
        borderRadius: 7,
        padding: "6px 12px",
        minWidth: 90,
        maxWidth: 140,
        textAlign: "center",
        boxShadow: `0 0 6px ${color.border}33, 0 1px 4px #00000044`,
        cursor: "pointer",
        transition: "box-shadow 0.2s ease, transform 0.15s ease",
        position: "relative",
      }}
    >
      <div style={{ fontSize: 14, marginBottom: 2 }}>{icon}</div>
      <div style={{
        fontSize: 10,
        fontWeight: 500,
        color: color.text,
        lineHeight: 1.3,
        wordBreak: "break-word",
        fontFamily: "Inter, sans-serif",
      }}>
        {data.label}
      </div>
      {data.visibility === "PUBLIC" && (
        <div style={{
          position: "absolute",
          top: -6,
          right: -6,
          fontSize: 8,
          background: "#1f6feb",
          color: "#e6edf3",
          borderRadius: 4,
          padding: "1px 4px",
          fontWeight: 700,
          letterSpacing: "0.05em",
        }}>
          PUB
        </div>
      )}
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  );
});
ArtifactNode.displayName = "ArtifactNode";
