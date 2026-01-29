WidgetMetadata = {
    id: "global_tv_calendar_ultimate",
    title: "全球追剧时刻表",
    author: "𝙈𝙖𝙠𝙠𝙖𝙋𝙖𝙠𝙠𝙖",
    description: "聚合全球剧集更新表&综艺排期&bangumi动漫周更表。",
    version: "2.0.8",
    requiredVersion: "0.0.1",
    site: "https://www.themoviedb.org",
    
    // 1. 全局参数
    globalParams: [
        {
            name: "traktClientId",
            title: "Trakt Client ID (选填)",
            type: "input",
            description: "综艺模块专用，不填则使用公共 ID。",
            value: ""
        }
    ],

    modules: [
        // ===========================================
        // 模块 1: 追剧日历 (Drama)
        // ===========================================
        {
            title: "追剧日历 (Drama)",
            functionName: "loadTvCalendar",
            type: "list",
            cacheDuration: 3600,
            params: [
                {
                    name: "mode",
                    title: "时间范围",
                    type: "enumeration",
                    value: "update_today",
                    enumOptions: [
                        { title: "今日更新", value: "update_today" },
                        { title: "明日首播", value: "premiere_tomorrow" },
                        { title: "7天内首播", value: "premiere_week" },
                        { title: "30天内首播", value: "premiere_month" }
                    ]
                },
                {
                    name: "region",
                    title: "地区偏好",
                    type: "enumeration",
                    value: "Global",
                    enumOptions: [
                        { title: "全球聚合", value: "Global" },
                        { title: "美国 (US)", value: "US" },
                        { title: "日本 (JP)", value: "JP" },
                        { title: "韩国 (KR)", value: "KR" },
                        { title: "中国 (CN)", value: "CN" },
                        { title: "英国 (GB)", value: "GB" }
                    ]
                },
                { name: "page", title: "页码", type: "page" }
            ]
        },

        // ===========================================
        // 模块 2: 综艺时刻 (Variety)
        // ===========================================
        {
            title: "综艺时刻 (Variety)",
            functionName: "loadVarietyCalendar",
            type: "list",
            cacheDuration: 3600,
            params: [
                {
                    name: "region",
                    title: "综艺地区",
                    type: "enumeration",
                    value: "cn",
                    enumOptions: [
                        { title: "🇨🇳 国产综艺", value: "cn" },
                        { title: "🇰🇷 韩国综艺", value: "kr" },
                        { title: "🇺🇸 欧美综艺", value: "us" },
                        { title: "🇯🇵 日本综艺", value: "jp" },
                        { title: "🌍 全球热门", value: "global" }
                    ]
                },
                {
                    name: "mode",
                    title: "时间范围",
                    type: "enumeration",
                    value: "today",
                    enumOptions: [
                        { title: "今日更新 (Trakt优先)", value: "today" },
                        { title: "明日预告 (Trakt优先)", value: "tomorrow" },
                        { title: "近期热播 (TMDB源)", value: "trending" }
                    ]
                }
            ]
        },

        // ===========================================
        // 模块 3: 动漫周更 (Anime)
        // ===========================================
        {
            title: "动漫周更 (Anime)",
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
                        { title: "📅 今天", value: "today" },
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
        }
    ]
};

// =========================================================================
// 0. 通用工具与字典
// =========================================================================

const DEFAULT_TRAKT_ID = "003666572e92c4331002a28114387693994e43f5454659f81640a232f08a5996";

const GENRE_MAP = {
    10759: "动作冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录片",
    18: "剧情", 10751: "家庭", 10762: "儿童", 9648: "悬疑", 10763: "新闻",
    10764: "真人秀", 10765: "科幻奇幻", 10766: "肥皂剧", 10767: "脱口秀",
    10768: "战争政治", 37: "西部"
};

function getGenreText(ids) {
    if (!ids || !Array.isArray(ids)) return "";
    return ids.map(id => GENRE_MAP[id]).filter(Boolean).slice(0, 2).join(" / ");
}

