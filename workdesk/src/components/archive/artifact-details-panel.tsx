"use client";

import { X, FileText, Calendar, User, Eye, Clock, Tag } from "lucide-react";
import { useArtifactDetail } from "@/modules/archive/hooks";

interface Props {
  artifactId: string;
  onClose: () => void;
}

export function ArtifactDetailsPanel({ artifactId, onClose }: Props) {
  const { data: artifact, isLoading } = useArtifactDetail(artifactId);

  return (
    <div className="w-[280px] shrink-0 border-l border-border-default bg-surface-secondary flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default shrink-0">
        <span className="text-[13px] font-semibold text-text-primary">Details</span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {isLoading && (
        <div className="p-4 space-y-3">
          {[80, 60, 70, 50].map((w, i) => (
            <div key={i} className="h-4 rounded bg-surface-elevated animate-pulse" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}

      {artifact && (
        <div className="flex-1 overflow-y-auto">
          {/* Preview placeholder */}
          <div className="m-4 h-28 rounded-lg bg-surface-elevated border border-border-default flex items-center justify-center">
            <FileText size={32} className="text-text-secondary" />
          </div>

          <div className="px-4 pb-4 space-y-4">
            {/* Title */}
            <p className="text-[13px] font-semibold text-text-primary leading-tight">{artifact.title}</p>

            {/* Information */}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary mb-2">Information</p>
              <div className="space-y-2">
                <Row icon={<FileText size={12} />} label="Type" value={artifact.type} />
                <Row icon={<Eye size={12} />} label="Visibility" value={artifact.visibility} />
                <Row icon={<User size={12} />} label="Owner" value="You" />
                <Row
                  icon={<Calendar size={12} />}
                  label="Created"
                  value={new Date(artifact.createdAt).toLocaleDateString()}
                />
                <Row
                  icon={<Clock size={12} />}
                  label="Modified"
                  value={new Date(artifact.updatedAt).toLocaleDateString()}
                />
              </div>
            </div>

            {/* Tags */}
            {artifact.tags.length > 0 && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {artifact.tags.map(t => (
                    <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-primary/10 text-primary border border-primary/20">
                      <Tag size={9} />
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {artifact.description && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary mb-2">Description</p>
                <p className="text-[12px] text-text-secondary leading-relaxed">{artifact.description}</p>
              </div>
            )}

            {/* Versions */}
            {artifact.versions.length > 0 && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-secondary mb-2">
                  Versions ({artifact.versions.length})
                </p>
                <div className="space-y-1.5">
                  {artifact.versions.slice(0, 5).map(v => (
                    <div key={v.id} className="flex items-center justify-between p-2 rounded bg-surface-elevated">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-text-primary">v{v.versionNumber}</span>
                        {v.changeSummary && (
                          <span className="text-[10px] text-text-secondary truncate max-w-[100px]">{v.changeSummary}</span>
                        )}
                      </div>
                      <span className="text-[10px] text-text-secondary shrink-0">
                        {new Date(v.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-text-secondary">
        {icon}
        <span className="text-[12px]">{label}</span>
      </div>
      <span className="text-[12px] text-text-primary capitalize">{value.toLowerCase()}</span>
    </div>
  );
}
