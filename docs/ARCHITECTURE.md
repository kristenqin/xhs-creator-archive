# 技术方案草案

## 推荐架构

第一阶段采用本地优先架构：

```text
CLI
  -> Collector
      -> Local browser automation
      -> Creator profile parser
      -> Note detail parser
  -> Storage
      -> JSON metadata
      -> Local image files
      -> Collection logs
  -> Exporter
      -> HTML book
      -> PDF print output
```

## 为什么先做 CLI

- 最快验证采集和 PDF 成书的核心价值。
- 不需要马上处理桌面应用打包。
- 更容易调试页面结构和采集失败。
- 后续可以把核心模块复用到 Electron 或 Tauri。

## 采集策略

- 用户在本地浏览器中手动登录。
- 自动化只处理用户正常可见页面。
- 滚动加载笔记卡片时降低速度，优先稳定。
- 每采集一批内容就落盘，避免中断后丢失。
- 逐条记录失败原因，支持重试。

## PDF 生成策略

第一版可以先生成 HTML，再通过浏览器打印为 PDF：

- HTML 易调试，便于做阅读版和打印版样式。
- PDF 可以通过 `@page`、页眉页脚、分页规则控制。
- 后续可以扩展 A4、A5、省纸版、图片优先版等模板。

## 未来演进

- CLI 跑通后，增加桌面应用壳。
- 本地 SQLite 替代 JSON，提升查询和增量同步能力。
- 增加全局搜索、标签和阅读进度。
- 增加浏览器插件，降低采集入口摩擦。

