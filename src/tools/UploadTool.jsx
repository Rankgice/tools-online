import { useState } from 'react'

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

const formatDuration = (ms) => {
  if (ms < 1) return `${ms.toFixed(3)} ms`
  if (ms < 1000) return `${ms.toFixed(1)} ms`
  return `${(ms / 1000).toFixed(3)} s`
}

const computeThroughput = (bytes, ms) => {
  if (!bytes || !ms) return '-'
  const bytesPerSec = (bytes / ms) * 1000
  return `${formatBytes(bytesPerSec)}/s`
}

// 把完整 Cookie 字符串写到当前 origin 下, 后续 XHR (withCredentials) 会自动带上
// 浏览器禁止 XHR 直接 setRequestHeader('Cookie', ...), 所以用 document.cookie 间接落
const applyCookieString = (raw) => {
  const trimmed = raw.trim()
  if (!trimmed) return 0
  let count = 0
  for (const pair of trimmed.split(/;\s*/)) {
    const eq = pair.indexOf('=')
    if (eq <= 0) continue
    const name = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1).trim()
    if (!name) continue
    // path=/ 让所有路径都能看到; 不写 domain 让它落到当前 host (localhost:5173)
    document.cookie = `${name}=${value}; path=/`
    count++
  }
  return count
}

export default function UploadTool() {
  const [cookieRaw, setCookieRaw] = useState('')
  const [cookieMsg, setCookieMsg] = useState(null)

  const [projectId, setProjectId] = useState('')
  const [activeOrg, setActiveOrg] = useState('')
  const [file, setFile] = useState(null)
  const [fileMd5, setFileMd5] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [phaseTimings, setPhaseTimings] = useState(null) // { uploadMs, serverMs, totalMs }
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const reset = () => {
    setResult(null)
    setError(null)
    setProgress(0)
    setPhaseTimings(null)
  }

  const onApplyCookie = () => {
    const n = applyCookieString(cookieRaw)
    if (n > 0) {
      setCookieMsg(`已写入 ${n} 条 cookie 到 localhost:5173`)
    } else {
      setCookieMsg('没解析到任何 name=value, 请检查格式')
    }
  }

  const onPickFile = (e) => {
    const f = e.target.files?.[0] || null
    setFile(f)
    reset()
  }

  const onUpload = () => {
    if (!file) {
      setError('请先选择文件')
      return
    }
    if (!projectId.trim()) {
      setError('请填入 X-Project-Id')
      return
    }

    setUploading(true)
    reset()

    const startedAt = performance.now()
    let uploadEndedAt = null
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/v1/project-models/upload', true)
    xhr.withCredentials = true
    xhr.responseType = 'text'
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name))
    xhr.setRequestHeader('X-File-Size', String(file.size))
    xhr.setRequestHeader('X-Content-Type', file.type || 'application/octet-stream')
    xhr.setRequestHeader('X-Project-Id', projectId.trim())
    if (fileMd5.trim()) {
      xhr.setRequestHeader('X-File-Md5', fileMd5.trim())
    }
    if (activeOrg.trim()) {
      xhr.setRequestHeader('X-Active-Org', activeOrg.trim())
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)))
      }
    }

    xhr.upload.onload = () => {
      // 浏览器把最后一个字节交给 TCP, 此时服务端通常还在做 COS/RDP 落盘
      uploadEndedAt = performance.now()
    }

    xhr.onload = () => {
      const finishedAt = performance.now()
      const totalMs = finishedAt - startedAt
      const uploadMs = uploadEndedAt ? uploadEndedAt - startedAt : totalMs
      const serverMs = uploadEndedAt ? finishedAt - uploadEndedAt : 0
      setPhaseTimings({ uploadMs, serverMs, totalMs })
      setUploading(false)

      let parsed
      try {
        parsed = JSON.parse(xhr.responseText)
      } catch {
        parsed = { raw: xhr.responseText }
      }
      setResult({ status: xhr.status, body: parsed })
      if (xhr.status < 200 || xhr.status >= 300) {
        setError(`HTTP ${xhr.status}`)
      }
    }

    xhr.onerror = () => {
      const finishedAt = performance.now()
      setPhaseTimings({ uploadMs: 0, serverMs: 0, totalMs: finishedAt - startedAt })
      setUploading(false)
      setError('网络错误 (CORS / 代理 / 服务端不可达)')
    }

    xhr.send(file)
  }

  return (
    <div className="tool upload-tool">
      <h2>项目模型流式上传</h2>
      <p className="hint">
        POST <code>/api/v1/project-models/upload</code> · Content-Type:{' '}
        <code>application/octet-stream</code>
        <br />
        Vite 把 <code>/api/*</code> 反代到 <code>VITE_PORTAL_TARGET</code>。
      </p>

      <div className="form">
        <label>
          <span>
            Cookie (从 portal DevTools 复制完整 cookie, 或单条 <code>_ut=xxx</code>)
          </span>
          <textarea
            rows={3}
            value={cookieRaw}
            placeholder="_ut=eyJhbGc...; foo=bar"
            onChange={(e) => setCookieRaw(e.target.value)}
            disabled={uploading}
          />
        </label>
        <button className="ghost" onClick={onApplyCookie} disabled={uploading}>
          应用 Cookie 到当前页面
        </button>
        {cookieMsg && <div className="cookie-msg">{cookieMsg}</div>}

        <hr className="sep" />

        <label>
          <span>X-Project-Id</span>
          <input
            type="text"
            value={projectId}
            placeholder="必填, 例如 7100000000000000001"
            onChange={(e) => setProjectId(e.target.value)}
            disabled={uploading}
          />
        </label>

        <label>
          <span>X-Active-Org (可选, 不填则用账号默认企业)</span>
          <input
            type="text"
            value={activeOrg}
            placeholder="可选"
            onChange={(e) => setActiveOrg(e.target.value)}
            disabled={uploading}
          />
        </label>

        <label>
          <span>选择文件</span>
          <input type="file" onChange={onPickFile} disabled={uploading} />
        </label>
        {file && (
          <div className="file-info">
            <strong>{file.name}</strong> · {formatBytes(file.size)}
            {file.type && <> · {file.type}</>}
          </div>
        )}

        <label>
          <span>X-File-Md5 (可选)</span>
          <input
            type="text"
            value={fileMd5}
            placeholder="可选; 若填了服务端会做 md5 校验"
            onChange={(e) => setFileMd5(e.target.value)}
            disabled={uploading}
          />
        </label>

        <button onClick={onUpload} disabled={uploading || !file}>
          {uploading ? '上传中…' : '开始上传'}
        </button>
      </div>

      {(uploading || progress > 0) && (
        <div className="progress">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
          <span className="progress-label">{progress}%</span>
        </div>
      )}

      {phaseTimings && (
        <div className="timings">
          <div>
            <span className="label">浏览器发送字节耗时</span>
            <span className="value">{formatDuration(phaseTimings.uploadMs)}</span>
          </div>
          <div>
            <span className="label">服务端处理 (转发 COS + RDP) 耗时</span>
            <span className="value">{formatDuration(phaseTimings.serverMs)}</span>
          </div>
          <div className="total">
            <span className="label">总耗时</span>
            <span className="value">{formatDuration(phaseTimings.totalMs)}</span>
          </div>
          {file && (
            <div className="muted">
              平均吞吐 ≈ {computeThroughput(file.size, phaseTimings.totalMs)}
            </div>
          )}
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="result">
          <h3>响应 (HTTP {result.status})</h3>
          <pre>{JSON.stringify(result.body, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
