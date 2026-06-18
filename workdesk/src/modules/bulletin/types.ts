import type { BulletinType, CountdownStatus } from "@/lib/enums";

export interface BulletinSummary {
  id: string;
  authorId: string;
  authorName: string;
  type: BulletinType;
  title: string;
  body: string | null;
  dueAt: Date | null;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** For COUNTDOWN: total assigned users */
  totalAssignees: number;
  /** For COUNTDOWN: how many have completed */
  completedCount: number;
  /** For COUNTDOWN: current user's assignment status (null if not assigned) */
  myStatus: CountdownStatus | null;
}

export interface BulletinDetail extends BulletinSummary {
  assignments: CountdownAssignment[];
}

export interface CountdownAssignment {
  id: string;
  bulletinId: string;
  userId: string;
  userName: string;
  status: CountdownStatus;
  completedAt: Date | null;
}
