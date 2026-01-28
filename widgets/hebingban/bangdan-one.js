WidgetMetadata = {
    id: "western_trends_hub",
    title: "欧美风向标|口碑与热度",
    author: "𝙈𝙖𝙠𝙠𝙖𝙋𝙖𝙠𝙠𝙖",
    description: "聚合烂番茄(口碑)与流媒体平台(热度)，一站式掌握欧美影视动态。",
    version: "1.0.1",
    requiredVersion: "0.0.1",
    site: "https://www.rottentomatoes.com",

    // 0. 全局免 Key
    globalParams: [],

    modules: [
        {
            title: "欧美风向标",
            functionName: "loadWesternTrends",
            type: "list",
            cacheDuration: 3600,
            params: [
                // 1. 榜单源选择
                {
                    name: "source",
                    title: "选择榜单",
                    type: "enumeration",
                    value: "rt_movies_home",
                    enumOptions: [
                        // --- 烂番茄 (口碑) ---
                        { title: "🍅 烂番茄 - 流媒体热映", value: "rt_movies_home" },
                        { title: "🍅 烂番茄 - 院线 热映", value: "rt_movies_theater" },
                        { title: "🍅 烂番茄 - 热门 剧集", value: "rt_tv_popular" },
                        { title: "🍅 烂番茄 - 最新 剧集", value: "rt_tv_new" },
                        { title: "🍅 烂番茄 - 最佳流媒体", value: "rt_movies_best" },
                        
                        // --- 流媒体平台 (热度) ---
                        { title: "🔥 Netflix Top10", value: "fp_netflix" },
                        { title: "🔥 HBO Top10", value: "fp_hbo" },
                        { title: "🔥 Disney+ Top10", value: "fp_disney" },
                        { title: "🔥 Apple TV+ Top10", value: "fp_apple" },
                        { title: "🔥 Amazon Top10", value: "fp_amazon" }
                    ]
                },
                // 2. 地区 (仅 FlixPatrol 有效)
                {
                    name: "region",
                    title: "地区 (仅热度榜)",
                    type: "enumeration",
                    value: "united-states",
                    belongTo: { 
                        paramName: "source", 
                        value: ["fp_netflix", "fp_hbo", "fp_disney", "fp_apple", "fp_amazon"] 
                    },
                    enumOptions: [
                        { title: "美国", value: "united-states" },
                        { title: "英国", value: "united-kingdom" },
                        { title: "韩国", value: "south-korea" },
                        { title: "日本", value: "japan" },
                        { title: "台灣", value: "taiwan" },
                        { title: "香港", value: "hong-kong" }
                    ]
                },
                // 3. 类型 (仅 FlixPatrol 有效)
                {
                    name: "mediaType",
                    title: "类型 (仅热度榜)",
                    type: "enumeration",
                    value: "tv",
                    belongTo: { 
                        paramName: "source", 
                        value: ["fp_netflix", "fp_hbo", "fp_disney", "fp_apple", "fp_amazon"] 
                    },
                    enumOptions: [
                        { title: "剧集", value: "tv" },
                        { title: "电影", value: "movie" }
                    ]
                },
                // 4. 页码 (通用)
                {
                    name: "page",
                    title: "页码",
                    type: "page"
                }
            ]
        }
    ]
};

// =========================================================================
// 0. 通用配置
// =========================================================================

const GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录片",
    18: "剧情", 10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐",
    9648: "悬疑", 10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚",
    10752: "战争", 37: "西部", 10759: "动作冒险", 10762: "儿童", 10763: "新闻",
    10764: "真人秀", 10765: "科幻奇幻", 10766: "肥皂剧", 10767: "脱口秀", 10768: "战争政治"
};

