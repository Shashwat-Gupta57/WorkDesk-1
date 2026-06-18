"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useCreateBulletin } from "@/modules/bulletin/hooks";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import type { MemberSummary } from "@/app/api/members/route";

// ─────────────────────────────────────────────────────────────────────────────
// Create Bulletin dialog — Announcement or Countdown.
// ─────────────────────────────────────────────────────────────────────────────

export function CreateBulletinDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const create = useCreateBulletin();
  const { data: members = [] } = useQuery<MemberSummary[]>({
    queryKey: ["members"],
    queryFn: () => api.get<MemberSummary[]>("/api/members"),
    enabled: open,
    staleTime: 60_000,
  });

  const [type, setType] = useState<"ANNOUNCEMENT" | "COUNTDOWN">("ANNOUNCEMENT");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setType("ANNOUNCEMENT");
    setTitle("");
    setBody("");
    setDueAt("");
    setSelectedIds(new Set());
    setSearch("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function toggleMember(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      if (type === "ANNOUNCEMENT") {
        await create.mutateAsync({ type: "ANNOUNCEMENT", title, body: body || null });
      } else {
        if (!dueAt) { setError("A due date is required for countdowns."); return; }
        if (selectedIds.size === 0) { setError("Select at least one assignee."); return; }
        await create.mutateAsync({
          type: "COUNTDOWN",
          title,
          body: body || null,
          dueAt: new Date(dueAt).toISOString(),
          assigneeIds: Array.from(selectedIds),
        });
      }
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create bulletin.");
    }
  }

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal open={open} onClose={handleClose} title="New bulletin">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type selector */}
        <div className="flex gap-2">
          {(["ANNOUNCEMENT", "COUNTDOWN"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={
                "flex-1 rounded-md border py-2 text-sm font-medium transition-colors " +
                (type === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border-default text-text-secondary hover:border-primary/50 hover:text-text-primary")
              }
            >
              {t === "ANNOUNCEMENT" ? "Announcement" : "Countdown"}
            </button>
          ))}
        </div>

        <Field label="Title" htmlFor="bulletin-title">
          <Input
            id="bulletin-title"
            required
            maxLength={255}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === "ANNOUNCEMENT" ? "Announcement title…" : "Task or deadline title…"}
          />
        </Field>

        <Field label="Body (optional)" htmlFor="bulletin-body">
          <Textarea
            id="bulletin-body"
            rows={3}
            maxLength={2000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Additional details…"
          />
        </Field>

        {type === "COUNTDOWN" && (
          <>
            <Field label="Due date & time" htmlFor="bulletin-due">
              <Input
                id="bulletin-due"
                type="datetime-local"
                required
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </Field>

            <div>
              <p className="mb-1.5 text-sm text-text-secondary">Assignees</p>
              <Input
                placeholder="Search members…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-2"
              />
              <ul className="max-h-44 overflow-y-auto rounded-md border border-border-default divide-y divide-border-default">
                {filteredMembers.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-text-secondary">No members found.</li>
                ) : (
                  filteredMembers.map((m) => (
                    <li key={m.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-container-high">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(m.id)}
                          onChange={() => toggleMember(m.id)}
                          className="accent-primary"
                        />
                        <span className="text-sm text-text-primary">{m.name}</span>
                        <span className="ml-auto text-xs text-text-secondary">{m.email}</span>
                      </label>
                    </li>
                  ))
                )}
              </ul>
              {selectedIds.size > 0 && (
                <p className="mt-1.5 text-xs text-text-secondary">{selectedIds.size} selected</p>
              )}
            </div>
          </>
        )}

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Posting…" : "Post"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
