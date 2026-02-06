var WidgetMetadata = {
    id: "missav_test",
    title: "MissAVtest",
    description: "获取 MissAV 推荐",
    author: "test", 
    site: "https://for-ward.vercel.app", // 保持原样，防止出现证书错误
    version: "1.0.0",
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
                    description: "输入搜索关键词",
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        {
            title: "每周热门",
            description: "查看每周热门",
            requiresWebView: false,
            functionName: "loadPage",
            cacheDuration: 1800,
            params: [
                {
                    name: "url",
                    title: "url",
                    type: "constant",
                    value: "https://missav.com/cn/weekly-hot"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        {
            title: "今日热门",
            description: "查看今日热门",
            requiresWebView: false,
            functionName: "loadPage",
            cacheDuration: 1800,
            params: [
                {
                    name: "url",
                    title: "url",
                    type: "constant",
                    value: "https://missav.com/cn/today-hot"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        {
            title: "月度热门",
            description: "查看月度热门",
            requiresWebView: false,
            functionName: "loadPage",
            cacheDuration: 1800,
            params: [
                {
                    name: "url",
                    title: "url",
                    type: "constant",
                    value: "https://missav.com/cn/monthly-hot"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        {
            title: "新片上市",
            description: "查看新片上市",
            requiresWebView: false,
            functionName: "loadPage",
            cacheDuration: 1800,
            params: [
                {
                    name: "url",
                    title: "url",
                    type: "constant",
                    value: "https://missav.com/cn/new"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        {
            title: "无码流出",
            description: "查看无码流出",
            requiresWebView: false,
            functionName: "loadPage",
            cacheDuration: 1800,
            params: [
                {
                    name: "url",
                    title: "url",
                    type: "constant",
                    value: "https://missav.com/cn/uncensored-leak"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        }
    ]
};

// =============================================================
// 以下是原始逻辑代码
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

async function loadPage(params) {
    var url = params.url;
    var page = params.page || 1;
    
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
            
            // 封面图拼接逻辑
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
        
        // 提取视频流地址逻辑
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
            description: `番号: ${videoCode}`,
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
            description: `番号: ${videoCode}`,
            posterPath: "",
            backdropPath: `https://fourhoi.com/${videoId}/cover-t.jpg`,
            mediaType: "movie",
            playerType: "system",
            childItems: []
        };
    }
}
