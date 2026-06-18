export interface LibrarySectionSummary {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdByName: string;
  artifactCount: number;
  subscriberCount: number;
  isSubscribed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LibraryArtifactItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  tags: string[];
  ownerId: string;
  ownerName: string;
  visibility: string;
  addedBy: string;
  addedByName: string;
  addedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
