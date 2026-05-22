# Project Model Stream Upload Demo

最小 React 单页 demo, 用来测 portal 新增的
`POST /api/v1/project-models/upload` 流式上传接口
(同步分发到腾讯 COS 与 RDP, 不分片, 不落临时文件)。

## 功能

- 选择本地文件 (`<input type="file">`)
- 填入 `X-Project-Id`, 可选 `X-File-Md5`
- 点击上传后:
  - `XMLHttpRequest` 直接把 `File` 作为 `application/octet-stream` body 发出
  - `xhr.upload.onprogress` 渲染进度条
  - `performance.now()` 分别记录: 浏览器把字节发完的耗时 / 服务端处理 (COS + RDP) 的耗时 / 总耗时
  - 拿到响应后把完整 JSON 渲染到页面 (包括 `geometry_id`、`vault_path`、`content_sha256`、`file_size`、`file_name`)
  - 失败时把 HTTP 状态码和 body 一并展示

## 运行

需要 Node 18+。

```bash
cd demo-react
npm install

# 指向 portal 后端地址 (Vite 会把 /api 反代过去), 默认 http://localhost:8080
# Windows PowerShell:  $env:VITE_PORTAL_TARGET = "http://localhost:8080"; npm run dev
# bash/zsh:            VITE_PORTAL_TARGET=http://localhost:8080 npm run dev
npm run dev
```

浏览器打开 http://localhost:5173

## 登录态怎么办

Portal 接口要求登录 session。Vite 配置里写了
`cookieDomainRewrite: 'localhost'`, 所以只要你通过 dev server (5173)
访问 portal 的登录页/接口完成登录, 后续上传请求就会自动带上同源 cookie。

最简单的姿势: 把 portal 前端原本能登录的页面也通过 5173 这个 dev server
打开 (例如另一个标签页访问 `http://localhost:5173/login`), 让登录响应的
Set-Cookie 落到 `localhost:5173` 这个 origin。

如果 portal 后端和前端是独立部署、不能通过 5173 完成登录, 把后端登录返回的
cookie 在浏览器 DevTools → Application → Cookies 里手动复制到 `localhost`
也行 (仅本地开发图省事)。

## 接口字段

详见仓库根目录 `portal/api/v1/platform/project_model/project_model.proto`
中的 `UploadProjectModel` rpc, 以及生成的
`portal/api/v1/platform/project_model/project_model.swagger.json`。

### 请求

| 项 | 值 |
|---|---|
| Method | POST |
| URL | `/api/v1/project-models/upload` |
| Content-Type | `application/octet-stream` |
| Body | 原始文件二进制 |

Header:

| Header | 必填 | 说明 |
|---|---|---|
| `X-File-Name`    | 是 | URL-encoded 文件名 |
| `X-File-Size`    | 是 | 字节数 (int64 字符串) |
| `X-Project-Id`   | 是 | 项目 ID, 必须属于当前活跃组织 |
| `X-Content-Type` | 否 | MIME, 缺省服务端按扩展名推断 |
| `X-File-Md5`     | 否 | hex; 若填则服务端流式校验 |

### 响应 200

```json
{
  "geometry_id":    "rdp-geom-...",
  "vault_path":     "https://....cos.../...",
  "content_sha256": "<64 hex>",
  "file_size":      1048576,
  "file_name":      "test.step"
}
```

拿到后前端紧接着调 `POST /api/v1/project-models` (CreateProjectModel),
把 `vault_path`、`geometry_id`、`content_sha256` 直接塞进去即可,
服务端会按 sha256 去重。
