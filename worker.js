// 全局变量 'workerAuthToken' 用于 Worker 自身认证的临时变量 (仅在需要时使用)
let workerAuthToken = "";

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const searchParams = url.searchParams;
        const path = url.pathname;

        // --- 1. 首页和辅助函数逻辑 ---
        if (path === '/') {
            const envKey = env.URL302 ? 'URL302' : (env.URL ? 'URL' : null);
            if (envKey) {
                const URLs = await ADD(env[envKey]);
                const URL = URLs[Math.floor(Math.random() * URLs.length)];
                return envKey === 'URL302' ? Response.redirect(URL, 302) : fetch(new Request(URL, request));
            }
            return new Response(await nginx(), {
                headers: { 'Content-Type': 'text/html; charset=UTF-8' },
            });
        }

        // --- 2. Worker 自身认证逻辑 (使用 env.TOKEN) ---
        const userProvidedToken = searchParams.get('token');
        if (!env.TOKEN) {
            return new Response('Worker配置错误：请设置 env.TOKEN 用于服务认证。', { status: 500 });
        }
        if (!userProvidedToken || userProvidedToken !== env.TOKEN) {
            return new Response('Worker认证失败：请提供正确的查询参数 "token"。', { status: 401 });
        }

        // --- 3. 获取 GitHub Token (只从 env.GH_TOKEN 获取) ---
        const githubToken = env.GH_TOKEN;
        if (!githubToken || githubToken === '') {
            return new Response('GitHub配置错误：请设置 env.GH_TOKEN 用于访问私有仓库。', { status: 500 });
        }

        // 构建认证请求头
        const headers = new Headers();
        headers.append('Authorization', `token ${githubToken}`);

        // --- 4. 核心：提取/拼接目标 URL ---

        const pathAfterWorkerDomain = path.substring(1); // 移除开头的 '/'
        let targetUrlString = '';
        let requestType = searchParams.get('type') || 'raw';
        const actionType = searchParams.get('action') || 'display';

        const protocolRegex = /https?:\/\//i;
        const protocolIndex = pathAfterWorkerDomain.search(protocolRegex);

        if (protocolIndex !== -1) {
            // 情况 A：路径中包含完整的 http:// 或 https:// 链接
            targetUrlString = pathAfterWorkerDomain.substring(protocolIndex);

        } else {
            // 情况 B：路径中只包含相对路径 (需要拼接)

            if (!env.GH_NAME) {
                 return new Response('缺少环境变量：请设置 GH_NAME 用于自动拼接。', { status: 400 });
            }

            if (requestType === 'git') { // <-- 已修改为 git
                // Git Archive URL 拼接：使用 github.com
                // 格式: https://github.com/GH_NAME/PATH (PATH 应包含 REPO/archive/refs/...)
                targetUrlString = `https://github.com/${env.GH_NAME}${path}`;

            } else {
                // Raw URL 拼接：使用 raw.githubusercontent.com
                // 格式: https://raw.githubusercontent.com/GH_NAME/PATH (PATH 应包含 REPO/BRANCH/FILE)
                targetUrlString = `https://raw.githubusercontent.com/${env.GH_NAME}${path}`;
            }
        }

        // URL 解析
        let targetUrl;
        try {
            targetUrl = new URL(targetUrlString);
        } catch (e) {
            return new Response(`目标 URL 格式不正确: ${targetUrlString}`, { status: 400 });
        }

        // 安全检查：限制目标域名
        const allowedDomains = ['raw.githubusercontent.com', 'github.com'];
        if (!allowedDomains.includes(targetUrl.hostname)) {
            return new Response('目标 URL 域名不合法，只允许指向 raw.githubusercontent.com 或 github.com。', { status: 403 });
        }

        // --- 5. 行为调整和文件名提取 ---
        let finalAction = actionType;
        let filename;

        if (targetUrl.hostname === 'github.com' || requestType === 'git') { // <-- 已修改为 git
            // 如果目标是 github.com (通常是 git archive)
            finalAction = 'download';
            requestType = 'git';

            // 尝试从路径中提取文件名（例如 main.zip）
            const parts = targetUrl.pathname.split('/');
            filename = parts[parts.length - 1] || 'archive.zip';
        } else {
            // 如果目标是 raw.githubusercontent.com
            requestType = 'raw';
            filename = targetUrl.pathname.split('/').pop() || 'download';
        }

        // --- 6. 发起请求并返回响应 ---
        try {
            const response = await fetch(targetUrl.toString(), {
                headers: headers,
                redirect: 'follow'
            });

            if (response.ok) {
                const responseHeaders = new Headers(response.headers);

                if (finalAction === 'download') {
                    // 强制下载
                    responseHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);

                    if (requestType === 'git' && !responseHeaders.has('Content-Type')) { // <-- 已修改为 git
                        responseHeaders.set('Content-Type', 'application/zip');
                    }
                    if (!responseHeaders.has('Content-Type')) {
                         responseHeaders.set('Content-Type', 'application/octet-stream');
                    }

                    return new Response(response.body, { status: 200, headers: responseHeaders });

                } else {
                    // 直接展示 (raw/action=display) - 包含自适应逻辑

                    const contentType = response.headers.get('Content-Type');
                    if (contentType && !contentType.includes('text/') && !contentType.includes('json')) {
                        // 非文本文件（自适应切换为下载）
                        responseHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);
                        return new Response(response.body, { status: 200, headers: responseHeaders });
                    }

                    // 文本文件直接返回内容
                    return new Response(await response.text(), {
                        status: 200,
                        headers: {
                            'Content-Type': response.headers.get('Content-Type') || 'text/plain; charset=UTF-8',
                        },
                    });
                }
            } else {
                const errorText = env.ERROR || `无法获取文件/归档。目标URL: ${targetUrlString} 状态码: ${response.status}`;
                return new Response(errorText, { status: response.status });
            }

        } catch (e) {
            return new Response(`网络请求失败: ${e.message}`, { status: 500 });
        }
    }
};

// --- 辅助函数 (保持不变) ---
async function nginx() {
    const text = `
    <!DOCTYPE html>
    <html>
    <head>
    <title>Welcome to nginx!</title>
    <style>
        body {
            width: 35em;
            margin: 0 auto;
            font-family: Tahoma, Verdana, Arial, sans-serif;
        }
    </style>
    </head>
    <body>
    <h1>Welcome to nginx!</h1>
    <p>If you see this page, the nginx web server is successfully installed and
    working. Further configuration is required.</p>

    <p>For online documentation and support please refer to
    <a href="http://nginx.org/">nginx.org</a>.<br/>
    Commercial support is available at
    <a href="http://nginx.com/">nginx.com</a>.</p>

    <p><em>Thank you for using nginx.</em></p>
    </body>
    </html>
    `
    return text ;
}

async function ADD(envadd) {
    var addtext = envadd.replace(/[ |"'\r\n]+/g, ',').replace(/,+/g, ',');
    if (addtext.charAt(0) === ',') addtext = addtext.slice(1);
    if (addtext.charAt(addtext.length - 1) === ',') addtext = addtext.slice(0, addtext.length - 1);
    const add = addtext.split(',');
    return add ;
}