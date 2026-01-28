WidgetMetadata = {
    id: "anime_omni_pro",
    title: "二次元全境聚合 (Pro)",
    author: "MakkaPakka",
    description: "聚合 MyAnimeList(全球)、Bangumi(硬核)、Bilibili(热播)。支持免Key、无限加载。",
    version: "2.0.0",
    requiredVersion: "0.0.1",
    site: "https://myanimelist.net",

    modules: [
        {
            title: "动漫热榜",
            functionName: "loadAnimeHub",
            type: "video",
            cacheDuration: 3600,
            params: [
                {
                    name: "source",
                    title: "选择榜单",
                    type: "enumeration",
                    value: "bili_hot",
                    enumOptions: [
                        { title: "📺 B站 - 番剧热播 (日漫)", value: "bili_hot" },
                        { title: "📺 B站 - 国创热播 (国漫)", value: "bili_cn" },
                        { title: "🌍 MAL - 历史 Top 100", value: "mal_top" },
                        { title: "🌍 MAL - 当前热播 (Airing)", value: "mal_airing" },
                        { title: "🌍 MAL - 即将上映 (Upcoming)", value: "mal_upcoming" },
                        { title: "🌍 MAL - 人气最高 (Popularity)", value: "mal_bypopularity" },
                        { title: "🌸 Bangumi - 每日放送", value: "bgm_calendar" } // Bangumi API 不支持分页，仅展示当天
                    ]
                },
                {
                    name: "page",
                    title: "页码",
                    type: "page"
                }
            ]
        }
    ]
};

async function loadAnimeHub(params = {}) {
    const { source, page = 1 } = params;
    
    // === 1. Bilibili (支持分页) ===
    if (source.startsWith("bili_")) {
        const type = source === "bili_cn" ? 4 : 1; // 4=国创, 1=番剧
        return await fetchBilibiliRank(type, page);
    }

    // === 2. MyAnimeList (支持分页) ===
    if (source.startsWith("mal_")) {
        const type = source.replace("mal_", "");
        return await fetchMalData(type, page);
    }

    // === 3. Bangumi (每日放送无分页概念) ===
    if (source.startsWith("bgm_")) {
        // 仅第一页加载，后面返回空防止重复
        if (page > 1) return [];
        return await fetchBangumiCalendar();
    }
}

// ==========================================
// 逻辑 A: Bilibili (Web API)
// ==========================================

async function fetchBilibiliRank(type, page) {
    // B站 Web 接口并没有很好的分页支持，通常一次返回前 100。
    // 为了模拟分页效果，我们一次拉取数据，然后在本地做切片。
    // 或者使用 Index 索引接口 (api.bilibili.com/pgc/season/index/result) 支持分页
    
    // 这里我们用 Index 接口来实现真正的分页加载
    // season_type: 1=番剧, 4=国创
    // order: 2=播放量, 3=追番数, 5=更新时间
    // 这里用 order=2 (热度)
    const url = `https://api.bilibili.com/pgc/season/index/result?season_type=${type}&order=2&page=${page}&pagesize=20`;

    try {
        const res = await Widget.http.get(url);
        const data = res.data || {};
        const list = data.data?.list || [];

        if (list.length === 0) return [];

        const promises = list.map(async (item) => {
            let finalItem = {
                id: `bili_${item.season_id}`,
                type: "tmdb", 
                mediaType: "tv",
                title: item.title,
                subTitle: item.index_show || `播放: ${item.order}`,
                posterPath: item.cover,
                year: (item.order_type || "").substring(0, 4) // B站有时候在这里放年份
            };

            // 尝试匹配 TMDB (免Key)
            const tmdbItem = await searchTmdbInternal(item.title);
            if (tmdbItem) mergeTmdb(finalItem, tmdbItem);
            
            return finalItem;
        });

        return await Promise.all(promises);

    } catch (e) {
        return [{ id: "err", type: "text", title: "B站加载失败", subTitle: e.message }];
    }
}

// ==========================================
// 逻辑 B: MyAnimeList (Jikan API)
// ==========================================

