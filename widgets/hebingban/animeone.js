WidgetMetadata = {
    id: "anime_omni_fix",
    title: "二次元全境聚合",
    author: "𝙈𝙖𝙠𝙠𝙖𝙋𝙖𝙠𝙠𝙖",
    description: "一站式聚合多平台动漫榜单。",
    version: "2.2.1",
    requiredVersion: "0.0.1",
    site: "https://bgm.tv",

    modules: [
        // ===========================================
        // 模块 1: Bilibili 热榜 (移植修复版)
        // ===========================================
        {
            title: "Bilibili 热榜",
            functionName: "loadBilibiliRank",
            type: "list",
            cacheDuration: 1800,
            params: [
                {
                    name: "type",
                    title: "榜单分区",
                    type: "enumeration",
                    value: "1",
                    enumOptions: [
                        { title: "📺 B站番剧 (日漫)", value: "1" },
                        { title: "🇨🇳 B站国创 (国漫)", value: "4" }
                    ]
                },
                { name: "page", title: "页码", type: "page" }
            ]
        },

        // ===========================================
        // 模块 2: Bangumi 放送表 (追番日历)
        // ===========================================
        {
            title: "Bangumi 追番日历",
            functionName: "loadBangumiCalendar",
            type: "list",
            cacheDuration: 3600,
            params: [
                {
                    name: "weekday",
                    title: "选择日期",
                    type: "enumeration",
                    value: "today",
                    enumOptions: [
                        { title: "📅 今日更新", value: "today" },
                        { title: "周一 (月)", value: "1" },
                        { title: "周二 (火)", value: "2" },
                        { title: "周三 (水)", value: "3" },
                        { title: "周四 (木)", value: "4" },
                        { title: "周五 (金)", value: "5" },
                        { title: "周六 (土)", value: "6" },
                        { title: "周日 (日)", value: "7" }
                    ]
                },
                { name: "page", title: "页码", type: "page" }
            ]
        },

        // ===========================================
        // 模块 3: TMDB 原生榜单 (备用/发现)
        // ===========================================
        {
            title: "TMDB 热门/新番",
            functionName: "loadTmdbAnimeRanking",
            type: "list",
            cacheDuration: 3600,
            params: [
                {
                    name: "sort",
                    title: "榜单类型",
                    type: "enumeration",
                    value: "trending",
                    enumOptions: [
                        { title: "🔥 实时流行 (Trending)", value: "trending" },
                        { title: "📅 最新首播 (New)", value: "new" },
                        { title: "👑 高分神作 (Top Rated)", value: "top" }
                    ]
                },
                { name: "page", title: "页码", type: "page" }
            ]
        },

        // ===========================================
        // 模块 4: AniList 流行榜 (欧美热度)
        // ===========================================
        {
            title: "AniList 流行榜",
            functionName: "loadAniListRanking",
            type: "list",
            cacheDuration: 7200,
            params: [
                {
                    name: "sort",
                    title: "排序方式",
                    type: "enumeration",
                    value: "TRENDING_DESC",
                    enumOptions: [
                        { title: "📈 近期趋势 (Trending)", value: "TRENDING_DESC" },
                        { title: "💖 历史人气 (Popularity)", value: "POPULARITY_DESC" },
                        { title: "⭐ 评分最高 (Score)", value: "SCORE_DESC" }
                    ]
                },
                { name: "page", title: "页码", type: "page" }
            ]
        },

        // ===========================================
        // 模块 5: MAL 权威榜单 (老牌榜单)
        // ===========================================
        {
            title: "MAL 权威榜单",
            functionName: "loadMalRanking",
            type: "list",
            cacheDuration: 7200,
            params: [
                {
                    name: "filter",
                    title: "榜单类型",
                    type: "enumeration",
                    value: "airing",
                    enumOptions: [
                        { title: "🔥 当前热播 Top", value: "airing" },
                        { title: "🏆 历史总榜 Top", value: "all" },
                        { title: "🎥 最佳剧场版", value: "movie" },
                        { title: "🔜 即将上映", value: "upcoming" }
                    ]
                },
                { name: "page", title: "页码", type: "page" }
            ]
        }
    ]
};

