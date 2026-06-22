import { useLayoutEffect, useMemo, useRef, useState } from 'react'

const LINE_HEIGHT = 20.8

const safeParseJson = (text) => {
  if (!text.trim()) return { ok: false, value: null }

  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false, value: null }
  }
}

const formatJson = (text, space) => {
  const parsed = safeParseJson(text)
  if (!parsed.ok) return text
  return JSON.stringify(parsed.value, null, space)
}

const escapeText = (text) => JSON.stringify(text).slice(1, -1)

const unescapeText = (text) => {
  if (!text) return ''

  try {
    const normalized = text.replace(/\r?\n/g, '\\n').replace(/"/g, '\\"')
    const parsed = JSON.parse(`"${normalized}"`)
    return typeof parsed === 'string' ? parsed : text
  } catch {
    return text
  }
}

const buildFileName = (prefix) => {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${prefix}-${ts}.json`
}

const findFoldRanges = (text) => {
  if (!safeParseJson(text).ok || !text.includes('\n')) return new Map()

  const ranges = new Map()
  const stack = []
  let line = 0
  let inString = false
  let escaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (char === '\n') {
      line += 1
      escaped = false
      continue
    }

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{' || char === '[') {
      stack.push({ char, line })
      continue
    }

    if (char !== '}' && char !== ']') continue

    const start = stack.pop()
    if (!start || start.line === line) continue
    if (!ranges.has(start.line)) ranges.set(start.line, line)
  }

  return ranges
}

const createVisibleLines = (text, ranges, collapsed) => {
  const lines = text.split('\n')
  const visible = []

  for (let index = 0; index < lines.length; index += 1) {
    const endLine = ranges.get(index)
    const isCollapsed = endLine !== undefined && collapsed.has(index)

    visible.push({
      number: index + 1,
      text: isCollapsed ? `${lines[index]} …` : lines[index],
      canFold: endLine !== undefined,
      isCollapsed,
      sourceLine: index,
    })

    if (isCollapsed) index = endLine
  }

  return visible
}

function JsonTextEditor({ value, onChange, placeholder, wrap, readOnly = false }) {
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [rowHeights, setRowHeights] = useState([])
  const gutterRef = useRef(null)
  const measureRef = useRef(null)
  const textareaRef = useRef(null)

  const ranges = useMemo(() => findFoldRanges(value), [value])
  const visibleLines = useMemo(
    () => createVisibleLines(value, ranges, collapsed),
    [collapsed, ranges, value],
  )
  const hasCollapsed = collapsed.size > 0
  const displayValue = visibleLines.map((line) => line.text).join('\n')
  const isReadOnly = readOnly || hasCollapsed

  useLayoutEffect(() => {
    setCollapsed(new Set())
  }, [value])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(textarea.scrollHeight, 560)}px`
  }, [displayValue, wrap])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    const measure = measureRef.current
    if (!textarea || !measure) return undefined

    const updateRowHeights = () => {
      if (!wrap) {
        setRowHeights(visibleLines.map(() => LINE_HEIGHT))
        return
      }

      measure.style.width = `${textarea.clientWidth}px`
      const rows = Array.from(measure.children)
      setRowHeights(rows.map((row) => Math.max(row.getBoundingClientRect().height, LINE_HEIGHT)))
    }

    updateRowHeights()

    if (!window.ResizeObserver) return undefined

    const observer = new ResizeObserver(updateRowHeights)
    observer.observe(textarea)
    return () => observer.disconnect()
  }, [displayValue, visibleLines, wrap])

  const toggleFold = (line) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(line)) next.delete(line)
      else next.add(line)
      return next
    })
  }

  const syncGutterScroll = (event) => {
    if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop
  }

  const getRowHeight = (index) => rowHeights[index] ?? LINE_HEIGHT

  return (
    <div className={isReadOnly ? 'json-editor readonly' : 'json-editor'}>
      <div className="json-measure" ref={measureRef} aria-hidden="true">
        {visibleLines.map((line) => (
          <div key={`${line.number}-${line.text}`} className="json-measure-row">
            {line.text || ' '}
          </div>
        ))}
      </div>
      <div className="json-gutter" ref={gutterRef} aria-hidden="true">
        <div className="json-gutter-inner">
          {visibleLines.map((line, index) => (
            <div
              key={`${line.number}-${line.text}`}
              className="json-gutter-row"
              style={{ height: `${getRowHeight(index)}px` }}
            >
              {line.canFold ? (
                <button
                  type="button"
                  className="json-fold-button"
                  title={line.isCollapsed ? '展开' : '折叠'}
                  onClick={() => toggleFold(line.sourceLine)}
                >
                  {line.isCollapsed ? '▶' : '▼'}
                </button>
              ) : (
                <span className="json-fold-spacer" />
              )}
              <span className="json-line-number">{line.number}</span>
            </div>
          ))}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={displayValue}
        onChange={(event) => onChange(event.target.value)}
        onScroll={syncGutterScroll}
        readOnly={isReadOnly}
        placeholder={placeholder}
        spellCheck={false}
        wrap={wrap ? 'soft' : 'off'}
        title={hasCollapsed ? '当前有折叠行，展开后可继续编辑' : undefined}
      />
    </div>
  )
}