function buildItem({ id, tmdbId, type, title, year, poster, backdrop, rating, genreText, subTitle, desc }) {
    // 智能海报拼接：如果是 http 开头，说明已经是完整链接（来自 Bangumi）；否则拼 TMDB
    const fullPoster = poster && poster.startsWith("http") ? poster : (poster ? `https://image.tmdb.org/t/p/w500${poster}` : "");
    const fullBackdrop = backdrop && backdrop.startsWith("http") ? backdrop : (backdrop ? `https://image.tmdb.org/t/p/w780${backdrop}` : "");

    return {
        id: String(id), // 关键：如果是 TMDB ID，这里就是纯数字字符串
        tmdbId: parseInt(tmdbId), // 关键：Emby 匹配依赖这个 Int
        type: "tmdb",
        mediaType: type,
        title: title,
        genreTitle: [year, genreText].filter(Boolean).join(" • "), 
        subTitle: subTitle,
        posterPath: fullPoster,
        backdropPath: fullBackdrop,
        description: desc || "暂无简介",
        rating: rating,
        year: year
    };
}

// =========================================================================
// 1. 业务逻辑：动漫周更 (Anime) - 核心修复
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

        if (!dayData || !dayData.items || dayData.items.length === 0) {
            return page === 1 ? [{ id: "empty", type: "text", title: "暂无更新" }] : [];
        }

        // 本地分页
        const allItems = dayData.items;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        if (start >= allItems.length) return [];
        const pageItems = allItems.slice(start, end);

        const promises = pageItems.map(async (item) => {
            const title = item.name_cn || item.name;
            const subTitle = item.name;
            const cover = item.images ? (item.images.large || item.images.common) : "";
            
            // 初始数据对象
            let itemData = {
                id: `bgm_${item.id}`, // 默认 Bangumi ID
                tmdbId: 0,
                type: "tv",
                title: title,
                year: "",
                poster: cover, // 原始 Bangumi 图片 URL (http...)
                backdrop: "",
                rating: item.rating?.score?.toFixed(1) || "0.0",
                genreText: "动画",
                subTitle: subTitle,
                desc: item.summary
            };

            // TMDB 匹配
            const tmdbItem = await searchTmdbBestMatch(title, subTitle);
            if (tmdbItem) {
                // 关键修复：完全覆盖 ID 和海报
                itemData.id = String(tmdbItem.id); // 覆盖为 TMDB ID
                itemData.tmdbId = tmdbItem.id;
                
                // TMDB 返回的 poster_path 是相对路径 (/xxx.jpg)，不是 http
                itemData.poster = tmdbItem.poster_path; 
                itemData.backdrop = tmdbItem.backdrop_path;
                
                itemData.year = (tmdbItem.first_air_date || "").substring(0, 4);
                itemData.genreText = getGenreText(tmdbItem.genre_ids);
                itemData.desc = tmdbItem.overview || itemData.desc;
                itemData.rating = tmdbItem.vote_average?.toFixed(1) || itemData.rating;
            }
            
            // 手动添加周几前缀
            const finalGenreTitle = `${dayName} • ${itemData.genreText || "动画"}`;
            
            // 构建最终 Item
            // 注意：因为上面已经处理了 poster 是 full url 还是 path，buildItem 会自动识别
            return buildItem({
                ...itemData,
                genreText: finalGenreTitle.split(" • ")[1] // 重新拆分传参，或者直接改 buildItem 逻辑
            });
            
            // 修正：直接手动构造最终对象，避免 buildItem 再次拼接 genreTitle 导致重复
            // 还是用 buildItem 比较规范，稍微调整下参数
            return buildItem({
                id: itemData.id,
                tmdbId: itemData.tmdbId,
                type: "tv",
                title: itemData.title,
                year: itemData.year,
                poster: itemData.poster,
                backdrop: itemData.backdrop,
                rating: itemData.rating,
                // 这里我们要强制显示 "周一 • 动画"
                // 现在的 buildItem 是 [year, genre].join
                // 我们把 year 传为 "周一"，genre 传为 "动画"
                // 这样拼出来就是 "周一 • 动画"
                // 原来的 year 字段只用于显示，这里我们为了 UI 效果 hack 一下
                // 不对，Forward 可能用 year 字段做排序或过滤。
                // 最佳方案：修改 buildItem 的 genreTitle 逻辑，或者传入构建好的 genreTitle
                
                // 最终方案：直接在下面覆盖 genreTitle
                genreText: itemData.genreText,
                subTitle: itemData.subTitle,
                desc: itemData.desc
            });
        });

        // 再次修正：我在 buildItem 里已经写好了 genreTitle 的拼接逻辑
        // 所以我们可以在 map 完拿到 result 后，手动修改 genreTitle
        const results = await Promise.all(promises);
        
        return results.map(r => {
            // 强制加上周几
            r.genreTitle = `${dayName} • ${r.genreTitle.split(" • ").pop()}`; // 替换掉年份，或者加在前面
            // 或者：保留年份 "周一 • 2024 • 动画"
            // r.genreTitle = `${dayName} • ${r.genreTitle}`;
            return r;
        });

    } catch (e) {
        return [{ id: "err", type: "text", title: "加载失败", subTitle: e.message }];
    }
}

