# AI 学情诊断与个性化练习生成器

> 💡 项目定位：面向 K12 数学场景的 **LLM × RAG × Agent 工作流编排** Demo——把「错题多模态解析 → 结构化错因归因 → 知识点检索校验 → 分层靶向练习 → 评测闸门与 Prompt 灰度」串成一条可演示、可观测、可回滚的闭环链路。

**核心技术栈：** `Vite` · `React` · `TypeScript` · `Tailwind CSS` · `Recharts` · `Express (Vite Middleware)` · `Mock LLM / RAG` · `JSON Schema` · `Prompt Versioning`

## 🚀 核心亮点

### 架构设计
- **端到端工作流编排**：`parse → attribute → retrieve → practice → guardrail`，教师端 / 学生端 / 运营后台三端同仓，配置中心（`config/versions.json`）驱动前台命中版本。
- **人机协同闭环**：低置信度进复核队列，人工金标回流候选评测集；发布闸门绑定评测报告，未达标禁止进入灰度。
- **可演示的运营基建**：Prompt 版本状态机（草稿 → 灰度 → 全量 → 回滚）、流量比例、变更记录、线上效果看板与请求命中版本日志。

### 技术实现
- **结构化输出 + Schema 校验**：错因枚举与知识点 ID 正则约束；校验失败走兜底对象并写入护栏日志。
- **混合检索 RAG**：知识点切片库关键词匹配 + 预置 embedding 相似度打分，Top-5 重排取 Top-3 作为引用来源与 few-shot。
- **安全护栏**：学段白名单、敏感词拦截、PII 脱敏（姓名→学号）、超纲 / 重复题拦截，拦截条目可在练习区展开审计。
- **离线 Mock AI**：`lib/mockModel.ts` 模拟多模态解析与归因生成，全程无需真实 API Key，链路字段与可视化真实可跑通。

### 业务价值
- **教师**：单元测后批量归因、班级共性薄弱点热力 / 雷达、一键导出基础 / 巩固 / 拓展分层练习。
- **学生**：个人错因复盘、薄弱点趋势感知、靶向练习提交后自动批改并回写归因。
- **教研 / 运营**：Prompt 迭代有评测、有闸门、有灰度；避免「改完就全量」的黑盒上线。

> ⚠️ **合规声明**：本仓库 AI 能力均为本地 mock 与合成评测数据。页面中的准确率等数字**不得**对外表述为真实模型效果或已验证指标；真实指标需使用者自行执行评测并确认。

## 🛠️ 本地运行

```bash
# 1. 进入项目目录
cd 错题本工作台

# 2. 安装依赖
cp .env.example .env
npm install

# 3. 启动开发服务
npm run dev
```

浏览器打开：[http://127.0.0.1:5173/teacher/upload](http://127.0.0.1:5173/teacher/upload)

常用命令：

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm run build       # 生产构建
```

**3 分钟演示路径**：`/teacher/upload` 录入错题 → `/teacher/dashboard` 看板与生成练习 → `/admin/prompts` / `/admin/evals` 看版本与回归 → `/student/report` 学生复盘。

## GitHub Topics

建议仓库 Topics（复制到 GitHub About）：

`llm` · `rag` · `edtech` · `prompt-engineering` · `react-typescript`