export default function JsonTool() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('escape')
  const [inputWrap, setInputWrap] = useState(true)
  const [outputWrap, setOutputWrap] = useState(true)
  const [outputFormat, setOutputFormat] = useState('raw')
  const fileInputRef = useRef(null)

  const inputJson = useMemo(() => safeParseJson(input), [input])

  const rawOutput = useMemo(() => {
    if (mode === 'escape') return escapeText(input)
    return unescapeText(input)
  }, [input, mode])

  const output = useMemo(() => {
    if (outputFormat === 'pretty') return formatJson(rawOutput, 2)
    if (outputFormat === 'compact') return formatJson(rawOutput, 0)
    return rawOutput
  }, [outputFormat, rawOutput])

  const outputJson = useMemo(() => safeParseJson(output), [output])

  const copy = async (text) => {
    if (!text) return
    await navigator.clipboard.writeText(text)
  }

  const download = (text, prefix) => {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = buildFileName(prefix)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const onOpenFile = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => setInput(String(reader.result ?? ''))
    reader.readAsText(file)
    event.target.value = ''
  }

  const setModeAndResetOutputFormat = (nextMode) => {
    setMode(nextMode)
    setOutputFormat('raw')
  }

  return (
    <div className="tool json-tool">
      <h2>JSON 视图</h2>
      <p className="hint">
        左侧输入内容，右侧按当前模式实时输出转义或反转义结果。美化和压缩仅在对应文本框内容为合法 JSON 时可用。
      </p>

      <div className="json-grid">
        <section className="json-pane">
          <div className="json-toolbar">
            <button type="button" onClick={() => setInput('')} disabled={!input}>清除</button>
            <button type="button" onClick={() => fileInputRef.current?.click()}>打开文件</button>
            <input ref={fileInputRef} type="file" accept=".json,application/json,text/plain" onChange={onOpenFile} hidden />
            <button type="button" onClick={() => setInput(formatJson(input, 2))} disabled={!inputJson.ok}>美化</button>
            <button type="button" onClick={() => setInput(formatJson(input, 0))} disabled={!inputJson.ok}>压缩</button>
            <button type="button" className={inputWrap ? 'active' : ''} onClick={() => setInputWrap((value) => !value)}>自动换行</button>
            <button type="button" onClick={() => copy(input)} disabled={!input}>复制</button>
            <button type="button" onClick={() => download(input, 'json-input')} disabled={!input}>下载</button>
          </div>
          <JsonTextEditor
            value={input}
            onChange={setInput}
            placeholder="在这里输入 JSON 或需要转义/反转义的文本"
            wrap={inputWrap}
          />
        </section>

        <div className="json-switches" role="group" aria-label="转换模式">
          <button
            type="button"
            className={mode === 'escape' ? 'active' : ''}
            onClick={() => setModeAndResetOutputFormat('escape')}
          >
            转义
          </button>
          <button
            type="button"
            className={mode === 'unescape' ? 'active' : ''}
            onClick={() => setModeAndResetOutputFormat('unescape')}
          >
            反转义
          </button>
        </div>

        <section className="json-pane">
          <div className="json-toolbar">
            <button type="button" onClick={() => setOutputFormat('pretty')} disabled={!outputJson.ok}>美化</button>
            <button type="button" onClick={() => setOutputFormat('compact')} disabled={!outputJson.ok}>压缩</button>
            <button type="button" className={outputWrap ? 'active' : ''} onClick={() => setOutputWrap((value) => !value)}>自动换行</button>
            <button type="button" onClick={() => copy(output)} disabled={!output}>复制</button>
            <button type="button" onClick={() => download(output, 'json-output')} disabled={!output}>下载</button>
          </div>
          <JsonTextEditor
            value={output}
            onChange={() => {}}
            placeholder="右侧会自动显示输出结果"
            wrap={outputWrap}
            readOnly
          />
        </section>
      </div>
    </div>
  )
}