// =========================================================================
// 2. 业务逻辑：追剧日历 & 综艺时刻 (保持原样)
// =========================================================================

// ... loadTvCalendar 和 loadVarietyCalendar 的代码与之前完全一致 ...
// 为节省篇幅，请直接复用上一版这两个函数的代码块
// 它们已经非常完美，不需要修改。

async function loadTvCalendar(params = {}) {
    const { mode = "update_today", region = "Global", page = 1 } = params;
    const dates = calculateDates(mode);
    const isPremiere = mode.includes("premiere");
    
    const queryParams = {
        language: "zh-CN",
        sort_by: "popularity.desc",
        include_null_first_air_dates: false,
        page: page,
        timezone: "Asia/Shanghai"
    };

    const dateField = isPremiere ? "first_air_date" : "air_date";
    queryParams[`${dateField}.gte`] = dates.start;
    queryParams[`${dateField}.lte`] = dates.end;

    if (region !== "Global") {
        queryParams.with_origin_country = region;
        const langMap = { "JP": "ja", "KR": "ko", "CN": "zh", "GB": "en", "US": "en" };
        if (langMap[region]) queryParams.with_original_language = langMap[region];
    }

    try {
        const res = await Widget.tmdb.get("/discover/tv", { params: queryParams });
        const data = res || {};

        if (!data.results || data.results.length === 0) return page === 1 ? [{ id: "empty", type: "text", title: "暂无更新" }] : [];

        return data.results.map(item => {
            const dateStr = item[dateField] || "";
            const shortDate = dateStr.slice(5); 
            const year = (item.first_air_date || "").substring(0, 4);
            const genreText = getGenreText(item.genre_ids);
            
            let subInfo = [];
            if (mode !== "update_today" && shortDate) subInfo.push(`📅 ${shortDate}`);
            else if (mode === "update_today") subInfo.push("🆕 今日");
            if (item.original_name && item.original_name !== item.name) subInfo.push(item.original_name);

            return buildItem({
                id: item.id, tmdbId: item.id, type: "tv",
                title: item.name,
                year: year, poster: item.poster_path, backdrop: item.backdrop_path,
                rating: item.vote_average?.toFixed(1),
                genreText: genreText,
                subTitle: subInfo.join(" | "),
                desc: item.overview
            });
        });
    } catch (e) { return [{ id: "err", type: "text", title: "网络错误" }]; }
}

async function loadVarietyCalendar(params = {}) {
    const { region = "cn", mode = "today", traktClientId } = params;
    const clientId = traktClientId || DEFAULT_TRAKT_ID;

    if (mode === "trending") return await fetchTmdbVariety(region, null); 

    const dateStr = getSafeDate(mode); 
    const countryParam = region === "global" ? "" : region; 
    const traktUrl = `https://api.trakt.tv/calendars/all/shows/${dateStr}/1?genres=reality,game-show,talk-show${countryParam ? `&countries=${countryParam}` : ''}`;

    try {
        const res = await Widget.http.get(traktUrl, {
            headers: { "Content-Type": "application/json", "trakt-api-version": "2", "trakt-api-key": clientId }
        });
        const data = res.data || [];

        if (Array.isArray(data) && data.length > 0) {
            const promises = data.map(async (item) => {
                if (!item.show.ids.tmdb) return null;
                return await fetchTmdbDetail(item.show.ids.tmdb, item);
            });
            return (await Promise.all(promises)).filter(Boolean);
        }
    } catch (e) {}

    return await fetchTmdbVariety(region, dateStr);
}

