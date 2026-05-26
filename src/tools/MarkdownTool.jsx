import { useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'

// marked 默认透传 raw HTML, 所以 <details>/<summary> 这类能正常渲染折叠块
// (与 portal admin/job TraceJob 接口里的报告模板兼容).
//
// ⚠️ XSS 提示:
//   本工具仅作为本地工具箱使用 (同 origin, 登录态自己掌控), 没有渲染他人输入的场景.
//   如果未来要把 tools-online 公网开放给陌生用户, 必须在这里加 DOMPurify
//   或换 react-markdown + rehype-sanitize 等方案。
marked.setOptions({ gfm: true, breaks: false })

// 尝试把"被 JSON 字符串化"过一层的内容还原。
// 返回 [ok, decodedOrErrorMsg].
const unescapeOnce = (raw) => {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) {
    return [false, '输入为空']
  }
  // 形如 "...." (前后双引号), 直接 JSON.parse
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    try {
      const v = JSON.parse(trimmed)
      if (typeof v === 'string') return [true, v]
    } catch {
      // fallthrough 到下面再试
    }
  }
  // 裸的转义序列 (例如 hello\nworld), 套一层引号再 parse
  try {
    const v = JSON.parse('"' + raw.replace(/"/g, '\\"').replace(/\r?\n/g, '\\n') + '"')
    if (typeof v === 'string') return [true, v]
  } catch {
    // fallthrough
  }
  return [false, '解转义失败: 不是合法的 JSON 字符串形式 (可能已经是裸 markdown 了)']
}

export default function MarkdownTool() {
  const [text, setText] = useState('')
  const [mode, setMode] = useState('split') // 'split' | 'preview'
  const [flash, setFlash] = useState(null) // {kind: 'ok'|'err', msg: string}
  const flashTimerRef = useRef(null)

  // marked 缓存: text 不变就不重新解析
  const html = useMemo(() => marked.parse(text || ''), [text])

  // 字符 / 行数
  const stats = useMemo(() => {
    const chars = text.length
    const lines = text === '' ? 0 : text.split('\n').length
    return { chars, lines }
  }, [text])

  // 1.5s 自动清除提示
  const showFlash = (kind, msg) => {
    setFlash({ kind, msg })
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setFlash(null), 1500)
  }
  useEffect(() => () => flashTimerRef.current && clearTimeout(flashTimerRef.current), [])

  const onUnescape = () => {
    const [ok, result] = unescapeOnce(text)
    if (!ok) {
      showFlash('err', result)
      return
    }
    if (result === text) {
      // 解码结果跟原文一样: 说明原本就没有转义层 (例如已经是裸 markdown)
      showFlash('err', '无需解转义: 输入里没有 JSON 字符串转义层')
      return
    }
    setText(result)
    showFlash('ok', '已解一层')
  }

  const copy = async (data, label) => {
    try {
      await navigator.clipboard.writeText(data)
      showFlash('ok', `已复制${label}`)
    } catch (e) {
      showFlash('err', `复制失败: ${e.message}`)
    }
  }

  const onDownload = () => {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    a.download = `markdown-${ts}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showFlash('ok', '下载已开始')
  }

  return (
    <div className="tool markdown-tool">
      <h2>Markdown 解析</h2>
      <p className="hint">
        左侧粘贴 markdown 源码, 右侧实时渲染。如果内容形如
        <code>{'"# hi\\n\\nhello"'}</code> 这种被 JSON 字符串化了一层的格式, 点
        <strong>解转义</strong> 还原。支持原始 HTML 透传 (例如{' '}
        <code>{'<details>'}</code> 折叠块)。
      </p>

      {flash && <div className={`flash ${flash.kind}`}>{flash.msg}</div>}

      <div className="toolbar">
        <button onClick={onUnescape} disabled={!text}>解转义</button>
        <button className="ghost" onClick={() => copy(text, '源码')} disabled={!text}>
          复制源码
        </button>
        <button className="ghost" onClick={() => copy(html, ' HTML')} disabled={!text}>
          复制 HTML
        </button>
        <button className="ghost" onClick={onDownload} disabled={!text}>下载 .md</button>

        <span className="spacer" />

        <div className="seg">
          <button
            className={mode === 'split' ? 'seg-item active' : 'seg-item'}
            onClick={() => setMode('split')}
          >
            并排
          </button>
          <button
            className={mode === 'preview' ? 'seg-item active' : 'seg-item'}
            onClick={() => setMode('preview')}
          >
            纯渲染
          </button>
        </div>
      </div>

      <div className={mode === 'split' ? 'panes-split' : 'panes-preview'}>
        {mode === 'split' && (
          <div className="pane-source">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="把 markdown 粘进来…"
              spellCheck={false}
              wrap="soft"
            />
            <div className="stats">字符: {stats.chars} · 行: {stats.lines}</div>
          </div>
        )}

        <div
          className="md-preview"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}
