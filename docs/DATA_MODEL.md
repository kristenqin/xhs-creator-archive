# 数据模型草案

## Creator

```ts
type Creator = {
  id: string;
  platform: "xhs";
  nickname: string;
  profileUrl: string;
  avatarUrl?: string;
  bio?: string;
  collectedAt: string;
  lastSyncedAt?: string;
  stats?: CreatorStats;
};
```

## Note

```ts
type Note = {
  id: string;
  creatorId: string;
  platform: "xhs";
  sourceUrl: string;
  title: string;
  content: string;
  media: NoteMedia[];
  publishedAt?: string;
  collectedAt: string;
  contentHash?: string;
  status: "collected" | "partial" | "failed";
};
```

## NoteMedia

```ts
type NoteMedia = {
  id: string;
  type: "image" | "video-cover" | "video";
  sourceUrl?: string;
  localPath?: string;
  alt?: string;
};
```

## ExportRecord

```ts
type ExportRecord = {
  id: string;
  creatorId: string;
  format: "html" | "pdf" | "markdown";
  template: string;
  filePath: string;
  exportedAt: string;
};
```

## 本地目录建议

```text
archives/
  creator-id/
    creator.json
    notes/
      note-id.json
    media/
      note-id/
        001.jpg
        002.jpg
    exports/
      book.html
      book.pdf
    logs/
      collect-2026-04-23.log
```

