
# GitHub 仓库代理下载器(支持私有)

这个 Cloudflare Worker 脚本作为 GitHub 仓库内容（包括单个文件和 ZIP 归档）的反向代理。它使用个人访问令牌 (PAT) 进行认证，同时通过独立的 Worker 认证令牌保护您的服务。由于worker路径默认是被墙的，建议在worker的设置界面添加自定义域名，然后访问自定义域名即可（自定义域名的添加可能要一点时间才会生效，请耐心等待，这期间可以先直接使用worker的域名）

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

| 变量名 | 描述 | 示例值 | 备注                                              |
| :--- | :--- | :--- |:------------------------------------------------|
| `TOKEN` | **Worker 服务认证密钥**。用户必须在查询参数中提供此值。 | `my-worker-secret-12345` | **必填**                                          |
| `GH_TOKEN` | **GitHub 个人访问令牌 (PAT)**。用于访问私有仓库。 | `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx` | **必填**，需要 `repo` 或 `contents:read` 权限。获取方法见下方【获取 GitHub 访问令牌 (Personal Access Token, PAT) 的步骤】 |
| `GH_NAME` | **默认用户名/组织名**。用于自动拼接相对路径。 | `assast` | **必填** (用于相对路径模式)                               |
| `ERROR` | (可选) 自定义错误提示信息。 | `Custom Error Message` |                                                 |
| `URL` / `URL302` | (可选) 首页重定向或代理地址。 | `https://example.com` |                                                 |

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


### 📝 获取 GitHub 访问令牌 (Personal Access Token, PAT) 的步骤

#### 步骤 1: 导航到设置

1.  登录您的 **GitHub 账号**。
2.  点击页面右上角的**用户头像**。
3.  在下拉菜单中，选择 **Settings**（设置）。

#### 步骤 2: 进入开发者设置

1.  在左侧导航栏的底部，找到并点击 **Developer settings**（开发者设置）。
2.  在左侧导航栏中，点击 **Personal access tokens**（个人访问令牌）。
3.  您会看到两个选项：**Tokens (classic)** 和 **Fine-grained tokens**。

#### 步骤 3: 选择令牌类型并生成

**推荐（更安全）：Fine-grained tokens (细粒度令牌)**

1.  点击 **Fine-grained tokens**。
2.  点击 **Generate new token**（生成新令牌）。
3.  **Token name**：为令牌起一个描述性的名字，例如 `Worker-PrivateRepo-Access`。
4.  **Expiration**：设置令牌的过期时间（为了安全，不建议选择 "No expiration"）。
5.  **Resource owner**：选择您自己的账号。
6.  **Repository access**：
    * 选择 **Only select repositories**（仅选择特定仓库）。
    * 在下方的列表中选择您的私有仓库。
7.  **Permissions**（权限）：
    * 找到 **Repository permissions**（仓库权限）。
    * 找到 **Contents**（内容），将权限设置为 **Read-only**（只读）。
8.  点击底部的 **Generate token**（生成令牌）。

**替代（经典，通常用于旧应用）：Tokens (classic)**

1.  点击 **Tokens (classic)**。
2.  点击 **Generate new token**（生成新令牌）。
3.  **Note**：为令牌起一个描述性的名字。
4.  **Expiration**：设置过期时间。
5.  **Select scopes**（选择范围）：
    * 要下载私有仓库的 ZIP 或 Raw 文件，您至少需要勾选 **`repo`** 权限（这会授予对所有私有仓库的访问权限）。

#### 步骤 4: 复制令牌

* **令牌生成后，GitHub 只会显示一次！**
* 请立即复制生成的字符串，并将其妥善保管（例如，用于配置您的 Worker 环境变量 `GH_TOKEN`）。

**重要提示：**

* **不要将您的 PAT 直接暴露给任何人，包括 Worker 脚本的使用者。**（您的 Worker 脚本已经将 PAT 存储在环境变量中，是安全的做法。）
* 始终为您需要的最小权限授予 PAT，并设置合理的过期时间。

改自https://github.com/cmliu/CF-Workers-Raw
在原版的基础上加了git 私仓的文件下载支持，例如`https://github.com/assast/git_and_row_worker/archive/refs/heads/main.zip`这种，也阉割了一些能力 保留了必要能力
