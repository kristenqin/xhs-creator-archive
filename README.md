# XHS Creator Archive

一个面向个人使用的“小红书优质博主离线归档成书工具”项目骨架。

当前阶段已经进入第一版原型：可以生成本地归档，并导出可打印 HTML 书稿和真实 PDF 文件，后续继续补强真实采集深度。

## 项目定位

当你偶然发现一个优质博主，但不想马上持续追更，也担心之后忘记账号时，可以把该博主当前公开可见的内容保存为一本本地“书”：

- 自动采集博主主页下当前可见的笔记清单。
- 保存标题、正文、图片、发布时间、原始链接等信息。
- 本地归档，后续可增量同步。
- 导出适合慢慢阅读和打印的 PDF。
- 保留来源信息，定位为个人备份和稍后阅读工具。

## 第一阶段目标

第一版优先做成本地工具，而不是 SaaS：

- `CLI + Playwright 浏览器自动化 + 本地文件归档 + PDF 导出`
- 数据默认保存在本机 `archives/` 目录。
- 采集流程尽量模拟用户正常浏览，不追求高并发。
- 初期只完整处理图文笔记，视频先保存元信息、封面和原链接。

## 推荐命令形态

后续计划提供类似命令：

```bash
npm run collect -- "https://www.xiaohongshu.com/user/profile/xxxx"
npm run export:pdf -- --creator "creator-id"
```

当前可先使用样例归档模式验证本地闭环：

```bash
npm run collect -- "https://www.xiaohongshu.com/user/profile/xxxx"
npm run collect -- "https://www.xiaohongshu.com/user/profile/xxxx" --sample
npm run export:pdf -- --creator "xxxx"
```

说明：

- `collect` 默认会启动本地浏览器，由你手动登录后采集当前页面可见的笔记卡片
- `collect --sample` 会生成样例博主与样例笔记，并写入 `archives/<creator-id>/`
- `collect --limit 12` 可以限制本次最多保存多少条列表卡片
- `export:pdf` 已经会把 HTML 真实打印成 PDF
- 当前真实采集仍处于第一步，只保存列表卡片信息，详情正文和图片下载后续补充

## 目录说明

```text
xhs-creator-archive/
  docs/              需求、技术方案、路线图
  src/
    cli/             CLI 入口
    collectors/      小红书采集适配层
    core/            核心类型和业务逻辑
    exporters/       PDF/HTML/Markdown 导出
    storage/         本地归档路径和存储
  archives/          本地归档数据目录，默认不提交内容
```

## 重要边界

本项目先按个人工具设计：

- 只归档你正常登录和浏览时可见的公开内容。
- 不绕过权限、付费墙或平台访问限制。
- 不采集私密内容和评论区。
- 默认保留作者、平台、原始链接和采集时间。
- 输出内容仅用于个人备份、稍后阅读和非商业打印。

详细说明见 [合规与使用边界](./docs/LEGAL_AND_USAGE.md)。

## 当前原型输出

执行一次样例流程后，目录大致如下：

```text
archives/
  creator-id/
    creator.json
    notes/
      creator-id-001.json
      creator-id-002.json
      creator-id-003.json
    media/
    exports/
      book.html
      book.pdf
    logs/
```
