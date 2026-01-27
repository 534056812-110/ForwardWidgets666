WidgetMetadata = {
    id: "global_hot_hub",
    title: "全球影视热榜聚合",
    author: "MakkaPakka",
    description: "汇聚 Trakt(国际)、豆瓣(国内)、B站&Bangumi(动漫) 三大主流榜单。",
    version: "3.0.0",
    requiredVersion: "0.0.1",
    site: "https://www.themoviedb.org",

    // 1. 全局参数 (所有模块通用)
    globalParams: [
        {
            name: "apiKey",
            title: "TMDB API Key (必填)",
            type: "input",
            description: "用于获取海报和详情。",
            value: ""
        },
        {
            name: "traktClientId",
            title: "Trakt Client ID (选填)",
            type: "input",
            description: "Trakt 模块专用，留空则使用默认 ID。",
            value: ""
        }
    ],

    modules: [
        // ===========================================
        // 模块 1: 国际热榜 (Trakt)
        // ===========================================
        {
            title: "国际热榜 (Trakt)",
            functionName: "loadTraktHot",
            type: "video",
            cacheDuration: 3600,
            params: [
                {
                    name: "listType",
                    title: "榜单类型",
                    type: "enumeration",
                    value: "trending",
                    enumOptions: [
                        { title: "实时热播 (Trending)", value: "trending" },
                        { title: "最受欢迎 (Popular)", value: "popular" },
                        { title: "最受期待 (Anticipated)", value: "anticipated" }
                    ]
                },
                {
                    name: "mediaType",
                    title: "内容类型",
                    type: "enumeration",
                    value: "shows",
                    enumOptions: [
                        { title: "剧集 (TV Shows)", value: "shows" },
                        { title: "电影 (Movies)", value: "movies" }
                    ]
                }
            ]
        },

        // ===========================================
        // 模块 2: 国内热榜 (豆瓣)
        // ===========================================
        {
            title: "国内热榜 (豆瓣)",
            functionName: "loadDoubanHot",
            type: "video",
            cacheDuration: 3600,
            params: [
                {
                    name: "type",
                    title: "热门分类",
                    type: "enumeration",
                    value: "tv_cn",
                    enumOptions: [
                        { title: "热门国产剧", value: "tv_cn" },
                        { title: "热门综艺", value: "tv_variety" },
                        { title: "热门电影", value: "movie" },
                        { title: "热门美剧", value: "tv_us" }
                        // 已移除日韩榜
                    ]
                }
            ]
        },

        // ===========================================
        // 模块 3: 动漫新番 (B站/Bangumi)
        // ===========================================
        {
            title: "动漫新番 (B站/Bgm)",
            functionName: "loadAnimeHot",
            type: "video",
            cacheDuration: 3600,
            params: [
                {
                    name: "source",
                    title: "榜单来源",
                    type: "enumeration",
                    value: "bili_bangumi",
                    enumOptions: [
                        { title: "B站 - 番剧热播 (日漫)", value: "bili_bangumi" },
                        { title: "B站 - 国创热播 (国漫)", value: "bili_guo" },
                        { title: "Bangumi - 每日放送", value: "bgm_daily" }
                    ]
                }
            ]
        }
    ]
};

// =========================================================================
// 核心逻辑 1: Trakt (国际)
// =========================================================================

const DEFAULT_TRAKT_ID = "003666572e92c4331002a28114387693994e43f5454659f81640a232f08a5996";

async function loadTraktHot(params = {}) {
    const { apiKey, listType = "trending", mediaType = "shows" } = params;
    const clientId = params.traktClientId || DEFAULT_TRAKT_ID;

    if (!apiKey) return [{ id: "err", type: "text", title: "请填写 TMDB API Key" }];

    // 1. 尝试直连 Trakt
    let traktData = await fetchTraktData(mediaType, listType, clientId);

    // 2. 降级处理
    if (!traktData || traktData.length === 0) {
        return await fetchTmdbFallback(mediaType, listType, apiKey);
    }

    // 3. 正常处理
    const promises = traktData.slice(0, 15).map(async (item, index) => {
        let subject = item.show || item.movie || item;
        
        let stats = "";
        if (listType === "trending") stats = `🔥 ${item.watchers || 0} 人在看`;
        else if (listType === "anticipated") stats = `❤️ ${item.list_count || 0} 人想看`;
        else stats = `No. ${index + 1}`;

        if (!subject || !subject.ids || !subject.ids.tmdb) return null;
        return await fetchTmdbDetail(subject.ids.tmdb, mediaType, apiKey, stats, subject.title);
    });

    const results = await Promise.all(promises);
    return results.filter(Boolean);
}

// =========================================================================
// 核心逻辑 2: Douban (国内)
// =========================================================================

