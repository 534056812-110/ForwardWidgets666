var WidgetMetadata = {
    id: "missav_merged_final",
    title: "MissAV (官方逻辑合并版)",
    description: "保留官方核心解析逻辑，仅合并菜单结构。",
    author: "Butterfly & Merged",
    site: "https://for-ward.vercel.app",
    version: "3.0.0",
    requiredVersion: "0.0.2",
    detailCacheDuration: 300,
    modules: [
        {
            title: "搜索影片",
            description: "搜索 MissAV 影片内容",
            requiresWebView: false,
            functionName: "searchVideos",
            cacheDuration: 1800,
            params: [
                {
                    name: "keyword",
                    title: "搜索关键词",
                    type: "input",
                    description: "输入番号或女优名",
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        // --- 合并后的热门榜单 ---
        {
            title: "热门榜单",
            description: "浏览各类热门排行",
            requiresWebView: false,
            functionName: "loadPage",
            cacheDuration: 1800,
            params: [
                {
                    name: "url",
                    title: "榜单类型",
                    type: "enumeration",
                    value: "https://missav.com/cn/weekly-hot",
                    enumOptions: [
                        { title: "今日热门", value: "https://missav.com/cn/today-hot" },
                        { title: "本周热门", value: "https://missav.com/cn/weekly-hot" },
                        { title: "本月热门", value: "https://missav.com/cn/monthly-hot" },
                        { title: "最新上市", value: "https://missav.com/cn/new" },
                        { title: "最近发布", value: "https://missav.com/cn/release" }
                    ]
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        // --- 合并后的分类精选 ---
        {
            title: "分类精选",
            description: "按类型筛选影片",
            requiresWebView: false,
            functionName: "loadPage",
            cacheDuration: 1800,
            params: [
                {
                    name: "url",
                    title: "分类选择",
                    type: "enumeration",
                    value: "https://missav.com/cn/chinese-subtitle",
                    enumOptions: [
                        { title: "中文字幕", value: "https://missav.com/cn/chinese-subtitle" },
                        { title: "无码流出", value: "https://missav.com/cn/uncensored-leak" },
                        { title: "FC2系列", value: "https://missav.com/cn/fc2" },
                        { title: "VR虚拟现实", value: "https://missav.com/cn/vr" },
                        { title: "个人拍摄 (Siro)", value: "https://missav.com/cn/siro" },
                        { title: "人妻", value: "https://missav.com/cn/genres/married-woman" },
                        { title: "制服", value: "https://missav.com/cn/genres/uniform" },
                        { title: "巨乳", value: "https://missav.com/cn/genres/big-tits" },
                        { title: "中出", value: "https://missav.com/cn/genres/creampie" },
                        { title: "颜射", value: "https://missav.com/cn/genres/facial" }
                    ]
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        }
    ]
};

// =============================================================
// 以下逻辑严格照搬自 MissAV.js (Butterfly版)
// 不做任何正则修改，使用原版的 Cheerio 解析
// =============================================================

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15"
};

function extractVideoId(url) {
    if (!url) return null;
    return url.split('/').pop().split('?')[0];
}

async function parseHtml(html) {
    const $ = Widget.html.load(html);
    const items = $('.group'); // 使用原版的 class 选择器
    const results = [];
    
    items.each((index, element) => {
        const item = $(element);
        const linkAnchor = item.find('a');
        const link = linkAnchor.attr('href');
        
        if (link) {
            // 严格照搬原版封面拼接逻辑
            const videoId = extractVideoId(link);
            const img = item.find('img');
            const title = img.attr('alt') || linkAnchor.text().trim();
            
            // 原版使用的 fourhoi 源拼接
            const cover = `https://fourhoi.com/${videoId}/cover-t.jpg`;
            
            // 时长提取
            const duration = item.find('.absolute.bottom-1.right-1').text().trim();

            results.push({
                id: link,
                type: "movie",
                title: title,
                link: link,
                posterPath: cover,    // 兼容
                backdropPath: cover,  // 兼容
                releaseDate: duration,
                playerType: "system"
            });
        }
    });
    
    return results;
}

async function searchVideos(params) {
    const keyword = params.keyword;
    const page = params.page || 1;
    
    // 原版搜索逻辑
    const url = `https://missav.com/cn/search/${encodeURIComponent(keyword)}?page=${page}`;
    
    const response = await Widget.http.get(url, { headers: HEADERS });
    return parseHtml(response.data);
}

// 这是一个通用的加载函数，用于处理“热门榜单”和“分类精选”的下拉菜单
async function loadPage(params) {
    // 获取下拉菜单选中的 URL
    let url = params.url || "https://missav.com/cn/weekly-hot";
    const page = params.page || 1;
    
    // 拼接页码 (原版逻辑)
    if (url.includes('?')) {
        url = `${url}&page=${page}`;
    } else {
        url = `${url}?page=${page}`;
    }
    
    const response = await Widget.http.get(url, { headers: HEADERS });
    return parseHtml(response.data);
}

async function loadDetail(link) {
    try {
        const response = await Widget.http.get(link, { headers: HEADERS });
        const html = response.data;
        const videoId = extractVideoId(link);
        const videoCode = videoId.toUpperCase().replace('-CHINESE-SUBTITLE', '').replace('-UNCENSORED-LEAK', '');
        
        let videoUrl = "";
        
        // 严格照搬原版的 UUID 提取逻辑
        const uuidMatches = html.match(/uuid: "(.*?)"/);
        if (uuidMatches && uuidMatches.length > 1) {
            // 原版逻辑：拼接 playlist
            videoUrl = `https://surrit.com/${uuidMatches[1]}/playlist.m3u8`;
        } else {
            // 原版备用逻辑
            const matches = html.match(/tm_source_id: "(.*?)"/);
            if (matches && matches.length > 1) {
                videoUrl = `https://surrit.com/${matches[1]}/playlist.m3u8`;
            }
        }
        
        // 如果实在没找到，尝试原版的盲猜逻辑
        if (!videoUrl) {
            // 这里保留原版可能的兜底，或者直接返回空让前端处理
        }

        return {
            id: link,
            type: "detail",
            videoUrl: videoUrl || link, // 保持原版回退逻辑
            title: videoCode,
            description: `番号: ${videoCode}`,
            posterPath: "",
            backdropPath: `https://fourhoi.com/${videoId}/cover-t.jpg`,
            mediaType: "movie",
            playerType: "system",
            link: link,
            customHeaders: videoUrl ? {
                "Referer": link,
                "User-Agent": HEADERS["User-Agent"]
            } : undefined
        };
        
    } catch (error) {
        // 原版错误处理
        const videoId = extractVideoId(link);
        return {
            id: link,
            type: "detail",
            videoUrl: link,
            title: "解析错误",
            description: "Error",
            backdropPath: `https://fourhoi.com/${videoId}/cover-t.jpg`,
            childItems: []
        };
    }
}
