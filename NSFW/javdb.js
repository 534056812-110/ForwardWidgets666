var WidgetMetadata = {
    id: "javdb_minimal",
    title: "JavDB",
    description: "最稳的元数据查询，绝对能跑通。",
    author: "Forward_Dev",
    site: "https://javdb.com",
    version: "1.0.0",
    requiredVersion: "0.0.2",
    detailCacheDuration: 300,
    modules: [
        {
            title: "搜索番号",
            description: "输入番号查询",
            requiresWebView: false,
            functionName: "searchVideo",
            params: [
                { name: "keyword", title: "番号", type: "input" },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        {
            title: "热门影片",
            description: "浏览每日排行",
            requiresWebView: false,
            functionName: "getDailyRank",
            params: [
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        }
    ]
};

// =================== 核心逻辑 ===================

const BASE_URL = "https://javdb.com";
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://javdb.com/"
};

// --- 搜索 ---
async function searchVideo(params) {
    var keyword = params.keyword;
    if (!keyword) return [];
    var page = params.page || 1;
    // JavDB 的搜索非常标准
    var url = `${BASE_URL}/search?q=${encodeURIComponent(keyword)}&page=${page}&f=all`;
    return await fetchAndParse(url);
}

// --- 热门 ---
async function getDailyRank(params) {
    var page = params.page || 1;
    // 排行榜链接
    var url = `${BASE_URL}/rankings/video_censored?period=daily&page=${page}`;
    return await fetchAndParse(url);
}

// --- 通用解析 (最稳的选择器) ---
async function fetchAndParse(url) {
    try {
        var res = await Widget.http.get(url, { headers: HEADERS });
        var html = res.data;
        var $ = Widget.html.load(html);
        var items = [];

        // JavDB 的列表项都在 .item 或 .grid-item 里
        $('.movie-list .item').each((i, el) => {
            var $el = $(el);
            var $link = $el.find('a').first();
            var href = $link.attr('href');
            
            // 补全链接
            if (href && !href.startsWith('http')) href = BASE_URL + href;

            var title = $el.find('.video-title').text() || $link.attr('title');
            var img = $el.find('img').attr('data-src') || $el.find('img').attr('src');
            var date = $el.find('.meta').text().replace(/\s+/g, ' ').trim();

            if (href && title) {
                items.push({
                    id: href,
                    type: "movie", // JavDB 主要是查元数据，这里用 movie 最好
                    title: title.trim(),
                    link: href,
                    posterPath: img,
                    backdropPath: img,
                    releaseDate: date
                });
            }
        });

        return items;
    } catch (e) {
        return [];
    }
}

// --- 详情页 (不做播放，只展示信息) ---
// JavDB 主要是元数据站，视频链接通常是磁力链，Forward 播不了磁力
// 所以我们只做展示，确保不报错
async function loadDetail(link) {
    try {
        var res = await Widget.http.get(link, { headers: HEADERS });
        var html = res.data;
        var $ = Widget.html.load(html);
        
        var title = $('.title.is-4').text().trim();
        var cover = $('.video-cover').attr('src');
        
        // 提取磁力链接用于展示 (可选)
        var magnet = $('.magnet-links .magnet-name a').first().attr('href') || "";

        return {
            id: link,
            type: "detail",
            title: title,
            description: "JavDB 详情页 (磁力链不可直接播放)",
            videoUrl: link, // 没有在线流，回退到网页
            posterPath: cover,
            backdropPath: cover,
            mediaType: "movie",
            playerType: "system",
            childItems: []
        };
    } catch (e) {
        return {
            id: link,
            type: "detail",
            title: "Error",
            videoUrl: link,
            childItems: []
        };
    }
}
