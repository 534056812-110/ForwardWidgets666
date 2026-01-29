WidgetMetadata = {
    id: "bangumi_weekly_calendar",
    title: "动漫周更表 (Bangumi)",
    author: "MakkaPakka",
    description: "基于 Bangumi 数据源的每日放送表，支持 TMDB 高清封面。",
    version: "1.0.0",
    requiredVersion: "0.0.1",
    site: "https://bgm.tv",

    // 0. 全局免 Key
    globalParams: [],

    modules: [
        {
            title: "周更表",
            functionName: "loadBangumiCalendar",
            type: "list",
            cacheDuration: 3600, // 1小时缓存
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
                }
            ]
        }
    ]
};

async function loadBangumiCalendar(params = {}) {
    const { weekday = "today" } = params;

    // 1. 计算目标 Weekday ID
    // Bangumi API: 1=Mon, 2=Tue ... 7=Sun
    let targetDayId = parseInt(weekday);
    if (weekday === "today") {
        const today = new Date();
        const jsDay = today.getDay(); // JS: 0=Sun, 1=Mon...
        targetDayId = jsDay === 0 ? 7 : jsDay;
    }

    console.log(`[Bangumi] Fetching Weekday: ${targetDayId}`);

    try {
        // 2. 请求 Bangumi Calendar API
        const res = await Widget.http.get("https://api.bgm.tv/calendar");
        const data = res.data || [];

        // 3. 查找对应日期的数据
        // data 结构: [{weekday: {id: 1}, items: [...]}, ...]
        const dayData = data.find(d => d.weekday && d.weekday.id === targetDayId);

        if (!dayData || !dayData.items || dayData.items.length === 0) {
            return [{ id: "empty", type: "text", title: "暂无更新", subTitle: "该日没有番剧更新" }];
        }

        // 4. 并发匹配 TMDB (获取高清图)
        const promises = dayData.items.map(async (item) => {
            // Bangumi Item 结构: { id, name (原名), name_cn (中文), images: { large, ... } }
            
            // 构造默认 Item (用 Bangumi 数据兜底)
            const title = item.name_cn || item.name;
            const subTitle = item.name; // 原名
            const cover = item.images ? (item.images.large || item.images.common) : "";
            
            let finalItem = {
                id: `bgm_${item.id}`,
                type: "tmdb", // 伪装成 TMDB 以便 Forward 处理
                mediaType: "tv",
                
                title: title,
                genreTitle: getWeekdayName(targetDayId), // 显示 "周一"
                subTitle: subTitle,
                description: item.summary || "暂无简介",
                
                posterPath: cover, // 默认用 Bangumi 图
                backdropPath: "",
                rating: item.rating && item.rating.score ? item.rating.score.toFixed(1) : "0.0",
                year: ""
            };

            // 尝试 TMDB 匹配
            const tmdbItem = await searchTmdbBestMatch(title, subTitle);
            if (tmdbItem) {
                finalItem.id = String(tmdbItem.id);
                finalItem.tmdbId = tmdbItem.id;
                
                // 替换为高清图
                if (tmdbItem.poster_path) finalItem.posterPath = `https://image.tmdb.org/t/p/w500${tmdbItem.poster_path}`;
                if (tmdbItem.backdrop_path) finalItem.backdropPath = `https://image.tmdb.org/t/p/w780${tmdbItem.backdrop_path}`;
                
                finalItem.rating = tmdbItem.vote_average ? tmdbItem.vote_average.toFixed(1) : finalItem.rating;
                finalItem.year = (tmdbItem.first_air_date || "").substring(0, 4);
                if (tmdbItem.overview) finalItem.description = tmdbItem.overview;
            }

            return finalItem;
        });

        return await Promise.all(promises);

    } catch (e) {
        return [{ id: "err", type: "text", title: "加载失败", subTitle: e.message }];
    }
}

// ==========================================
// 辅助工具
// ==========================================

function getWeekdayName(id) {
    const map = { 1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五", 6: "周六", 7: "周日" };
    return map[id] || "";
}

// 免 Key TMDB 搜索
async function searchTmdbBestMatch(query1, query2) {
    let res = await searchTmdb(query1);
    if (!res && query2) res = await searchTmdb(query2);
    return res;
}

async function searchTmdb(query) {
    if (!query) return null;
    // 简单的清洗：去掉 "第x季"
    const cleanQuery = query.replace(/第[一二三四五六七八九十\d]+[季章]/g, "").trim();
    
    try {
        const res = await Widget.tmdb.get("/search/tv", {
            params: { query: encodeURIComponent(cleanQuery), language: "zh-CN", page: 1 }
        });
        return (res.results || [])[0];
    } catch (e) { return null; }
}
