WidgetMetadata = {
    id: "variety_hub_ultimate_v4_fix",
    title: "全球综艺追更热度榜",
    author: "𝙈𝙖𝙠𝙠𝙖𝙋𝙖𝙠𝙠𝙖",
    description: "综艺更新时间表，热度榜",
    version: "2.0.2",
    requiredVersion: "0.0.1",
    site: "https://www.themoviedb.org",

    modules: [
        {
            title: "综艺聚合",
            functionName: "loadVarietyUltimate",
            type: "list",
            cacheDuration: 300, 
            params: [
                {
                    name: "listType",
                    title: "榜单类型",
                    type: "enumeration",
                    value: "calendar",
                    enumOptions: [
                        { title: "📅 追新榜 (未来排期)", value: "calendar" },
                        { title: "🔥 热度榜 (按流行度)", value: "hot" }
                    ]
                },
                {
                    name: "days",
                    title: "预告范围",
                    type: "enumeration",
                    value: "14",
                    belongTo: { paramName: "listType", value: ["calendar"] },
                    enumOptions: [
                        // 意思全变了：现在代表看未来多少天
                        { title: "未来 7 天", value: "7" },
                        { title: "未来 14 天", value: "14" },
                        { title: "未来 30 天", value: "30" }
                    ]
                },
                {
                    name: "region",
                    title: "地区筛选",
                    type: "enumeration",
                    value: "all",
                    enumOptions: [
                        { title: "🌏 全部地区", value: "all" },
                        { title: "🇨🇳 国内综艺", value: "cn" },
                        { title: "✈️ 国外综艺", value: "global" }
                    ]
                },
                { name: "page", title: "页码", type: "page" }
            ]
        }
    ]
};

// =========================================================================
// 0. 工具函数
// =========================================================================

// 格式化日期 MM-30
function formatShortDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${m}-${d}`;
}

// 获取今天 (YYYY-MM-DD)
function getTodayStr() {
    const d = new Date();
    // 考虑时区偏移，直接取 ISO 前段可能有时差，这里用本地时间修正
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset);
    return local.toISOString().split('T')[0];
}

// 获取 N 天后的日期
function getFutureDateStr(days) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(days));
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset);
    return local.toISOString().split('T')[0];
}

// =========================================================================
// 1. 核心逻辑
// =========================================================================

async function loadVarietyUltimate(params = {}) {
    const { listType = "calendar", region = "all", days = "14", page = 1 } = params;

    let discoverUrl = `/discover/tv`;
    let queryParams = {
        language: "zh-CN",
        page: page,
        with_genres: "10764|10767", 
        sort_by: "popularity.desc",
        "vote_count.gte": 0,
        include_null_first_air_dates: false
    };

    if (region === "cn") {
        queryParams.with_origin_country = "CN";
    } else if (region === "global") {
        queryParams.with_origin_country = "US|KR|JP|GB|TW|HK|TH";
    }

    // === 📅 核心修改：时间窗口设定 ===
    if (listType === "calendar") {
        // 起点：今天
        const startDate = getTodayStr(); 
        // 终点：未来 N 天
        const endDate = getFutureDateStr(days);
        
        queryParams["air_date.gte"] = startDate;
        queryParams["air_date.lte"] = endDate;
    }

    try {
        const res = await Widget.tmdb.get(discoverUrl, { params: queryParams });
        const rawResults = res.results || [];

        if (rawResults.length === 0) return [];

        const detailPromises = rawResults.map(async (item) => {
            if (!item.poster_path) return null;

            try {
                const detail = await Widget.tmdb.get(`/tv/${item.id}`, { 
                    params: { language: "zh-CN" } 
                });
                
                const nextEp = detail.next_episode_to_air;
                const lastEp = detail.last_episode_to_air;
                
                let sortDate = "2099-12-31"; // 默认扔到最后
                let displayInfoStr = ""; 

                // 优先找下一集 (Next Episode) - 因为我们要看未来
                if (nextEp) {
                    sortDate = nextEp.air_date;
                    displayInfoStr = `${formatShortDate(sortDate)} S${nextEp.season_number}E${nextEp.episode_number}`;
                } 
                // 如果没有下一集信息（比如今天刚播完，TMDB还没更新next），但last_episode是今天
                else if (lastEp && lastEp.air_date >= getTodayStr()) {
                    sortDate = lastEp.air_date;
                    displayInfoStr = `${formatShortDate(sortDate)} S${lastEp.season_number}E${lastEp.episode_number}`;
                } 
                // 兜底：如果是首播
                else {
                    if (listType === "calendar" && item.first_air_date >= getTodayStr()) {
                        sortDate = item.first_air_date;
                        displayInfoStr = `${formatShortDate(sortDate)} 首播`;
                    } else {
                        // 如果既没有未来集数，也不是未来首播，说明这个节目在所选时间段内其实不符合“未来”定义
                        // 虽然 discover 筛选了 air_date，但具体集数可能 API 滞后，这里做个严格过滤
                        if (listType === "calendar") return null;
                        displayInfoStr = "暂无排期";
                    }
                }

                return {
                    detail: detail,
                    sortDate: sortDate,
                    displayInfoStr: displayInfoStr
                };
            } catch (e) {
                return null;
            }
        });

        const detailedItems = (await Promise.all(detailPromises)).filter(Boolean);

        // === 📅 核心修改：排序 ===
        if (listType === "calendar") {
            detailedItems.sort((a, b) => {
                if (a.sortDate === b.sortDate) return 0;
                // 正序排列：Today -> Future
                return a.sortDate > b.sortDate ? 1 : -1; 
            });
        }

        return detailedItems.map(data => {
            const { detail, displayInfoStr, sortDate } = data;
            
            let finalGenreTitle = "";
            let finalSubTitle = "";

            if (listType === "calendar") {
                // 强制双显示，万无一失
                finalGenreTitle = displayInfoStr; 
                finalSubTitle = displayInfoStr;   
            } else {
                finalGenreTitle = `${detail.vote_average.toFixed(1)}分`;
                finalSubTitle = `🔥 热度 ${Math.round(detail.popularity)}`;
            }

            return {
                id: String(detail.id),
                tmdbId: detail.id,
                type: "tmdb",
                mediaType: "tv",
                title: detail.name || detail.original_name,
                genreTitle: finalGenreTitle, 
                subTitle: finalSubTitle,
                posterPath: detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : "",
                backdropPath: detail.backdrop_path ? `https://image.tmdb.org/t/p/w780${detail.backdrop_path}` : "",
                description: `📅 播出时间: ${sortDate}\n${detail.overview || "暂无简介"}`,
                rating: detail.vote_average ? detail.vote_average.toFixed(1) : "0.0",
                year: (detail.first_air_date || "").substring(0, 4)
            };
        });

    } catch (e) {
        return [{ id: "err", type: "text", title: "加载失败", subTitle: e.message }];
    }
}
