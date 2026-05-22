import { useState } from 'react'

import { parseSnowflakeId, snowflakeIdToString } from '../snowflake.js'

// 输入按 \n 拆行, 对每行调一次 lineConverter; 失败行用 ❌ message 占位, 空行保持空行。
const convertEachLine = (input, lineConverter) =>
  input
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return ''
      try {
        return lineConverter(trimmed)
      } catch (e) {
        return `❌ ${e.message}`
      }
    })
    .join('\n')

export default function SnowflakeTool() {
  const [base58, setBase58] = useState('')
  const [numeric, setNumeric] = useState('')

  // 用户在 Base58 一侧输入 -> 解出 BigInt 写到数值一侧
  const onBase58Change = (val) => {
    setBase58(val)
    setNumeric(convertEachLine(val, (s) => parseSnowflakeId(s).toString()))
  }

  // 用户在数值一侧输入 -> 编码成 Base58 写到字符串一侧
  const onNumericChange = (val) => {
    setNumeric(val)
    setBase58(convertEachLine(val, (s) => snowflakeIdToString(BigInt(s))))
  }

  return (
    <div className="tool snowflake-tool">
      <h2>Snowflake ID 互转</h2>
      <p className="hint">
        粘贴 <strong>Base58 字符串</strong>或 <strong>Int64 数值</strong>, 一行一个;
        另一侧自动转换。算法对齐{' '}
        <code>code.intern.yuansuan.cn/igo/xboot/snowflake</code> 的{' '}
        <code>ID.String()</code> 与 <code>MustParse(s)</code>。
        <br />
        空行 → 空行; 非法字符 → 该行显示 <code>❌</code> 错误信息。
      </p>

      <div className="snowflake-cols">
        <label>
          <span>Base58 字符串 (一行一个)</span>
          <textarea
            value={base58}
            onChange={(e) => onBase58Change(e.target.value)}
            placeholder={'5LWtKrZH3KA\nnpL6MjP8Qfc'}
            rows={16}
            spellCheck={false}
            wrap="off"
          />
        </label>

        <label>
          <span>Int64 数值 (一行一个)</span>
          <textarea
            value={numeric}
            onChange={(e) => onNumericChange(e.target.value)}
            placeholder={'2057010488143044608\n9223372036854775807'}
            rows={16}
            spellCheck={false}
            wrap="off"
          />
        </label>
      </div>
    </div>
  )
}
