WidgetMetadata = {
    id: "rottentomatoes_pro",
    title: "烂番茄口碑榜 (Pro)",
    author: "MakkaPakka",
    description: "抓取烂番茄新鲜认证(>75%)榜单，并自动匹配 TMDB 中文元数据。",
    version: "3.0.0",
    requiredVersion: "0.0.1",
    site: "https://www.rottentomatoes.com",

    // 1. 全局参数：TMDB API Key
    globalParams: [
        {
            name: "apiKey",
            title: "TMDB API Key (必填)",
            type: "input",
            description: "用于获取中文海报和详情，请在 themoviedb.org 申请。",
            value: ""
        }
    ],

    modules: [
        {
            title: "口碑避雷针",
            functionName: "loadRottenTomatoes",
            type: "video", // 规范类型
            cacheDuration: 3600, // 缓存 1 小时
            params: [
                {
                    name: "listType",
                    title: "榜单类型",
                    type: "enumeration",
                    value: "movies_home",
                    enumOptions: [
                        { title: "流媒体热映 (Streaming)", value: "movies_home" },
                        { title: "院线热映 (Theaters)", value: "movies_theater" },
                        { title: "热门美剧 (TV Popular)", value: "tv_popular" },
                        { title: "最新美剧 (TV New)", value: "tv_new" },
                        { title: "最佳流媒体 (Best Streaming)", value: "movies_best" }
                    ]
                }
            ]
        }
    ]
};

// ==========================================
// 常量配置
// ==========================================

const TMDB_API = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w500";
const BACKDROP_BASE = "https://image.tmdb.org/t/p/w780";

// URL 映射表 (minTomato=75 过滤烂片)
const RT_URLS = {
    "movies_theater": "https://www.rottentomatoes.com/browse/movies_in_theaters/sort:popular?minTomato=75",
    "movies_home": "https://www.rottentomatoes.com/browse/movies_at_home/sort:popular?minTomato=75",
    "movies_best": "https://www.rottentomatoes.com/browse/movies_at_home/sort:critic_highest?minTomato=90",
    "tv_popular": "https://www.rottentomatoes.com/browse/tv_series_browse/sort:popular?minTomato=75",
    "tv_new": "https://www.rottentomatoes.com/browse/tv_series_browse/sort:newest?minTomato=75"
};

// ==========================================
// 主逻辑
// ==========================================

async function loadRottenTomatoes(params = {}) {
    // 1. 获取全局参数
    const { apiKey, listType = "movies_home" } = params;

    if (!apiKey) {
        return [{
            id: "err_no_key",
            type: "text",
            title: "❌ 配置缺失",
            subTitle: "请点击右上角设置，填入 TMDB API Key"
        }];
    }

    console.log(`[RT] Fetching: ${listType}`);

    // 2. 爬取烂番茄数据
    const rtItems = await fetchRottenTomatoesList(listType);

    if (rtItems.length === 0) {
        return [{
            id: "err_scrape",
            type: "text",
            title: "暂无数据",
            subTitle: "无法连接到烂番茄或该榜单为空"
        }];
    }

    // 3. TMDB 并发匹配 (取前 15 个，防止请求过多)
    // 烂番茄全是英文名，必须去 TMDB 搜对应的中文条目
    const matchPromises = rtItems.slice(0, 15).map((item, index) => 
        searchTmdb(item, apiKey, index + 1)
    );

    const results = await Promise.all(matchPromises);
    const finalItems = results.filter(Boolean); // 过滤掉匹配失败的项

    if (finalItems.length === 0) {
        return [{
            id: "err_match",
            type: "text",
            title: "匹配失败",
            subTitle: "获取到了榜单，但 TMDB 搜索无结果"
        }];
    }

    return finalItems;
}

// ==========================================
// 爬虫逻辑
// ==========================================

async function fetchRottenTomatoesList(type) {
    const url = RT_URLS[type] || RT_URLS["movies_home"];
    
    try {
        const res = await Widget.http.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        const html = res.data || "";
        if (!html) return [];

        const $ = Widget.html.load(html);
        const items = [];

        // 烂番茄的新版列表结构选择器
        $('[data-qa="discovery-media-list-item"]').each((i, el) => {
            const $el = $(el);
            
            // 提取标题
            const title = $el.find('[data-qa="discovery-media-list-item-title"]').text().trim();
            if (!title) return;

            // 提取分数
            const scoreEl = $el.find('score-pairs');
            const critics = scoreEl.attr('critics-score') || "";
            const audience = scoreEl.attr('audiencescore') || "";

            // 判断类型
            const isTv = type.includes("tv");

            items.push({
                title: title,
                tomatoScore: critics,
                popcornScore: audience,
                mediaType: isTv ? "tv" : "movie"
            });
        });

        return items;

    } catch (e) {
        console.error("RT Scrape Error:", e);
        return [];
    }
}

// ==========================================
// TMDB 匹配逻辑
// ==========================================

async function searchTmdb(rtItem, apiKey, rank) {
    // 简单的标题清洗：移除可能的年份后缀 (2024) 提高搜索命中率
    // 烂番茄有时会显示 "Movie Title (2024)"
    const cleanTitle = rtItem.title.replace(/\s\(\d{4}\)$/, "");
    
    const url = `${TMDB_API}/search/${rtItem.mediaType}`;
    
    try {
        const res = await Widget.http.get(url, {
            params: {
                api_key: apiKey,
                query: cleanTitle,
                language: "zh-CN"
            }
        });

        const data = res.data;
        if (!data || !data.results || data.results.length === 0) return null;

        const match = data.results[0]; // 取第一个匹配项

        // 构造副标题：优先显示分数
        let subTags = [];
        if (rtItem.tomatoScore) subTags.push(`🍅 ${rtItem.tomatoScore}%`);
        if (rtItem.popcornScore) subTags.push(`🍿 ${rtItem.popcornScore}%`);
        
        // 如果没有分数，显示原名
        const subTitle = subTags.length > 0 
            ? subTags.join("  ") 
            : (match.original_name || match.original_title);

        return {
            id: String(match.id),
            type: "tmdb",
            tmdbId: match.id,
            mediaType: rtItem.mediaType,
            
            // 格式：1. 电影中文名
            title: `${rank}. ${match.name || match.title}`,
            subTitle: subTitle,
            
            description: match.overview || `原名: ${rtItem.title}`,
            
            posterPath: match.poster_path ? `${IMG_BASE}${match.poster_path}` : "",
            backdropPath: match.backdrop_path ? `${BACKDROP_BASE}${match.backdrop_path}` : "",
            
            rating: match.vote_average ? match.vote_average.toFixed(1) : "0.0",
            year: (match.first_air_date || match.release_date || "").substring(0, 4)
        };

    } catch (e) {
        return null;
    }
}