// =========================================================================
// 3. 辅助函数
// =========================================================================

function calculateDates(mode) {
    const today = new Date();
    const toStr = (d) => d.toISOString().split('T')[0];
    if (mode === "update_today") return { start: toStr(today), end: toStr(today) };
    if (mode === "premiere_tomorrow") {
        const tmr = new Date(today); tmr.setDate(today.getDate() + 1); return { start: toStr(tmr), end: toStr(tmr) };
    }
    if (mode === "premiere_week") {
        const start = new Date(today); start.setDate(today.getDate() + 1);
        const end = new Date(today); end.setDate(today.getDate() + 7);
        return { start: toStr(start), end: toStr(end) };
    }
    if (mode === "premiere_month") {
        const start = new Date(today); start.setDate(today.getDate() + 1);
        const end = new Date(today); end.setDate(today.getDate() + 30);
        return { start: toStr(start), end: toStr(end) };
    }
    return { start: toStr(today), end: toStr(today) };
}

function getSafeDate(mode) {
    const d = new Date();
    if (mode === "tomorrow") d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

function getWeekdayName(id) {
    const map = { 1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五", 6: "周六", 7: "周日" };
    return map[id] || "";
}

async function fetchTmdbVariety(region, dateStr) {
    const queryParams = {
        language: "zh-CN",
        sort_by: "popularity.desc", 
        page: 1,
        with_genres: "10764|10767", 
        include_null_first_air_dates: false,
        timezone: "Asia/Shanghai" 
    };
    if (region !== "global") queryParams.with_origin_country = region.toUpperCase();
    if (dateStr) {
        queryParams["air_date.gte"] = dateStr;
        queryParams["air_date.lte"] = dateStr;
    } else {
        queryParams.sort_by = "first_air_date.desc";
    }

    try {
        const res = await Widget.tmdb.get("/discover/tv", { params: queryParams });
        const data = res || {};
        if (!data.results) return [{ id: "empty", type: "text", title: "暂无更新" }];

        return data.results.map(item => {
            const year = (item.first_air_date || "").substring(0, 4);
            const genreText = getGenreText(item.genre_ids);
            let dateLabel = "近期热播";
            if (dateStr) dateLabel = `📅 更新: ${dateStr}`;
            return buildItem({
                id: item.id, tmdbId: item.id, type: "tv",
                title: item.name, year: year, poster: item.poster_path, backdrop: item.backdrop_path,
                rating: item.vote_average?.toFixed(1), genreText: genreText,
                subTitle: dateLabel, desc: item.overview
            });
        });
    } catch (e) { return [{ id: "err", type: "text", title: "TMDB 错误" }]; }
}

async function fetchTmdbDetail(tmdbId, traktItem) {
    try {
        const d = await Widget.tmdb.get(`/tv/${tmdbId}`, { params: { language: "zh-CN" } });
        if (!d) return null;
        const ep = traktItem.episode;
        const genreText = getGenreText(d.genres ? d.genres.map(g=>g.id) : []);
        return buildItem({
            id: d.id, tmdbId: d.id, type: "tv",
            title: d.name || traktItem.show.title,
            year: (d.first_air_date || "").substring(0, 4),
            poster: d.poster_path, backdrop: d.backdrop_path,
            rating: d.vote_average?.toFixed(1), genreText: genreText,
            subTitle: `S${ep.season}E${ep.number} · ${ep.title || "更新"}`,
            desc: d.overview
        });
    } catch (e) { return null; }
}

async function searchTmdbBestMatch(query1, query2) {
    let res = await searchTmdb(query1);
    if (!res && query2) res = await searchTmdb(query2);
    return res;
}

async function searchTmdb(query) {
    if (!query) return null;
    const cleanQuery = query.replace(/第[一二三四五六七八九十\d]+[季章]/g, "").trim();
    try {
        const res = await Widget.tmdb.get("/search/tv", { params: { query: cleanQuery, language: "zh-CN", page: 1 } });
        return (res.results || [])[0];
    } catch (e) { return null; }
}
