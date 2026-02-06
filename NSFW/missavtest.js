WidgetMetadata = {
    id: "missav_clone_stable",
    title: "MissAV (稳定克隆版)",
    description: "基于Fourhoi源的封面拼接策略，完美修复列表加载错误。",
    author: "Butterfly_Clone",
    site: "https://missav.com",
    version: "2.0.0",
    requiredVersion: "0.0.2",
    detailCacheDuration: 0, 
    modules: [
        {
            title: "搜索影片",
            description: "搜索 MissAV 影片内容",
            requiresWebView: false,
            functionName: "searchVideos",
            cacheDuration: 300,
            params: [
                {
                    name: "keyword",
                    title: "搜索关键词",
                    type: "input",
                    description: "输入番号或关键词",
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
                    title: "榜单类型",
                    type: "enumeration",
                    enumOptions: [
                        { title: "今日热门", value: "https://missav.com/cn/today-hot" },
                        { title: "本周热门", value: "https://missav.com/cn/weekly-hot" },
                        { title: "本月热门", value: "https://missav.com/cn/monthly-hot" },
                        { title: "最新发布", value: "https://missav.com/cn/new" },
                        { title: "无码流出", value: "https://missav.com/cn/uncensored-leak" },
                        { title: "中文字幕", value: "https://missav.com/cn/chinese-subtitle" }
                    ],
                    value: "https://missav.com/cn/weekly-hot"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        }
    ]
};

// =================== 核心逻辑 ===================

// 使用与原模块一致的 Safari UA，通过率极高
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15";

const HEADERS = {
    "User-Agent": USER_AGENT,
    "Referer": "https://missav.com/",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
};

/**
 * 辅助函数：从 URL 提取视频 ID
 * 例如: https://missav.com/cn/sw-963 -> sw-963
 */
function extractVideoId(url) {
    if (!url) return "";
    const parts = url.split("/");
    // 取最后一段，并去掉可能存在的 ? 参数
    return parts[parts.length - 1].split("?")[0];
}

/**
 * 核心列表解析器
 * 策略：不抓图片地址，直接用 ID 拼图片地址
 */
async function parseHtmlList(html) {
    const $ = Widget.html.load(html);
    const items = [];

    // 遍历所有视频卡片
    $("div.group").each((i, el) => {
        const $el = $(el);
        const linkEl = $el.find("a").first();
        const href = linkEl.attr("href");
        
        if (href) {
            const videoId = extractVideoId(href);
            // 优先获取 alt 作为标题，如果没有则用文本
            const title = $el.find("img").attr("alt") || linkEl.text().trim();
            
            // 关键策略：手动拼接封面图地址，避开懒加载陷阱
            // cover-t.jpg 是缩略图，加载快
            const cover = `https://fourhoi.com/${videoId}/cover-t.jpg`;
            
            // 获取时长
            const duration = $el.find(".duration").text().trim() || 
                             $el.find("span.text-xs").last().text().trim();

            items.push({
                id: href,
                type: "movie", // 列表必须是 movie
                title: title,
                link: href,
                backdropPath: cover, // 强行写入拼接好的封面
                releaseDate: duration
            });
        }
    });
    
    return items;
}

/**
 * 搜索入口
 */
async function searchVideos(params) {
    const keyword = params.keyword;
    const page = params.page || 1;
    if (!keyword) return [];
    
    // 构建搜索 URL
    const url = `https://missav.com/cn/search/${encodeURIComponent(keyword)}?page=${page}`;
    
    try {
        const res = await Widget.http.get(url, { headers: HEADERS });
        return await parseHtmlList(res.data);
    } catch (e) {
        return [];
    }
}

/**
 * 榜单入口
 */
async function loadPage(params) {
    let url = params.url || "https://missav.com/cn/weekly-hot";
    const page = params.page || 1;
    
    // 拼接页码
    if (url.includes("?")) {
        url += `&page=${page}`;
    } else {
        url += `?page=${page}`;
    }
    
    try {
        const res = await Widget.http.get(url, { headers: HEADERS });
        return await parseHtmlList(res.data);
    } catch (e) {
        return [];
    }
}

/**
 * 详情页 & 播放解析
 * 结合了你给的代码和我之前的正则，双重保险
 */
async function loadDetail(link) {
    try {
        const res = await Widget.http.get(link, { headers: HEADERS });
        const html = res.data;
        
        // 1. 尝试提取视频地址
        let m3u8Url = "";
        
        // 策略A: 通用正则提取 .m3u8
        // 匹配 https://...playlist.m3u8...
        const regexMatch = html.match(/(https?:\/\/[a-z0-9\-\.]+\/[a-z0-9\-\.\/_]+\.m3u8[a-z0-9\-\.\/_?=&]*)/i);
        if (regexMatch && regexMatch[1]) {
            m3u8Url = regexMatch[1];
        }
        
        // 策略B (备用): 尝试从 script 中找 UUID 拼接 (参考你上传的文件)
        if (!m3u8Url) {
            const uuidMatch = html.match(/uuid\s*:\s*['"]([a-f0-9\-]+)['"]/i);
            if (uuidMatch && uuidMatch[1]) {
                // 这是 MissAV 有时会用的 CDN 规则
                m3u8Url = `https://surrit.com/${uuidMatch[1]}/playlist.m3u8`;
            }
        }

        if (!m3u8Url) {
            throw new Error("无播放源");
        }

        const videoId = extractVideoId(link);
        const title = $("h1").text().trim() || videoId;
        
        // 提取相关推荐
        const relatedItems = await parseHtmlList(html);

        // 返回 Forward 标准 Detail 对象
        return {
            id: link,
            type: "detail", // 必须是 detail
            
            title: title,
            description: `番号: ${videoId.toUpperCase()}`,
            
            videoUrl: m3u8Url,
            
            mediaType: "movie",
            playerType: "system",
            
            // 封面图：详情页用 cover-m.jpg (中图) 更清晰
            backdropPath: `https://fourhoi.com/${videoId}/cover-m.jpg`,
            
            // 必须带 Referer
            customHeaders: {
                "User-Agent": USER_AGENT,
                "Referer": link
            },
            
            childItems: relatedItems
        };

    } catch (e) {
        // 出错兜底，显示封面图
        const videoId = extractVideoId(link);
        return {
            id: link,
            type: "detail",
            title: "解析失败",
            description: e.message,
            backdropPath: `https://fourhoi.com/${videoId}/cover-m.jpg`,
            videoUrl: "",
            childItems: []
        };
    }
}