const RT_URLS = {
    "rt_movies_theater": "https://www.rottentomatoes.com/browse/movies_in_theaters/sort:popular?minTomato=75",
    "rt_movies_home": "https://www.rottentomatoes.com/browse/movies_at_home/sort:popular?minTomato=75",
    "rt_movies_best": "https://www.rottentomatoes.com/browse/movies_at_home/sort:critic_highest?minTomato=90",
    "rt_tv_popular": "https://www.rottentomatoes.com/browse/tv_series_browse/sort:popular?minTomato=75",
    "rt_tv_new": "https://www.rottentomatoes.com/browse/tv_series_browse/sort:newest?minTomato=75"
};

// =========================================================================
// 1. 入口分流
// =========================================================================

async function loadWesternTrends(params = {}) {
    const { source, page = 1 } = params;

    // --- A. 烂番茄 (Rotten Tomatoes) ---
    if (source.startsWith("rt_")) {
        return await loadRottenTomatoes(source, page);
    }

    // --- B. FlixPatrol (热度) ---
    if (source.startsWith("fp_")) {
        // fp_netflix -> netflix
        const platform = source.replace("fp_", ""); 
        return await loadFlixPatrol(platform, params.region, params.mediaType);
    }
}

// =========================================================================
// 2. 烂番茄逻辑 (含本地翻页)
// =========================================================================

async function loadRottenTomatoes(listType, page) {
    const pageSize = 15;
    
    // 1. 抓取 (全量)
    const allItems = await fetchRottenTomatoesList(listType);
    
    if (allItems.length === 0) {
        return page === 1 ? [{ id: "err", type: "text", title: "烂番茄无数据" }] : [];
    }

    // 2. 切片 (分页)
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    if (start >= allItems.length) return [];
    
    const pageItems = allItems.slice(start, end);

    // 3. 匹配 TMDB
    const promises = pageItems.map((item, i) => searchTmdb(item, start + i + 1));
    return (await Promise.all(promises)).filter(Boolean);
}

async function fetchRottenTomatoesList(type) {
    const url = RT_URLS[type] || RT_URLS["rt_movies_home"];
    try {
        const res = await Widget.http.get(url, {
            headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" }
        });
        const html = res.data || "";
        if (!html) return [];
        const $ = Widget.html.load(html);
        const items = [];
        
        $('[data-qa="discovery-media-list-item"]').each((i, el) => {
            const $el = $(el);
            const title = $el.find('[data-qa="discovery-media-list-item-title"]').text().trim();
            if (!title) return;
            const scoreEl = $el.find('score-pairs');
            items.push({
                title: title,
                tomatoScore: scoreEl.attr('critics-score') || "",
                popcornScore: scoreEl.attr('audiencescore') || "",
                mediaType: type.includes("tv") ? "tv" : "movie"
            });
        });
        return items;
    } catch (e) { return []; }
}

async function searchTmdb(rtItem, rank) {
    const cleanTitle = rtItem.title.replace(/\s\(\d{4}\)$/, "");
    try {
        const res = await Widget.tmdb.get(`/search/${rtItem.mediaType}`, {
            params: { query: cleanTitle, language: "zh-CN" }
        });
        const match = (res.results || [])[0];
        if (!match) return null;

        // 构造分数标签
        let scores = [];
        if (rtItem.tomatoScore) scores.push(`🍅 ${rtItem.tomatoScore}%`);
        if (rtItem.popcornScore) scores.push(`🍿 ${rtItem.popcornScore}%`);
        
        return buildItem(match, rtItem.mediaType, {
            rank: rank,
            subTitle: scores.join("  ") || "烂番茄认证",
            descPrefix: `原名: ${rtItem.title}`
        });
    } catch (e) { return null; }
}

// =========================================================================
// 3. FlixPatrol 逻辑
// =========================================================================

async function loadFlixPatrol(platform, region = "united-states", mediaType = "tv") {
    // 1. 抓取
    const titles = await fetchFlixPatrolData(platform, region, mediaType);
    
    // 2. 兜底
    if (titles.length === 0) return await fetchTmdbFallback(platform, region, mediaType);

    // 3. 匹配 (前10)
    const promises = titles.slice(0, 10).map((title, i) => searchTmdbFP(title, mediaType, i + 1));
    return (await Promise.all(promises)).filter(Boolean);
}

