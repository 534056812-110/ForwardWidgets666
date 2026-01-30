WidgetMetadata = {
    id: "universal_m3u_player",
    title: "万能直播源播放器",
    author: "Makkapakka",
    description: "通用 M3U8/直播源播放工具。支持解析 tvg-logo、group-title，支持搜索过滤。",
    version: "1.0.0",
    requiredVersion: "0.0.1",
    site: "https://github.com/2kuai/ForwardWidgets", // 致敬原作者

    modules: [
        {
            title: "直播源列表",
            functionName: "loadM3uList",
            type: "list",
            cacheDuration: 3600, // 缓存1小时
            params: [
                {
                    name: "m3uUrl",
                    title: "直播源链接 (.m3u)",
                    type: "input",
                    description: "粘贴你的 M3U 订阅链接",
                    // 默认给一个测试源 (IPTV org public)
                    value: "https://iptv-org.github.io/iptv/countries/cn.m3u"
                },
                {
                    name: "keyword",
                    title: "搜索/过滤",
                    type: "input",
                    description: "输入频道名或分组名进行筛选 (可选)"
                },
                {
                    name: "page",
                    title: "页码",
                    type: "page"
                }
            ]
        }
    ]
};

// =========================================================================
// 1. 核心逻辑
// =========================================================================

async function loadM3uList(params = {}) {
    const { m3uUrl, keyword, page = 1 } = params;

    if (!m3uUrl) {
        return [{ id: "tip", type: "text", title: "请先填写直播源链接" }];
    }

    try {
        // 1. 获取 M3U 内容
        // 增加 User-Agent 防止部分源拒绝访问
        const res = await Widget.http.get(m3uUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" }
        });

        const content = res.data || res || "";
        if (!content || typeof content !== "string") {
            return [{ id: "err", type: "text", title: "获取失败", subTitle: "返回数据为空或格式错误" }];
        }

        // 2. 解析 M3U
        let channels = parseM3uPlus(content);

        if (channels.length === 0) {
            return [{ id: "empty", type: "text", title: "未解析到频道", subTitle: "请检查链接内容格式" }];
        }

        // 3. 过滤 (搜索频道名 或 分组名)
        if (keyword) {
            const lowerKw = keyword.toLowerCase();
            channels = channels.filter(ch => 
                (ch.name && ch.name.toLowerCase().includes(lowerKw)) || 
                (ch.group && ch.group.toLowerCase().includes(lowerKw))
            );
        }

        // 4. 分页处理 (本地分页)
        const pageSize = 20;
        const total = channels.length;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        
        // 如果分页越界
        if (start >= total) return [];

        const pageItems = channels.slice(start, end);

        // 5. 构建 Forward Item
        return pageItems.map(ch => {
            // 构造副标题：显示分组信息
            let sub = "";
            if (ch.group) sub += `📂 ${ch.group}`;
            
            return {
                id: ch.url, //以此 URL 为唯一 ID
                
                // === 关键点：调用原生播放器 ===
                type: "url", 
                videoUrl: ch.url, 
                
                title: ch.name || "未知频道",
                subTitle: sub,
                posterPath: ch.logo || "", // 显示台标
                description: `分组: ${ch.group || "默认"}\n地址: ${ch.url}`,
                
                // 模拟 headers，有些源需要 Referer
                customHeaders: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Referer": m3uUrl
                }
            };
        });

    } catch (e) {
        return [{ id: "err", type: "text", title: "加载出错", subTitle: e.message }];
    }
}

// =========================================================================
// 2. M3U 解析器 (增强版)
// =========================================================================

function parseM3uPlus(content) {
    const lines = content.split('\n');
    const channels = [];
    let currentChannel = null;

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // 处理 #EXTINF 行
        if (line.startsWith('#EXTINF:')) {
            currentChannel = {};
            
            // 1. 提取 logo (tvg-logo="...")
            const logoMatch = line.match(/tvg-logo="([^"]*)"/);
            if (logoMatch) currentChannel.logo = logoMatch[1];

            // 2. 提取分组 (group-title="...")
            const groupMatch = line.match(/group-title="([^"]*)"/);
            if (groupMatch) currentChannel.group = groupMatch[1];

            // 3. 提取频道名称 (逗号后面的部分)
            const nameMatch = line.match(/,([^,]*)$/);
            if (nameMatch) {
                currentChannel.name = nameMatch[1].trim();
            } else {
                // 某些格式可能是 #EXTINF:-1 频道名
                // 简单处理：去掉所有属性，取最后
                // 这里做一个简单的 fallback
                const parts = line.split(',');
                if (parts.length > 1) currentChannel.name = parts[parts.length - 1].trim();
            }
        } 
        // 处理 URL 行 (非 # 开头)
        else if (!line.startsWith('#')) {
            if (currentChannel) {
                currentChannel.url = line;
                channels.push(currentChannel);
                currentChannel = null; // 重置，准备读取下一个
            } else {
                // 如果没有 EXTINF 信息，直接把 URL 当作一个频道
                // 这种情况比较少见，或者是 m3u 的第一行
                if (line.startsWith('http') || line.startsWith('rtmp') || line.startsWith('rtsp')) {
                     channels.push({
                         name: "未知频道",
                         url: line,
                         group: "未分类"
                     });
                }
            }
        }
    }
    return channels;
}
