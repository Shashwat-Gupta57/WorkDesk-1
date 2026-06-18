export interface ConversationSummary {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserEmail: string;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
  updatedAt: Date;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  artifactRefId: string | null;
  artifactRefTitle: string | null;
  artifactRefType: string | null;
  createdAt: Date;
  editedAt: Date | null;
}

export interface ConversationDetail {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserEmail: string;
  messages: MessageItem[];
  hasMore: boolean;
  nextCursor: string | null;
}
