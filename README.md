
# GitHub 仓库代理下载器(支持私有)

这个 Cloudflare Worker 脚本作为 GitHub 仓库内容（包括单个文件和 ZIP 归档）的反向代理。它使用个人访问令牌 (PAT) 进行认证，同时通过独立的 Worker 认证令牌保护您的服务。

## ✨ 特性

  * **安全认证：** 将用户的服务访问令牌 (`env.TOKEN`) 与内部的 GitHub 访问令牌 (`env.GH_TOKEN`) 彻底分离。
  * **灵活的 URL 模式：**
      * **完整 URL 模式：** 支持直接在路径中传入完整的 GitHub Raw 或 Git 归档 URL。
      * **相对路径模式：** 自动使用环境变量 (`env.GH_NAME`) 拼接 URL，方便访问同一用户下的多个仓库。
  * **多类型支持：** 支持 `type=raw` (单个文件) 和 `type=git` (仓库 ZIP 归档)。
  * **操作控制：** 使用 `action=display` (显示/自适应下载) 或 `action=download` (强制下载) 控制浏览器行为。
  * **自适应：** 访问 Raw 文件时，非文本文件（如图片、视频）将自动切换为下载模式。

## ⚙️ 配置 (环境变量)

在您的 Cloudflare Worker 设置中，必须配置以下环境变量：

| 变量名 | 描述 | 示例值 | 备注 |
| :--- | :--- | :--- | :--- |
| `TOKEN` | **Worker 服务认证密钥**。用户必须在查询参数中提供此值。 | `my-worker-secret-12345` | **必填** |
| `GH_TOKEN` | **GitHub 个人访问令牌 (PAT)**。用于访问私有仓库。 | `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx` | **必填**，需要 `repo` 或 `contents:read` 权限。 |
| `GH_NAME` | **默认用户名/组织名**。用于自动拼接相对路径。 | `assast` | **必填** (用于相对路径模式) |
| `ERROR` | (可选) 自定义错误提示信息。 | `Custom Error Message` | |
| `URL` / `URL302` | (可选) 首页重定向或代理地址。 | `https://example.com` | |

## 💡 使用方法

假设您的 Worker 域名是 `https://your.worker.dev`，且 `TOKEN` 为 `12345`，`GH_NAME` 为 `assast`。

### 模式 1: 相对路径 (自动拼接 GH\_NAME)

用于访问 `https://github.com/assast/...` 下的资源。

| 目标 | `type` | 路径示例 | 完整请求 URL |
| :--- | :--- | :--- | :--- |
| **Raw 文件** (显示) | `raw` | `/REPO/BRANCH/file.txt` | `https://your.worker.dev/scripts-shell/main/README.md?token=12345&type=raw` |
| **Raw 文件** (下载) | `raw` | `/REPO/BRANCH/file.zip` | `https://your.worker.dev/scripts-shell/main/data.json?token=12345&type=raw&action=download` |
| **Git ZIP 归档** (下载) | `git` | `/REPO/archive/refs/heads/main.zip` | `https://your.worker.dev/scripts-shell/archive/refs/heads/main.zip?token=12345&type=git` |

### 模式 2: 完整 URL 模式 (将目标 URL 放在 Path 中)

用于访问任意 GitHub 用户或组织的私有仓库。

| 目标 | `type` | 完整目标 URL | 完整请求 URL (示例) |
| :--- | :--- | :--- | :--- |
| **Raw 文件** (自适应) | `raw` | `https://raw.githubusercontent.com/ORG/REPO/main/img.png` | `https://your.worker.dev/https://raw.githubusercontent.com/ORG/REPO/main/img.png?token=12345&type=raw` |
| **Git ZIP 归档** (下载) | `git` | `https://github.com/ORG/REPO/archive/refs/heads/v1.0.0.zip` | `https://your.worker.dev/https://github.com/ORG/REPO/archive/refs/heads/v1.0.0.zip?token=12345&type=git` |

### 查询参数说明

| 参数 | 必填 | 作用 | 可选值 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `token` | 是 | 您的 Worker 服务认证密钥 (`env.TOKEN` 的值)。 | N/A | N/A |
| `type` | 否 | 指定请求的目标类型。 | `raw` (单个文件), **`git`** (ZIP 归档) | `raw` |
| `action` | 否 | 仅在 `type=raw` 时有效，控制浏览器操作。 | `display` (显示/自适应), `download` (强制下载) | `display` |

### 添加自定义域名
由于worker路径默认是被墙的，建议在worker的设置界面添加自定义域名，然后访问自定义域名即可（自定义域名的添加可能要一点时间才会生效，请耐心等待，这期间可以先直接使用worker的域名）