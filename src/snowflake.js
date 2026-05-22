// JS 复刻 code.intern.yuansuan.cn/igo/xboot/snowflake 的 ID.String() 与 MustParse(s).
//
// 注意: snowflake.ID 是 int64, 超过 JS Number 安全精度 (2^53-1), 所以这里用 BigInt.
//       两个函数都接受/产出 BigInt, 错误时直接 throw, 由调用方 try/catch 拿到 e.message.

const BASE58_ALPHABET =
  '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'

const BASE58_DECODE = (() => {
  const m = new Int16Array(256).fill(-1)
  for (let i = 0; i < BASE58_ALPHABET.length; i++) {
    m[BASE58_ALPHABET.charCodeAt(i)] = i
  }
  return m
})()

/**
 * 等价于 Go 的 `snowflake.ID.String()`。
 * @param {bigint|number|string} id  BigInt / Number / 数字字面量字符串
 * @returns {string} Base58 编码; id === 0 返回 ""
 * @throws {Error} 输入无法解析为 BigInt 或为负数
 */
export function snowflakeIdToString(id) {
  const n = typeof id === 'bigint' ? id : BigInt(id)
  if (n === 0n) return ''
  if (n < 0n) throw new Error('snowflake id must be non-negative')
  if (n < 58n) return BASE58_ALPHABET[Number(n)]

  const chars = []
  let v = n
  while (v >= 58n) {
    chars.push(BASE58_ALPHABET[Number(v % 58n)])
    v /= 58n
  }
  chars.push(BASE58_ALPHABET[Number(v)])
  return chars.reverse().join('')
}

/**
 * 等价于 Go 的 `snowflake.MustParse(s)`。
 * @param {string|null|undefined} s Base58 字符串
 * @returns {bigint} 解析后的 ID; "" 或 nullish 返回 0n
 * @throws {Error} 字符不在 Base58 字母表中
 */
export function parseSnowflakeId(s) {
  if (s == null || s === '') return 0n
  let id = 0n
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i)
    const v = code < 256 ? BASE58_DECODE[code] : -1
    if (v < 0) {
      throw new Error(`invalid base58 char at index ${i}: '${s[i]}'`)
    }
    id = id * 58n + BigInt(v)
  }
  return id
}
