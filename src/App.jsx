import { useState } from 'react'

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
]

export default function App() {
  const [activeId, setActiveId] = useState(TOOLS[0].id)
  const active = TOOLS.find((t) => t.id === activeId)
  const Active = active?.component

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1 className="brand">🧰 工具箱</h1>
        <ul className="tool-list">
          {TOOLS.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className={t.id === activeId ? 'tool-item active' : 'tool-item'}
                onClick={() => setActiveId(t.id)}
              >
                <div className="tool-item-name">{t.name}</div>
                <div className="tool-item-desc">{t.description}</div>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main className="content">
        {Active ? <Active /> : <div className="empty">未选择工具</div>}
      </main>
    </div>
  )
}