async function fetchFlixPatrolData(platform, region, mediaType) {
    const url = `https://flixpatrol.com/top10/${platform}/${region}/`;
    try {
        const res = await Widget.http.get(url, {
            headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" }
        });
        const html = res.data || "";
        if (!html) return [];
        const $ = Widget.html.load(html);
        
        let targetTable = null;
        const sectionKeyword = mediaType === "movie" ? "Movies" : "TV";
        
        $('div.card').each((i, el) => {
            if ($(el).find('h2').text().includes(sectionKeyword)) {
                targetTable = $(el).find('table tbody');
                return false;
            }
        });
        if (!targetTable) {
            const tables = $('table tbody');
            if (tables.length >= 2) targetTable = mediaType === "movie" ? tables.eq(0) : tables.eq(1);
            else if (tables.length === 1) targetTable = tables.eq(0);
            else return [];
        }
        
        const titles = [];
        targetTable.find('tr').each((i, el) => {
            if (i >= 10) return;
            let title = $(el).find('a.hover\\:underline').text().trim() || $(el).find('td').eq(2).text().trim();
            if (title && title.length > 1) titles.push(title.replace(/\s\(\d{4}\)$/, '').trim());
        });
        return titles;
    } catch (e) { return []; }
}

async function searchTmdbFP(title, mediaType, rank) {
    try {
        const res = await Widget.tmdb.get(`/search/${mediaType}`, {
            params: { query: title, language: "zh-CN" }
        });
        const match = (res.results || [])[0];
        if (!match) return null;

        return buildItem(match, mediaType, {
            rank: rank,
            subTitle: `TMDB ${match.vote_average?.toFixed(1) || 0.0}`,
            descPrefix: `榜单来源: FlixPatrol #${rank}`
        });
    } catch (e) { return null; }
}

async function fetchTmdbFallback(platform, region, mediaType) {
    const map = { "netflix":"8", "disney":"337", "hbo":"1899", "apple-tv":"350", "amazon-prime":"119" };
    const regMap = { "united-states":"US", "united-kingdom":"GB", "south-korea":"KR", "japan":"JP", "taiwan":"TW", "hong-kong":"HK" };
    
    try {
        const res = await Widget.tmdb.get(`/discover/${mediaType}`, {
            params: {
                watch_region: regMap[region] || "US",
                with_watch_providers: map[platform] || "8",
                sort_by: "popularity.desc",
                page: 1,
                language: "zh-CN"
            }
        });
        return (res.results || []).slice(0, 10).map((item, i) => 
            buildItem(item, mediaType, {
                rank: i+1,
                subTitle: `TMDB ${item.vote_average?.toFixed(1)}`,
                descPrefix: `平台热度 #${i+1}`
            })
        );
    } catch (e) { return []; }
}

// =========================================================================
// 4. 通用 Item 构建器 (统一 UI)
// =========================================================================

function buildItem(item, mediaType, { rank, subTitle, descPrefix } = {}) {
    const year = (item.first_air_date || item.release_date || "").substring(0, 4);
    const genreNames = (item.genre_ids || [])
        .map(id => GENRE_MAP[id])
        .filter(Boolean)
        .slice(0, 2)
        .join(" / ");
    
    const titlePrefix = rank ? `${rank}. ` : "";

    return {
        id: String(item.id),
        tmdbId: item.id,
        type: "tmdb",
        mediaType: mediaType,
        
        title: `${titlePrefix}${item.name || item.title}`,
        genreTitle: [year, genreNames].filter(Boolean).join(" • "),
        subTitle: subTitle,
        description: descPrefix ? `${descPrefix}\n${item.overview}` : item.overview,
        
        posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
        backdropPath: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : "",
        rating: item.vote_average?.toFixed(1),
        year: year
    };
}
