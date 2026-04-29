import type { Creator, Note } from "./types.js";

type SampleArchiveInput = {
  creator: Creator;
};

export function buildSampleArchive(input: SampleArchiveInput): { creator: Creator; notes: Note[] } {
  const { creator } = input;
  const baseCollectedAt = creator.collectedAt;

  return {
    creator: {
      ...creator,
      nickname: "样例博主",
      bio: "用于验证本地归档、阅读排版和 PDF 导出的示例数据。",
      stats: {
        notes: 3
      }
    },
    notes: [
      {
        id: `${creator.id}-001`,
        creatorId: creator.id,
        platform: "xhs",
        sourceUrl: `${creator.profileUrl}#note-001`,
        title: "厨房收纳的一次小升级",
        content:
          "把调料区重新整理之后，做饭的阻力会明显下降。第一版先记录文本内容，后续接入真实采集时再把图片一起落盘。",
        media: [
          {
            id: `${creator.id}-001-cover`,
            type: "image",
            alt: "厨房收纳示意图占位"
          }
        ],
        publishedAt: "2026-03-08T09:00:00.000Z",
        collectedAt: baseCollectedAt,
        status: "collected"
      },
      {
        id: `${creator.id}-002`,
        creatorId: creator.id,
        platform: "xhs",
        sourceUrl: `${creator.profileUrl}#note-002`,
        title: "把零碎灵感整理成可复用清单",
        content:
          "很多值得保存的内容，真正有价值的不是当下看过，而是之后还能重新找到。归档工具的第一目标就是降低再次回看的摩擦。",
        media: [],
        publishedAt: "2026-03-18T09:00:00.000Z",
        collectedAt: baseCollectedAt,
        status: "collected"
      },
      {
        id: `${creator.id}-003`,
        creatorId: creator.id,
        platform: "xhs",
        sourceUrl: `${creator.profileUrl}#note-003`,
        title: "慢阅读比追更新更重要",
        content:
          "与其依赖推荐流再次偶遇，不如把真正想留住的内容整理成本地书架。这样阅读节奏就重新回到了自己手里。",
        media: [
          {
            id: `${creator.id}-003-cover`,
            type: "image",
            alt: "阅读场景占位图"
          }
        ],
        publishedAt: "2026-04-02T09:00:00.000Z",
        collectedAt: baseCollectedAt,
        status: "collected"
      }
    ]
  };
}
