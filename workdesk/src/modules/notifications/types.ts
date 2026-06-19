export type NotificationType =
  | "ARTIFACT_SHARED"
  | "MESSAGE_RECEIVED"
  | "BULLETIN_POSTED"
  | "ARTIFACT_PUBLISHED";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  meta: Record<string, string>;
  isRead: boolean;
  createdAt: Date;
}

export interface NotificationCounts {
  total: number;
  unread: number;
}