async function loadDoubanHot(params = {}) {
    const { apiKey, type } = params;
    if (!apiKey) return [{ id: "err", type: "text", title: "请填写 TMDB API Key" }];

    // 豆瓣参数映射
    let tag = "热门";
    let doubanType = "tv"; // tv 或 movie
    
    if (type === "tv_cn") { tag = "国产剧"; doubanType = "tv"; }
    else if (type === "tv_variety") { tag = "综艺"; doubanType = "tv"; }
    else if (type === "tv_us") { tag = "美剧"; doubanType = "tv"; }
    else if (type === "movie") { tag = "热门"; doubanType = "movie"; }

    const url = `https://movie.douban.com/j/search_subjects?type=${doubanType}&tag=${encodeURIComponent(tag)}&sort=recommend&page_limit=20&page_start=0`;

    try {
        const res = await Widget.http.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
                "Referer": "https://movie.douban.com/"
            }
        });

        const list = (res.data || {}).subjects || [];
        if (list.length === 0) return [{ id: "empty", type: "text", title: "豆瓣无返回" }];

        // 并发搜索 TMDB
        const promises = list.map(async (item, index) => {
            const title = item.title;
            const rating = item.rate;
            
            // 默认显示豆瓣数据
            let finalItem = {
                id: `db_${item.id}`,
                type: "tmdb", // 伪装 TMDB
                mediaType: doubanType === "movie" ? "movie" : "tv",
                title: `${index + 1}. ${title}`,
                subTitle: `豆瓣 ${rating}分`,
                posterPath: item.cover, 
                year: ""
            };

            // 尝试 TMDB 匹配高清图
            const tmdbResult = await searchTmdbByQuery(title, doubanType === "movie" ? "movie" : "tv", apiKey);
            if (tmdbResult) {
                finalItem.id = String(tmdbResult.id);
                finalItem.tmdbId = tmdbResult.id;
                finalItem.posterPath = tmdbResult.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbResult.poster_path}` : "";
                finalItem.backdropPath = tmdbResult.backdrop_path ? `https://image.tmdb.org/t/p/w780${tmdbResult.backdrop_path}` : "";
                finalItem.subTitle = `豆瓣 ${rating} | TMDB ${tmdbResult.vote_average}`;
                finalItem.year = (tmdbResult.first_air_date || tmdbResult.release_date || "").substring(0, 4);
                finalItem.description = tmdbResult.overview;
            }
            return finalItem;
        });

        return await Promise.all(promises);
    } catch (e) {
        return [{ id: "err_db", type: "text", title: "豆瓣连接失败", subTitle: e.message }];
    }
}

// =========================================================================
// 核心逻辑 3: Anime (Bilibili/Bangumi)
// =========================================================================

