import { useState } from 'react'

import JsonTool from './tools/JsonTool.jsx'
import MarkdownTool from './tools/MarkdownTool.jsx'
import SnowflakeTool from './tools/SnowflakeTool.jsx'
import UploadTool from './tools/UploadTool.jsx'

// 工具列表: 未来添加新工具只要追加一项 {id, name, description, component}
const TOOLS = [
  {
    id: 'upload',
    name: '项目模型流式上传',
    description: 'octet-stream 双端 fan-out',
    component: UploadTool,
  },
  {
    id: 'snowflake',
    name: 'Snowflake ID 互转',
    description: 'Base58 ↔ Int64',
    component: SnowflakeTool,
  },
  {
    id: 'markdown',
    name: 'Markdown 解析',
    description: '粘贴源码 → 实时渲染',
    component: MarkdownTool,
  },
  {
    id: 'json',
    name: 'JSON 视图',
    description: '转义 / 反转义 / 格式化',
    component: JsonTool,
  },
]

export default function App() {
  const [activeId, setActiveId] = useState(TOOLS[0].id)

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1 className="brand">🧰 工具箱</h1>
        <ul className="tool-list">
          {TOOLS.map((tool) => (
            <li key={tool.id}>
              <button
                type="button"
                className={tool.id === activeId ? 'tool-item active' : 'tool-item'}
                onClick={() => setActiveId(tool.id)}
              >
                <div className="tool-item-name">{tool.name}</div>
                <div className="tool-item-desc">{tool.description}</div>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main className="content">
        {TOOLS.map((tool) => {
          const Tool = tool.component
          const isActive = tool.id === activeId

          return (
            <section key={tool.id} aria-hidden={!isActive} hidden={!isActive}>
              <Tool />
            </section>
          )
        })}
      </main>
    </div>
  )
}
