var WidgetMetadata = {
    id: "netflav_fixed",
    title: "Netflav",
    description: "\u6d4f\u89c8 Netflav \u7cbe\u9009\u5f71\u7247",
    author: "Forward_User",
    site: "https://netflav.com",
    version: "1.1.0",
    requiredVersion: "0.0.2",
    detailCacheDuration: 300,
    modules: [
        {
            title: "\u641c\u7d22\u5f71\u7247",
            description: "\u641c\u7d22\u756a\u53f7\u6216\u5173\u952e\u8bcd",
            functionName: "searchVideos",
            requiresWebView: false,
            params: [
                {
                    name: "keyword",
                    title: "\u5173\u952e\u8bcd",
                    type: "input",
                    description: "\u8f93\u5165\u756a\u53f7",
                },
                { name: "page", title: "\u9875\u7801", type: "page", value: "1" }
            ]
        },
        {
            title: "\u6700\u65b0\u66f4\u65b0",
            description: "\u67e5\u770b\u6700\u65b0\u53d1\u5e03\u7684\u5f71\u7247",
            functionName: "loadPage",
            requiresWebView: false,
            params: [
                { 
                    name: "url", 
                    title: "\u7c7b\u578b", 
                    type: "constant", 
                    value: "https://netflav.com/browse" 
                },
                { name: "page", title: "\u9875\u7801", type: "page", value: "1" }
            ]
        },
        {
            title: "\u70ed\u95e8\u5f71\u7247",
            description: "\u67e5\u770b\u70ed\u95e8\u6392\u884c",
            functionName: "loadPage",
            requiresWebView: false,
            params: [
                { 
                    name: "url", 
                    title: "\u7c7b\u578b", 
                    type: "constant", 
                    value: "https://netflav.com/trending" 
                },
                { name: "page", title: "\u9875\u7801", type: "page", value: "1" }
            ]
        }
    ]
};

// =============================================================
// 核心逻辑
// =============================================================

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    "Referer": "https://netflav.com/"
};

async function searchVideos(params) {
    var keyword = params.keyword;
    var page = params.page || 1;
    var url = `https://netflav.com/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;
    var response = await Widget.http.get(url, { headers: HEADERS });
    return parseHtml(response.data);
}

async function loadPage(params) {
    var url = params.url || "https://netflav.com/browse";
    var page = params.page || 1;
    if (url.includes('?')) {
        url = `${url}&page=${page}`;
    } else {
        url = `${url}?page=${page}`;
    }
    var response = await Widget.http.get(url, { headers: HEADERS });
    return parseHtml(response.data);
}

// 辅助函数：处理图片链接（解决不显示问题）
function fixImageUrl(url) {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    // 如果是相对路径，补全域名
    return "https://netflav.com" + url;
}

async function parseHtml(html) {
    var items = [];
    
    // 策略 A: JSON 解析 (优先)
    try {
        var jsonMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
        if (jsonMatch && jsonMatch[1]) {
            var jsonData = JSON.parse(jsonMatch[1]);
            var state = jsonData.props.pageProps.initialState;
            var docs = [];
            
            // 遍历查找 docs 数组
            if (state) {
                Object.keys(state).forEach(key => {
                    if (state[key] && state[key].docs) {
                        docs = state[key].docs;
                    }
                });
            }

            if (docs.length > 0) {
                docs.forEach(doc => {
                    // 获取图片，优先用 preview，没有则用 thumb
                    var rawImg = doc.preview_url || doc.preview || doc.thumb || "";
                    var fullImg = fixImageUrl(rawImg);

                    items.push({
                        id: "https://netflav.com/video?id=" + doc.videoId,
                        type: "movie",
                        title: doc.title,
                        link: "https://netflav.com/video?id=" + doc.videoId,
                        posterPath: fullImg,  // 使用修复后的图片地址
                        backdropPath: fullImg,
                        releaseDate: doc.sourceDate ? doc.sourceDate.split('T')[0] : "",
                        playerType: "system"
                    });
                });
                return items;
            }
        }
    } catch (e) {
        console.log("JSON Parse Failed");
    }

    // 策略 B: DOM 解析 (备用)
    var $ = Widget.html.load(html);
    $('div[class*="grid"] > div').each((i, el) => {
        var $el = $(el);
        var $link = $el.find('a').first();
        if ($link.length > 0) {
            var href = $link.attr('href');
            if (href && !href.startsWith('http')) href = "https://netflav.com" + href;

            var title = $el.find('.title').text() || $el.find('div[class*="title"]').text();
            var img = $el.find('img').attr('src');
            
            // 补全 DOM 解析出来的图片
            img = fixImageUrl(img);

            if (href && title) {
                items.push({
                    id: href,
                    type: "movie",
                    title: title.trim(),
                    link: href,
                    posterPath: img,
                    backdropPath: img,
                    releaseDate: $el.find('.date').text().trim(),
                    playerType: "system"
                });
            }
        }
    });

    return items;
}

async function loadDetail(link) {
    try {
        var response = await Widget.http.get(link, { headers: HEADERS });
        var html = response.data;
        var m3u8Url = "";
        var title = "";
        var poster = "";

        // 1. 尝试从 JSON 获取所有详情信息
        var jsonMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
        if (jsonMatch && jsonMatch[1]) {
            try {
                var data = JSON.parse(jsonMatch[1]);
                var videoData = data.props.pageProps.initialState.video.data;
                
                if (videoData) {
                    title = videoData.title;
                    m3u8Url = videoData.src || videoData.videoUrl; 
                    poster = fixImageUrl(videoData.preview || videoData.thumb);
                }
            } catch(e) {}
        }

        // 2. 如果 JSON 没拿到 m3u8，尝试正则提取
        if (!m3u8Url) {
            var match = html.match(/(https?:\/\/[^"']+\.m3u8[^"']*)/);
            if (match) {
                m3u8Url = match[1];
            }
        }
        
        // 3. 还是没有？尝试查找 video 标签
        if (!m3u8Url) {
             var $ = Widget.html.load(html);
             m3u8Url = $('video').attr('src') || $('source').attr('src');
             if (!title) title = $('h1').text().trim();
        }

        return {
            id: link,
            type: "detail",
            videoUrl: m3u8Url || link,
            title: title || "Netflav Video",
            description: "\u756a\u53f7: " + title,
            posterPath: poster,
            backdropPath: poster,
            mediaType: "movie",
            playerType: "system",
            // 【关键修改】这里将 Referer 传递给播放器
            customHeaders: {
                "Referer": "https://netflav.com/", // 必须有这个，否则无法播放
                "User-Agent": HEADERS["User-Agent"],
                "Origin": "https://netflav.com"
            }
        };

    } catch (e) {
        return {
            id: link,
            type: "detail",
            videoUrl: "",
            title: "Error",
            description: e.message,
            childItems: []
        };
    }
}