// =========================================================================
// 0. 核心工具
// =========================================================================

const GENRE_MAP = {
    16: "动画", 10759: "动作冒险", 35: "喜剧", 18: "剧情", 14: "奇幻", 
    878: "科幻", 9648: "悬疑", 10749: "爱情", 27: "恐怖", 10765: "科幻奇幻"
};

function getGenreText(ids) {
    if (!ids || !Array.isArray(ids)) return "Anime";
    const genres = ids.filter(id => id !== 16).map(id => GENRE_MAP[id]).filter(Boolean);
    return genres.length > 0 ? genres.slice(0, 2).join(" / ") : "动画";
}

function getWeekdayName(id) {
    const map = { 1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五", 6: "周六", 7: "周日", 0: "周日" };
    return map[id] || "";
}

function buildItem({ id, tmdbId, type, title, year, poster, backdrop, rating, genreText, subTitle, desc }) {
    return {
        id: String(id),
        tmdbId: parseInt(tmdbId), // 确保是整数
        type: "tmdb", // 强制为 tmdb 类型，方便匹配
        mediaType: type || "tv",
        title: title,
        genreTitle: [year, genreText].filter(Boolean).join(" • "),
        subTitle: subTitle,
        posterPath: poster ? `https://image.tmdb.org/t/p/w500${poster}` : "",
        backdropPath: backdrop ? `https://image.tmdb.org/t/p/w780${backdrop}` : "",
        description: desc || "暂无简介",
        rating: rating ? Number(rating).toFixed(1) : "0.0",
        year: year
    };
}

// =========================================================================
// 1. Bilibili 热榜 (严选版)
// =========================================================================

async function loadBilibiliRank(params = {}) {
    const { type = "1", page = 1 } = params;
    // 使用参考代码中验证过的稳定接口
    const url = `https://api.bilibili.com/pgc/web/rank/list?day=3&season_type=${type}`;
    
    try {
        const res = await Widget.http.get(url, {
            headers: { 
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36", 
                "Referer": "https://www.bilibili.com/" 
            }
        });
        
        const data = res.data || {};
        const fullList = data.result?.list || data.data?.list || [];

        // 本地分页
        const pageSize = 20;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        if (start >= fullList.length) return [];
        const slicedList = fullList.slice(start, end);

        const promises = slicedList.map(async (item, index) => {
            const rank = start + index + 1;
            // B站标题清洗：去除 "第二季" 等后缀，以便 TMDB 更好匹配
            const cleanTitle = item.title.replace(/第[一二三四五六七八九十\d]+[季章]/g, "").trim();

            // 搜索 TMDB (强制中文)
            const tmdbItem = await searchTmdbBestMatch(cleanTitle, item.title);

            // ❌ 严酷模式：无 TMDB ID 则丢弃
            if (!tmdbItem) return null;

            return buildItem({
                id: tmdbItem.id,
                tmdbId: tmdbItem.id,
                type: "tv",
                title: tmdbItem.name || tmdbItem.title, // 强制使用 TMDB 的规范中文名
                year: (tmdbItem.first_air_date || "").substring(0, 4),
                poster: tmdbItem.poster_path,
                backdrop: tmdbItem.backdrop_path,
                rating: tmdbItem.vote_average,
                genreText: getGenreText(tmdbItem.genre_ids),
                subTitle: `No.${rank} • ${item.new_ep?.index_show || "热播"}`,
                desc: tmdbItem.overview || item.desc // 优先用 TMDB 简介
            });
        });

        // 过滤掉 null
        const results = await Promise.all(promises);
        return results.filter(Boolean);

    } catch (e) { return [{ id: "err", type: "text", title: "Bilibili 连接失败" }]; }
}

// =========================================================================
// 2. Bangumi 日历 (严选版)
// =========================================================================

async function loadBangumiCalendar(params = {}) {
    const { weekday = "today", page = 1 } = params;
    const pageSize = 20;

    let targetDayId = parseInt(weekday);
    if (weekday === "today") {
        const today = new Date();
        const jsDay = today.getDay();
        targetDayId = jsDay === 0 ? 7 : jsDay;
    }
    const dayName = getWeekdayName(targetDayId);

    try {
        const res = await Widget.http.get("https://api.bgm.tv/calendar");
        const data = res.data || [];
        const dayData = data.find(d => d.weekday && d.weekday.id === targetDayId);
        if (!dayData || !dayData.items) return [];

        const allItems = dayData.items;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        if (start >= allItems.length) return [];
        const pageItems = allItems.slice(start, end);

        const promises = pageItems.map(async (item) => {
            const cnTitle = item.name_cn || item.name;
            const tmdbItem = await searchTmdbBestMatch(cnTitle, item.name);

            // ❌ 严酷模式
            if (!tmdbItem) return null;

            return buildItem({
                id: tmdbItem.id,
                tmdbId: tmdbItem.id,
                type: "tv",
                title: tmdbItem.name || tmdbItem.title,
                year: (tmdbItem.first_air_date || "").substring(0, 4),
                poster: tmdbItem.poster_path,
                backdrop: tmdbItem.backdrop_path,
                rating: item.rating?.score || tmdbItem.vote_average,
                genreText: getGenreText(tmdbItem.genre_ids),
                subTitle: `${dayName} • ${item.air_date || "更新"}`,
                desc: tmdbItem.overview || item.summary
            });
        });

        const results = await Promise.all(promises);
        return results.filter(Boolean);
    } catch (e) { return [{ id: "err", type: "text", title: "Bangumi 连接失败" }]; }
}

// =========================================================================
// 3. TMDB 原生榜单 (100% 匹配)
// =========================================================================

async function loadTmdbAnimeRanking(params = {}) {
    const { sort = "trending", page = 1 } = params;
    
    let queryParams = {
        language: "zh-CN",
        page: page,
        with_genres: "16",
        with_original_language: "ja", 
        include_adult: false
    };
    
    let endpoint = "/discover/tv";

    if (sort === "trending") {
        queryParams.sort_by = "popularity.desc";
        const d = new Date();
        d.setMonth(d.getMonth() - 6);
        queryParams["first_air_date.gte"] = d.toISOString().split('T')[0];
    } else if (sort === "new") {
        queryParams.sort_by = "first_air_date.desc";
        queryParams["vote_count.gte"] = 5;
        const today = new Date().toISOString().split('T')[0];
        queryParams["first_air_date.lte"] = today;
    } else if (sort === "top") {
        queryParams.sort_by = "vote_average.desc";
        queryParams["vote_count.gte"] = 300;
    }

    try {
        const res = await Widget.tmdb.get(endpoint, { params: queryParams });
        const data = res || {};
        if (!data.results) return [];

        return data.results.map(item => {
            return buildItem({
                id: item.id,
                tmdbId: item.id,
                type: "tv",
                title: item.name || item.title,
                year: (item.first_air_date || "").substring(0, 4),
                poster: item.poster_path,
                backdrop: item.backdrop_path,
                rating: item.vote_average,
                genreText: getGenreText(item.genre_ids),
                subTitle: `TMDB Hot ${Math.round(item.popularity)}`,
                desc: item.overview
            });
        });
    } catch (e) { return [{ id: "err", type: "text", title: "TMDB 连接失败" }]; }
}

// =========================================================================
// 4. AniList (严选版)
// =========================================================================

async function loadAniListRanking(params = {}) {
    const { sort = "TRENDING_DESC", page = 1 } = params;
    const perPage = 20;

    const query = `
    query ($page: Int, $perPage: Int) {
      Page (page: $page, perPage: $perPage) {
        media (sort: ${sort}, type: ANIME) {
          title { native romaji english }
          coverImage { large }
          averageScore
          description
          seasonYear
        }
      }
    }
    `;

    try {
        const res = await Widget.http.post("https://graphql.anilist.co", {
            query: query,
            variables: { page, perPage }
        }, { headers: { "Content-Type": "application/json" } });

        const data = res.data?.data?.Page?.media || [];
        if (data.length === 0) return [];

        const promises = data.map(async (media) => {
            const searchQ = media.title.native || media.title.romaji;
            const tmdbItem = await searchTmdbBestMatch(searchQ, media.title.english);

            // ❌ 严酷模式
            if (!tmdbItem) return null;

            return buildItem({
                id: tmdbItem.id,
                tmdbId: tmdbItem.id,
                type: "tv",
                title: tmdbItem.name || tmdbItem.title,
                year: String(media.seasonYear || (tmdbItem.first_air_date || "").substring(0, 4)),
                poster: tmdbItem.poster_path,
                backdrop: tmdbItem.backdrop_path,
                rating: (media.averageScore / 10).toFixed(1),
                genreText: getGenreText(tmdbItem.genre_ids),
                subTitle: `AniList ${(media.averageScore / 10).toFixed(1)}`,
                desc: tmdbItem.overview || media.description
            });
        });

        const results = await Promise.all(promises);
        return results.filter(Boolean);
    } catch (e) { return [{ id: "err", type: "text", title: "AniList 连接失败" }]; }
}

// =========================================================================
// 5. MAL (严选版)
// =========================================================================

async function loadMalRanking(params = {}) {
    const { filter = "airing", page = 1 } = params;
    const baseUrl = "https://api.jikan.moe/v4/top/anime";
    let apiParams = { page: page };
    
    if (filter === "airing") apiParams.filter = "airing";
    else if (filter === "movie") apiParams.type = "movie";
    else if (filter === "upcoming") apiParams.filter = "upcoming";

    try {
        const res = await Widget.http.get(baseUrl, { params: apiParams });
        if (res.statusCode === 429) return [{ id: "err", type: "text", title: "MAL 请求过快" }];
        const data = res.data?.data || [];

        const promises = data.map(async (item) => {
            const searchQ = item.title_japanese || item.title;
            const tmdbItem = await searchTmdbBestMatch(searchQ, item.title_english);

            // ❌ 严酷模式
            if (!tmdbItem) return null;

            return buildItem({
                id: tmdbItem.id,
                tmdbId: tmdbItem.id,
                type: item.type === "Movie" || tmdbItem.media_type === "movie" ? "movie" : "tv",
                title: tmdbItem.name || tmdbItem.title,
                year: String(item.year || (tmdbItem.first_air_date || "").substring(0, 4)),
                poster: tmdbItem.poster_path,
                backdrop: tmdbItem.backdrop_path,
                rating: item.score || 0,
                genreText: getGenreText(tmdbItem.genre_ids),
                subTitle: `MAL ${item.score || "-"}`,
                desc: tmdbItem.overview || item.synopsis
            });
        });

        const results = await Promise.all(promises);
        return results.filter(Boolean);
    } catch (e) { return [{ id: "err", type: "text", title: "MAL 连接失败" }]; }
}

// =========================================================================
// 6. 核心：TMDB 智能匹配
// =========================================================================

async function searchTmdbBestMatch(query1, query2) {
    let res = await searchTmdb(query1);
    if (!res && query2) res = await searchTmdb(query2);
    return res;
}

async function searchTmdb(query) {
    if (!query) return null;
    const cleanQuery = query
        .replace(/第[一二三四五六七八九十\d]+[季章]/g, "")
        .replace(/Season \d+/i, "")
        .replace(/Part \d+/i, "")
        .trim();

    try {
        const res = await Widget.tmdb.get("/search/multi", { 
            params: { 
                query: cleanQuery, 
                language: "zh-CN", // 强制中文
                page: 1 
            } 
        });
        const results = res.results || [];
        const candidates = results.filter(r => r.media_type === "tv" || r.media_type === "movie");
        return candidates.find(r => r.poster_path) || candidates[0];
    } catch (e) { return null; }
}
