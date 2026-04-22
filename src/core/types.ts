export type Platform = "xhs";

export type CreatorStats = {
  notes?: number;
  followers?: number;
  following?: number;
  likedAndCollected?: number;
};

export type Creator = {
  id: string;
  platform: Platform;
  nickname: string;
  profileUrl: string;
  avatarUrl?: string;
  bio?: string;
  collectedAt: string;
  lastSyncedAt?: string;
  stats?: CreatorStats;
};

export type NoteMedia = {
  id: string;
  type: "image" | "video-cover" | "video";
  sourceUrl?: string;
  localPath?: string;
  alt?: string;
};

export type Note = {
  id: string;
  creatorId: string;
  platform: Platform;
  sourceUrl: string;
  title: string;
  content: string;
  media: NoteMedia[];
  publishedAt?: string;
  collectedAt: string;
  contentHash?: string;
  status: "collected" | "partial" | "failed";
};

export type ExportFormat = "html" | "pdf" | "markdown";

export type ExportRecord = {
  id: string;
  creatorId: string;
  format: ExportFormat;
  template: string;
  filePath: string;
  exportedAt: string;
};

