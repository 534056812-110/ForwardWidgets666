var WidgetMetadata = {
    id: "netflav_pro",
    title: "Netflav",
    description: "\u6d4f\u89c8 Netflav \u7cbe\u9009\u5f71\u7247", // "浏览 Netflav 精选影片"
    author: "Forward_User",
    site: "https://netflav.com",
    version: "1.0.0",
    requiredVersion: "0.0.2",
    detailCacheDuration: 300,
    modules: [
        {
            title: "\u641c\u7d22\u5f71\u7247", // "搜索影片"
            description: "\u641c\u7d22\u756a\u53f7\u6216\u5173\u952e\u8bcd", // "搜索番号或关键词"
            functionName: "searchVideos",
            requiresWebView: false,
            params: [
                {
                    name: "keyword",
                    title: "\u5173\u952e\u8bcd", // "关键词"
                    type: "input",
                    description: "\u8f93\u5165\u756a\u53f7", // "输入番号"
                },
                { name: "page", title: "\u9875\u7801", type: "page", value: "1" }
            ]
        },
        {
            title: "\u6700\u65b0\u66f4\u65b0", // "最新更新"
            description: "\u67e5\u770b\u6700\u65b0\u53d1\u5e03\u7684\u5f71\u7247", // "查看最新发布的影片"
            functionName: "loadPage",
            requiresWebView: false,
            params: [
                { 
                    name: "url", 
                    title: "\u7c7b\u578b", // "类型"
                    type: "constant", 
                    value: "https://netflav.com/browse" 
                },
                { name: "page", title: "\u9875\u7801", type: "page", value: "1" }
            ]
        },
        {
            title: "\u70ed\u95e8\u5f71\u7247", // "热门影片"
            description: "\u67e5\u770b\u70ed\u95e8\u6392\u884c", // "查看热门排行"
            functionName: "loadPage",
            requiresWebView: false,
            params: [
                { 
                    name: "url", 
                    title: "\u7c7b\u578b", // "类型"
                    type: "constant", 
                    value: "https://netflav.com/trending" 
                },
                { name: "page", title: "\u9875\u7801", type: "page", value: "1" }
            ]
        }
    ]
};

// =============================================================
// 核心功能区
// =============================================================

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    "Referer": "https://netflav.com/"
};

// --- 功能 1: 搜索 ---
async function searchVideos(params) {
    var keyword = params.keyword;
    var page = params.page || 1;
    // Netflav 的搜索 URL 结构
    var url = `https://netflav.com/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;
    
    var response = await Widget.http.get(url, { headers: HEADERS });
    return parseHtml(response.data);
}

// --- 功能 2: 加载列表 ---
async function loadPage(params) {
    var url = params.url || "https://netflav.com/browse";
    var page = params.page || 1;

    // 处理分页
    if (url.includes('?')) {
        url = `${url}&page=${page}`;
    } else {
        url = `${url}?page=${page}`;
    }

    var response = await Widget.http.get(url, { headers: HEADERS });
    return parseHtml(response.data);
}

// --- 核心解析器: 混合模式 (JSON + DOM) ---
async function parseHtml(html) {
    var items = [];
    
    // 策略 A: 尝试解析 Next.js 的 JSON 数据 (最高效)
    // Netflav 是 React 网站，数据通常在 <script id="__NEXT_DATA__"> 里
    try {
        var jsonMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
        if (jsonMatch && jsonMatch[1]) {
            var jsonData = JSON.parse(jsonMatch[1]);
            // 深入查找 docs 或 videos 数组
            // 路径通常是 props.pageProps.initialState.xxx.docs
            var state = jsonData.props.pageProps.initialState;
            var docs = [];
            
            // 遍历查找包含 docs 的对象
            if (state) {
                Object.keys(state).forEach(key => {
                    if (state[key] && state[key].docs) {
                        docs = state[key].docs;
                    }
                });
            }

            // 如果找到了 JSON 数据，直接映射
            if (docs.length > 0) {
                docs.forEach(doc => {
                    items.push({
                        id: "https://netflav.com/video?id=" + doc.videoId,
                        type: "movie",
                        title: doc.title,
                        link: "https://netflav.com/video?id=" + doc.videoId,
                        posterPath: doc.preview_url || doc.preview, // 封面
                        backdropPath: doc.preview_url || doc.preview,
                        releaseDate: doc.sourceDate || "",
                        playerType: "system"
                    });
                });
                return items; // 如果成功，直接返回，不再进行 DOM 解析
            }
        }
    } catch (e) {
        // JSON 解析失败，静默回退到 DOM 解析
        console.log("JSON Parse Failed, fallback to DOM");
    }

    // 策略 B: DOM 解析 (Cheerio)
    var $ = Widget.html.load(html);
    
    // 查找所有 grid item
    // Netflav 的 grid 结构通常包含 'grid' 类
    $('div[class*="grid"] > div').each((i, el) => {
        var $el = $(el);
        var $link = $el.find('a').first();
        
        if ($link.length > 0) {
            var href = $link.attr('href');
            // 补全链接
            if (href && !href.startsWith('http')) {
                href = "https://netflav.com" + href;
            }

            var title = $el.find('.title').text() || $el.find('div[class*="title"]').text();
            // 封面图通常在 img src 或 style background-image
            var img = $el.find('img').attr('src');
            
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

// --- 功能 3: 详情页与播放 ---
async function loadDetail(link) {
    try {
        var response = await Widget.http.get(link, { headers: HEADERS });
        var html = response.data;
        var m3u8Url = "";

        // 策略 1: 正则提取 .m3u8
        var match = html.match(/(https?:\/\/[^"']+\.m3u8[^"']*)/);
        if (match) {
            m3u8Url = match[1];
        }
        
        // 策略 2: 如果找不到，查找 JSON 里的 videoUrl
        if (!m3u8Url) {
             var jsonMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
             if (jsonMatch && jsonMatch[1]) {
                 var data = JSON.parse(jsonMatch[1]);
                 // 尝试定位 video 数据
                 // 路径可能是 props.pageProps.initialState.video.data
                 try {
                     var videoData = data.props.pageProps.initialState.video.data;
                     if (videoData && videoData.src) {
                         m3u8Url = videoData.src;
                     }
                 } catch(e) {}
             }
        }

        // 获取标题和封面用于展示
        var $ = Widget.html.load(html);
        var title = $('h1').text().trim() || "Netflav Video";
        // 尝试获取封面
        var poster = $('meta[property="og:image"]').attr('content') || "";

        return {
            id: link,
            type: "detail",
            videoUrl: m3u8Url || link, // 找到就播，找不到就给网页链接
            title: title,
            description: "\u756a\u53f7: " + title, // "番号: "
            posterPath: poster,
            backdropPath: poster,
            mediaType: "movie",
            playerType: "system",
            customHeaders: {
                "Referer": "https://netflav.com/",
                "User-Agent": HEADERS["User-Agent"]
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
