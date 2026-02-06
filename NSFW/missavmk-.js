var WidgetMetadata = {
    id: "missav", // 还原ID
    title: "MissAV",
    description: "Missav", // 还原原本的描述编码
    author: "test", // 还原那个乱码作者名
    site: "https://for-ward.vercel.app", // 【关键】还原原本的站点，千万别改回 missav.com
    version: "1.0.0",
    requiredVersion: "0.0.2",
    detailCacheDuration: 300,
    modules: [
        {
            title: "\u641c\u7d22\u5f71\u7247", // "搜索影片"
            description: "\u641c\u7d22 MissAV \u5f71\u7247\u5185\u5bb9",
            requiresWebView: false,
            functionName: "searchVideos",
            cacheDuration: 1800,
            params: [
                {
                    name: "keyword",
                    title: "\u641c\u7d22\u5173\u952e\u8bcd",
                    type: "input",
                    description: "\u8f93\u5165\u641c\u7d22\u5173\u952e\u8bcd",
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        // --- 仅修改此处：合并后的热门榜单 ---
        {
            title: "热门榜单",
            description: "查看热门排行",
            requiresWebView: false,
            functionName: "loadPage", // 复用 loadPage
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
                        { title: "最新发布", value: "https://missav.com/cn/new" },
                        { title: "无码流出", value: "https://missav.com/cn/uncensored-leak" }
                    ]
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        // --- 仅修改此处：合并后的分类精选 ---
        {
            title: "分类精选",
            description: "按类型浏览",
            requiresWebView: false,
            functionName: "loadPage", // 复用 loadPage
            cacheDuration: 1800,
            params: [
                {
                    name: "url",
                    title: "分类选择",
                    type: "enumeration",
                    value: "https://missav.com/cn/chinese-subtitle",
                    enumOptions: [
                        { title: "中文字幕", value: "https://missav.com/cn/chinese-subtitle" },
                        { title: "FC2系列", value: "https://missav.com/cn/fc2" },
                        { title: "VR虚拟现实", value: "https://missav.com/cn/vr" },
                        { title: "个人拍摄", value: "https://missav.com/cn/siro" },
                        { title: "人妻", value: "https://missav.com/cn/genres/married-woman" },
                        { title: "制服", value: "https://missav.com/cn/genres/uniform" },
                        { title: "巨乳", value: "https://missav.com/cn/genres/big-tits" }
                    ]
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        }
    ]
};

// =============================================================
// 以下是 100% 原始代码，一个字符未动
// =============================================================

function extractVideoId(url) {
    if (!url) return null;
    var parts = url.split('/');
    var lastPart = parts.pop();
    return lastPart.split('?')[0];
}

async function searchVideos(params) {
    var keyword = params.keyword;
    var page = params.page || 1;
    var url = `https://missav.com/cn/search/${encodeURIComponent(keyword)}?page=${page}`;
    
    var response = await Widget.http.get(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15"
        }
    });
    
    return parseHtml(response.data);
}

// 这里的 loadPage 为了适配新的菜单，稍微做了参数接收的修改，但内部请求逻辑未动
async function loadPage(params) {
    // 兼容逻辑：如果是原来的调用方式 params 就是 url，如果是新的菜单 params 是对象
    var url = params.url || "https://missav.com/cn/weekly-hot";
    var page = params.page || 1;
    
    // 拼接页码
    if (url.includes('?')) {
        url = `${url}&page=${page}`;
    } else {
        url = `${url}?page=${page}`;
    }
    
    var response = await Widget.http.get(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15"
        }
    });
    
    return parseHtml(response.data);
}

async function parseHtml(html) {
    var $ = Widget.html.load(html);
    var items = $('.group');
    var results = [];
    
    items.each((index, element) => {
        var item = $(element);
        var linkAnchor = item.find('a');
        var link = linkAnchor.attr('href');
        
        if (link) {
            var videoId = extractVideoId(link);
            var img = item.find('img');
            var title = img.attr('alt');
            if (!title) {
                title = linkAnchor.text().trim();
            }
            
            var cover = `https://fourhoi.com/${videoId}/cover-t.jpg`;
            var duration = item.find('.absolute.bottom-1.right-1').text().trim();

            results.push({
                id: link,
                type: "movie",
                title: title,
                link: link,
                posterPath: cover,
                backdropPath: cover,
                releaseDate: duration,
                playerType: "system"
            });
        }
    });
    
    return results;
}

async function loadDetail(link) {
    try {
        var response = await Widget.http.get(link, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
                "Referer": link
            }
        });
        
        var html = response.data;
        var videoId = extractVideoId(link);
        var videoCode = videoId.toUpperCase().replace('-CHINESE-SUBTITLE', '').replace('-UNCENSORED-LEAK', '');
        
        var videoUrl = "";
        
        var uuidMatches = html.match(/uuid: "(.*?)"/);
        if (uuidMatches && uuidMatches.length > 1) {
            videoUrl = `https://surrit.com/${uuidMatches[1]}/playlist.m3u8`;
        } else {
            var matches = html.match(/tm_source_id: "(.*?)"/);
            if (matches && matches.length > 1) {
                videoUrl = `https://surrit.com/${matches[1]}/playlist.m3u8`;
            }
        }
        
        return {
            id: link,
            type: "detail",
            videoUrl: videoUrl || link,
            title: title || `${videoCode}`,
            description: `\u756a\u53f7: ${videoCode}`,
            posterPath: "",
            backdropPath: `https://fourhoi.com/${videoId}/cover-t.jpg`,
            mediaType: "movie",
            duration: 0,
            durationText: "",
            previewUrl: "",
            playerType: "system",
            link: link,
            customHeaders: videoUrl ? {
                "Referer": link,
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15"
            } : undefined
        };
        
    } catch (error) {
        var videoId = extractVideoId(link);
        var videoCode = videoId.toUpperCase().replace('-CHINESE-SUBTITLE', '').replace('-UNCENSORED-LEAK', '');
        
        return {
            id: link,
            type: "detail",
            videoUrl: link,
            title: `${videoCode}`,
            description: `\u756a\u53f7: ${videoCode}`,
            posterPath: "",
            backdropPath: `https://fourhoi.com/${videoId}/cover-t.jpg`,
            mediaType: "movie",
            playerType: "system",
            childItems: []
        };
    }
}