async function loadAnimeHot(params = {}) {
    const { apiKey, source } = params;
    if (!apiKey) return [{ id: "err", type: "text", title: "请填写 TMDB API Key" }];

    // --- Bilibili PGC ---
    if (source.startsWith("bili")) {
        const type = source === "bili_guo" ? 4 : 1; // 1=番剧, 4=国创
        const url = `https://api.bilibili.com/pgc/web/rank/list?day=3&season_type=${type}`;

        try {
            const res = await Widget.http.get(url);
            // 兼容不同层级的返回结构
            const data = res.data || {};
            const list = data.result?.list || data.data?.list || [];

            if (list.length === 0) return [{ id: "empty", type: "text", title: "B站无返回" }];

            const promises = list.slice(0, 15).map(async (item, index) => {
                const title = item.title;
                const stats = item.new_ep?.index_show || "";
                
                let finalItem = {
                    id: `bili_${index}`,
                    type: "tmdb",
                    mediaType: "tv",
                    title: `${index + 1}. ${title}`,
                    subTitle: stats,
                    posterPath: item.cover,
                    description: item.desc || ""
                };

                const tmdbItem = await searchTmdbByQuery(title, "tv", apiKey);
                if (tmdbItem) {
                    finalItem.id = String(tmdbItem.id);
                    finalItem.tmdbId = tmdbItem.id;
                    finalItem.posterPath = tmdbItem.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbItem.poster_path}` : "";
                    finalItem.backdropPath = tmdbItem.backdrop_path ? `https://image.tmdb.org/t/p/w780${tmdbItem.backdrop_path}` : "";
                    finalItem.year = (tmdbItem.first_air_date || "").substring(0, 4);
                }
                return finalItem;
            });
            return await Promise.all(promises);
        } catch (e) { return [{ id: "err_bili", type: "text", title: "B站错误" }]; }
    }

    // --- Bangumi ---
    if (source === "bgm_daily") {
        try {
            const res = await Widget.http.get("https://api.bgm.tv/calendar");
            const data = res.data || [];
            const dayIndex = new Date().getDay();
            const bgmDayId = dayIndex === 0 ? 7 : dayIndex;
            const todayData = data.find(d => d.weekday.id === bgmDayId);

            if (!todayData || !todayData.items) return [{ id: "empty", type: "text", title: "今日无番剧" }];

            const promises = todayData.items.map(async item => {
                const name = item.name_cn || item.name;
                let finalItem = {
                    id: `bgm_${item.id}`,
                    type: "tmdb",
                    mediaType: "tv",
                    title: name,
                    subTitle: item.name,
                    posterPath: item.images?.large || ""
                };
                const tmdbItem = await searchTmdbByQuery(name, "tv", apiKey);
                if (tmdbItem) {
                    finalItem.id = String(tmdbItem.id);
                    finalItem.tmdbId = tmdbItem.id;
                    finalItem.posterPath = tmdbItem.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbItem.poster_path}` : "";
                }
                return finalItem;
            });
            return await Promise.all(promises);
        } catch (e) { return [{ id: "err_bgm", type: "text", title: "Bangumi 错误" }]; }
    }
}

// =========================================================================
// 通用辅助函数 (Helpers)
// =========================================================================

// 1. Trakt 请求
async function fetchTraktData(mediaType, listType, clientId) {
    const url = `https://api.trakt.tv/${mediaType}/${listType}?limit=15`;
    try {
        const res = await Widget.http.get(url, {
            headers: { "Content-Type": "application/json", "trakt-api-version": "2", "trakt-api-key": clientId },
            timeout: 5000
        });
        let data = res.data || [];
        if (typeof data === 'string') { try { data = JSON.parse(data); } catch(e) { return []; } }
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
}

// 2. TMDB 详情 (By ID)
async function fetchTmdbDetail(tmdbId, traktType, apiKey, stats, originalTitle) {
    const tmdbType = traktType === "shows" ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${apiKey}&language=zh-CN`;
    try {
        const res = await Widget.http.get(url);
        const data = res.data || res;
        if (!data || !data.id) return null;
        return {
            id: String(data.id),
            tmdbId: parseInt(data.id),
            type: "tmdb",
            mediaType: tmdbType,
            title: data.name || data.title || originalTitle,
            subTitle: stats,
            description: data.overview || `原名: ${originalTitle}`,
            posterPath: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : "",
            backdropPath: data.backdrop_path ? `https://image.tmdb.org/t/p/w780${data.backdrop_path}` : "",
            rating: data.vote_average ? data.vote_average.toFixed(1) : "0.0",
            year: (data.first_air_date || data.release_date || "").substring(0, 4)
        };
    } catch (e) { return null; }
}

// 3. TMDB 搜索 (By Query) - 豆瓣和B站模块共用
async function searchTmdbByQuery(query, type, apiKey) {
    // 标题清洗
    const cleanQuery = query.replace(/第[一二三四五六七八九十\d]+[季章]/g, "").trim();
    const url = `https://api.themoviedb.org/3/search/${type}?api_key=${apiKey}&query=${encodeURIComponent(cleanQuery)}&language=zh-CN&page=1`;
    try {
        const res = await Widget.http.get(url);
        const results = (res.data || {}).results || [];
        if (results.length > 0) return results[0];
    } catch (e) {}
    return null;
}

// 4. TMDB 降级 (Fallback)
async function fetchTmdbFallback(traktType, listType, apiKey) {
    const tmdbType = traktType === "shows" ? "tv" : "movie";
    let endpoint = "trending";
    let timeWindow = "day";
    if (listType === "popular") { endpoint = "popular"; timeWindow = ""; }
    else if (listType === "anticipated") { endpoint = "upcoming"; if (tmdbType === "tv") endpoint = "on_the_air"; timeWindow = ""; }
    else { endpoint = "trending"; timeWindow = "/week"; }

    let url = "";
    if (endpoint === "trending") url = `https://api.themoviedb.org/3/trending/${tmdbType}${timeWindow}?api_key=${apiKey}&language=zh-CN`;
    else url = `https://api.themoviedb.org/3/${tmdbType}/${endpoint}?api_key=${apiKey}&language=zh-CN&page=1`;

    try {
        const res = await Widget.http.get(url);
        const results = (res.data || {}).results || [];
        return results.slice(0, 15).map((item, index) => ({
            id: String(item.id),
            tmdbId: parseInt(item.id),
            type: "tmdb",
            mediaType: tmdbType,
            title: item.name || item.title,
            subTitle: `TMDB 榜单 #${index + 1}`,
            posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
            year: (item.first_air_date || item.release_date || "").substring(0, 4)
        }));
    } catch(e) { return []; }
}