async function fetchMalData(filterType, page) {
    let url = `https://api.jikan.moe/v4/top/anime?page=${page}`;
    
    if (filterType === "airing") url += "&filter=airing";
    else if (filterType === "upcoming") url += "&filter=upcoming";
    else if (filterType === "bypopularity") url += "&filter=bypopularity";
    
    try {
        const res = await Widget.http.get(url);
        const list = (res.data || {}).data || [];

        if (list.length === 0) return [];

        const promises = list.map(async (item, index) => {
            const rank = (page - 1) * 25 + index + 1;
            const titleEn = item.title_english || item.title;
            const titleJp = item.title_japanese;
            
            let finalItem = {
                id: `mal_${item.mal_id}`,
                type: "tmdb",
                mediaType: "tv",
                title: `${rank}. ${titleEn}`,
                subTitle: `⭐ ${item.score} | ${item.year || ""}`,
                posterPath: item.images?.jpg?.large_image_url,
                description: item.synopsis
            };

            // TMDB 匹配 (优先中文)
            const tmdbItem = await searchTmdbBestMatch(titleEn, titleJp);
            if (tmdbItem) {
                mergeTmdb(finalItem, tmdbItem);
                finalItem.title = `${rank}. ${tmdbItem.name || tmdbItem.title}`; // 替换为中文名
            }
            return finalItem;
        });

        return await Promise.all(promises);

    } catch (e) {
        return [{ id: "err", type: "text", title: "MAL 加载失败" }];
    }
}

// ==========================================
// 逻辑 C: Bangumi (每日放送)
// ==========================================

async function fetchBangumiCalendar() {
    try {
        const res = await Widget.http.get("https://api.bgm.tv/calendar");
        const data = res.data || [];
        const dayIndex = new Date().getDay();
        const bgmDayId = dayIndex === 0 ? 7 : dayIndex;
        const todayData = data.find(d => d.weekday.id === bgmDayId);

        if (!todayData || !todayData.items) return [{ id: "empty", type: "text", title: "今日无放送" }];

        const promises = todayData.items.map(async item => {
            const name = item.name_cn || item.name;
            let finalItem = {
                id: `bgm_${item.id}`, type: "tmdb", mediaType: "tv",
                title: name, subTitle: item.name, posterPath: item.images?.large
            };
            const tmdbItem = await searchTmdbBestMatch(name, item.name);
            if (tmdbItem) mergeTmdb(finalItem, tmdbItem);
            return finalItem;
        });
        return await Promise.all(promises);
    } catch (e) { return []; }
}

// ==========================================
// 核心工具: 免 Key TMDB 搜索
// ==========================================

// 使用 Forward 内置的 Widget.tmdb 接口 (无需 Key)
async function searchTmdbInternal(query) {
    if (!query) return null;
    const cleanQuery = query.replace(/第[一二三四五六七八九十\d]+[季章]/g, "").trim();
    
    try {
        // 直接调用 search/tv，不带 api_key 参数
        const res = await Widget.tmdb.get("/search/tv", {
            params: {
                query: cleanQuery,
                language: "zh-CN",
                page: 1
            }
        });
        return (res.results || [])[0];
    } catch (e) { return null; }
}

async function searchTmdbBestMatch(query1, query2) {
    let res = await searchTmdbInternal(query1);
    if (!res && query2) {
        res = await searchTmdbInternal(query2);
    }
    return res;
}

function mergeTmdb(target, source) {
    target.id = String(source.id);
    target.tmdbId = source.id;
    // 使用 TMDB 的高清图
    if (source.poster_path) target.posterPath = `https://image.tmdb.org/t/p/w500${source.poster_path}`;
    if (source.backdrop_path) target.backdropPath = `https://image.tmdb.org/t/p/w780${source.backdrop_path}`;
    
    target.rating = source.vote_average ? source.vote_average.toFixed(1) : target.rating;
    target.year = (source.first_air_date || "").substring(0, 4);
    if (source.overview) target.description = source.overview;
}
