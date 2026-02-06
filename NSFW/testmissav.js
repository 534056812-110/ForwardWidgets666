var WidgetMetadata = {
    id: "missav_stable_clone",
    title: "MissAV (稳定版)",
    description: "基于官方可用模块逻辑移植，修复列表和播放。",
    author: "MissAV_Fix",
    site: "https://missav.com",
    version: "7.0.0",
    requiredVersion: "0.0.2",
    detailCacheDuration: 0,
    modules: [
        {
            title: "搜索影片",
            description: "搜索番号或关键词",
            requiresWebView: false,
            functionName: "searchVideos",
            cacheDuration: 300,
            params: [
                {
                    name: "keyword",
                    title: "关键词",
                    type: "input",
                    description: "请输入番号",
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        {
            title: "热门榜单",
            description: "浏览热门影片",
            requiresWebView: false,
            functionName: "loadPage",
            cacheDuration: 3600,
            params: [
                {
                    name: "url",
                    title: "榜单选择",
                    type: "enumeration",
                    enumOptions: [
                        { title: "本周热门", value: "https://missav.com/cn/weekly-hot" },
                        { title: "今日热门", value: "https://missav.com/cn/today-hot" },
                        { title: "本月热门", value: "https://missav.com/cn/monthly-hot" },
                        { title: "最新发布", value: "https://missav.com/cn/new" },
                        { title: "无码流出", value: "https://missav.com/cn/uncensored-leak" }
                    ],
                    value: "https://missav.com/cn/weekly-hot"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        }
    ]
};

// 使用 var 避免作用域报错
var BASE_URL = "https://missav.com";
var USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15";
var HEADERS = {
    "User-Agent": USER_AGENT,
    "Referer": BASE_URL,
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
};

// 辅助函数：提取视频 ID
function extractVideoId(url) {
    if (!url) return "";
    var parts = url.split("/");
    return parts[parts.length - 1].split("?")[0];
}

// 核心解析逻辑：1:1 复刻可用模块
async function parseHtml(html) {
    var $ = Widget.html.load(html);
    var items = [];

    $("div.group").each(function(i, el) {
        var $el = $(el);
        var linkTag = $el.find("a").first();
        var href = linkTag.attr("href");
        
        if (href) {
            var videoId = extractVideoId(href);
            var title = $el.find("img").attr("alt") || linkTag.text().trim();
            
            // 核心：使用 fourhoi 拼接封面，解决无图问题
            var cover = "https://fourhoi.com/" + videoId + "/cover-m.jpg";
            
            items.push({
                id: href,
                type: "movie",
                title: title,
                link: href,
                backdropPath: cover,
                posterPath: cover, // 兼容不同视图
                releaseDate: $el.find("span.text-xs").last().text().trim()
            });
        }
    });
    
    return items;
}

// 搜索入口
async function searchVideos(params) {
    var keyword = params.keyword;
    if (!keyword) return [];
    var page = params.page || 1;
    
    var url = "https://missav.com/cn/search/" + encodeURIComponent(keyword) + "?page=" + page;
    
    try {
        var res = await Widget.http.get(url, { headers: HEADERS });
        return await parseHtml(res.data);
    } catch (e) {
        return [];
    }
}

// 榜单入口
async function loadPage(params) {
    var url = params.url || "https://missav.com/cn/weekly-hot";
    var page = params.page || 1;
    
    // 处理页码拼接
    var finalUrl = url + (url.indexOf("?") > -1 ? "&" : "?") + "page=" + page;
    
    try {
        var res = await Widget.http.get(finalUrl, { headers: HEADERS });
        return await parseHtml(res.data);
    } catch (e) {
        return [];
    }
}

// 详情页入口
async function loadDetail(link) {
    try {
        var res = await Widget.http.get(link, { headers: HEADERS });
        var html = res.data;
        var videoId = extractVideoId(link);
        
        // 1. 尝试直接提取 m3u8
        var videoUrl = "";
        var m3u8Match = html.match(/(https?:\/\/[a-z0-9\-\.]+\/[a-z0-9\-\.\/_]+\.m3u8[a-z0-9\-\.\/_?=&]*)/i);
        if (m3u8Match && m3u8Match[1]) {
            videoUrl = m3u8Match[1];
        }
        
        // 2. 备用：复刻可用模块的 UUID 提取逻辑
        if (!videoUrl) {
            var uuidMatch = html.match(/uuid\s*:\s*['"]([a-f0-9\-]+)['"]/i);
            if (uuidMatch && uuidMatch[1]) {
                videoUrl = "https://surrit.com/" + uuidMatch[1] + "/playlist.m3u8";
            }
        }

        if (!videoUrl) {
            // 如果真的没找到，尝试盲猜一个 surrit 地址 (保底)
            videoUrl = "https://surrit.com/" + videoId + "/playlist.m3u8";
        }

        // 提取推荐列表
        var childItems = await parseHtml(html);

        // 返回标准对象
        return {
            id: link,
            type: "detail", // 必须是 detail
            
            title: videoId.toUpperCase(),
            description: "番号: " + videoId.toUpperCase(),
            
            videoUrl: videoUrl,
            
            mediaType: "movie",
            playerType: "system",
            
            backdropPath: "https://fourhoi.com/" + videoId + "/cover-m.jpg",
            
            // 必须带 Referer
            customHeaders: {
                "User-Agent": USER_AGENT,
                "Referer": link
            },
            
            childItems: childItems
        };

    } catch (e) {
        // 错误兜底，防止模块崩溃提示
        var fallbackId = extractVideoId(link);
        return {
            id: link,
            type: "detail",
            title: "加载失败",
            description: e.message,
            videoUrl: "",
            backdropPath: "https://fourhoi.com/" + fallbackId + "/cover-m.jpg",
            childItems: []
        };
    }
}
