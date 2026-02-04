WidgetMetadata = {
    id: "vod_agg_dynamic",
    title: "VOD 聚合 (GitHub源)",
    author: "𝙈𝙖𝙠𝙠𝙖𝙋𝙖𝙠𝙠𝙖",
    description: "自动读取远程 tv.json 配置，并发搜索全网资源。",
    version: "1.0.0",
    requiredVersion: "0.0.2",
    
    globalParams: [
        { 
            name: "configUrl", 
            title: "配置链接 (JSON)", 
            type: "input", 
            value: "https://raw.githubusercontent.com/MakkaPakka518/ForwardWidgets/refs/heads/main/tv.json" 
        },
        {
            name: "maxConcurrency",
            title: "最大并发数",
            type: "enumeration",
            value: "10",
            enumOptions: [
                { title: "保守 (5个)", value: "5" },
                { title: "标准 (10个)", value: "10" },
                { title: "暴力 (20个)", value: "20" }
            ]
        }
    ],

    modules: [
        {
            id: "search",
            title: "聚合搜索",
            type: "vod", // 指定为 VOD 类型
            functionName: "searchVod",
            params: [
                { name: "wd", title: "关键词", type: "input" },
                { name: "page", title: "页码", type: "page" }
            ]
        },
        {
            id: "detail",
            title: "获取详情",
            type: "vod",
            functionName: "getVodDetail",
            params: []
        }
    ]
};

// ==========================================
// 1. 配置加载与缓存
// ==========================================
const CACHE_KEY_SITES = "vod_sites_cache";

async function getSites(configUrl) {
    // 尝试读取缓存
    let cached = await Widget.storage.get(CACHE_KEY_SITES);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            // 简单判断缓存是否过期 (例如 1 小时) - 这里简化为每次重启脚本或手动清理时更新
            // 如果你想每次都强制刷新，可以注释掉缓存逻辑
            if (parsed && Array.isArray(parsed) && parsed.length > 0) {
                // 后台静默更新一下，下次生效
                updateSitesInBackground(configUrl);
                return parsed;
            }
        } catch (e) {}
    }
    return await updateSitesInBackground(configUrl);
}

async function updateSitesInBackground(url) {
    try {
        const res = await Widget.http.get(url);
        let data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
        
        // 适配 TVBox 格式 (通常在 sites 或 lives 字段，或者根数组)
        let sites = [];
        if (Array.isArray(data)) {
            sites = data;
        } else if (data.sites && Array.isArray(data.sites)) {
            sites = data.sites;
        }

        // 过滤出有效的 CMS 接口 (通常 type: 0 或 1)
        // 假设 structure: { "key": "...", "name": "...", "api": "..." }
        const validSites = sites.filter(s => s.api && s.api.startsWith("http"));
        
        if (validSites.length > 0) {
            await Widget.storage.set(CACHE_KEY_SITES, JSON.stringify(validSites));
        }
        return validSites;
    } catch (e) {
        return [];
    }
}

// ==========================================
// 2. 核心搜索逻辑
// ==========================================

async function searchVod(params) {
    const { wd, page, configUrl, maxConcurrency } = params;
    if (!wd) return [];

    const sites = await getSites(configUrl);
    if (!sites || sites.length === 0) {
        return [{ vod_id: "err", vod_name: "加载源失败，请检查网络或链接", vod_remarks: "Error" }];
    }

    // 限制并发，避免瞬间请求过多导致卡顿
    const limit = parseInt(maxConcurrency) || 10;
    // 选取前 N 个源进行搜索 (或者你可以改为全部搜索，但速度会慢)
    // 这里为了演示聚合效果，我们分批处理
    
    let allResults = [];
    
    // 分批执行器
    for (let i = 0; i < sites.length; i += limit) {
        const chunk = sites.slice(i, i + limit);
        const tasks = chunk.map(site => fetchSingleSite(site, wd, page));
        const results = await Promise.all(tasks);
        
        // 合并结果
        results.forEach(res => {
            if (res && res.length > 0) {
                allResults = allResults.concat(res);
            }
        });

        // 如果已经搜到足够多的结果 (比如超过 20 条)，可以提前停止，提升体验
        // if (allResults.length > 20) break; 
    }

    return allResults;
}

// 搜索单个站点
async function fetchSingleSite(site, wd, page) {
    try {
        const api = site.api;
        // 构造 CMS 标准请求: ?ac=detail&wd=xxx (用 detail 模式通常能直接拿播放列表，虽然数据量大一点)
        // 加上 &at=json 强制要求返回 JSON，避免处理 XML
        const url = `${api}?ac=detail&wd=${encodeURIComponent(wd)}&pg=${page}&at=json`;
        
        const res = await Widget.http.get(url, { timeout: 3000 }); // 设置短超时，跳过慢源
        const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;

        if (data && data.list && Array.isArray(data.list)) {
            return data.list.map(item => ({
                vod_id: item.vod_id.toString(),
                vod_name: item.vod_name,
                vod_pic: item.vod_pic,
                vod_remarks: `[${site.name}] ${item.vod_remarks || item.vod_time || ""}`,
                // 我们把 API 地址埋在 extra 字段里，方便详情页直接用，不用再匹配 source
                extra: { 
                    apiUrl: api,
                    sourceName: site.name
                }
            }));
        }
    } catch (e) {
        // 忽略错误，聚合搜索容忍部分源挂掉
    }
    return [];
}

// ==========================================
// 3. 详情与播放解析
// ==========================================

async function getVodDetail(params) {
    const { vod_id, extra } = params;
    
    // 如果搜索列表里带了 extra 信息（这是最高效的）
    let apiUrl = extra?.apiUrl;
    
    if (!apiUrl) {
        // 如果没有 extra，说明是收藏列表进来的，或者 params 丢失
        // 这里需要一种机制找回源，为了简化，我们提示用户重新搜索
        // 或者你可以遍历所有源去 getDetail (不推荐)
        return { vod_play_from: "Error", vod_play_url: "源信息丢失，请重新搜索" };
    }

    try {
        // 直接请求详情
        const url = `${apiUrl}?ac=detail&ids=${vod_id}&at=json`;
        const res = await Widget.http.get(url);
        const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;

        if (data && data.list && data.list.length > 0) {
            const info = data.list[0];
            return {
                vod_id: info.vod_id,
                vod_name: info.vod_name,
                vod_pic: info.vod_pic,
                type_name: info.type_name,
                vod_year: info.vod_year,
                vod_area: info.vod_area,
                vod_remarks: info.vod_remarks,
                vod_actor: info.vod_actor,
                vod_content: info.vod_content,
                vod_play_from: info.vod_play_from, // 播放源列表 (如: qiyi$$$qq)
                vod_play_url: info.vod_play_url    // 播放地址列表
            };
        }
    } catch (e) {
        return null;
    }
    return null;
}
