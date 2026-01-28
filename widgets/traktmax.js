WidgetMetadata = {
    id: "trakt_personal_pro_v2",
    title: "Trakt 个人中心 (追剧版)",
    author: "MakkaPakka",
    description: "管理 Trakt 片单。新增【追剧日历】模式，按更新时间排序。",
    version: "4.0.0",
    requiredVersion: "0.0.1",
    site: "https://trakt.tv",

    globalParams: [
        {
            name: "traktUser",
            title: "Trakt 用户名 (必填)",
            type: "input",
            description: "你的 Trakt ID (Slug)",
            value: ""
        },
        {
            name: "traktClientId",
            title: "Trakt Client ID (必填)",
            type: "input",
            value: ""
        }
    ],

    modules: [
        {
            title: "我的片单",
            functionName: "loadTraktProfile",
            type: "list",
            cacheDuration: 300,
            params: [
                {
                    name: "section",
                    title: "浏览区域",
                    type: "enumeration",
                    value: "watchlist",
                    enumOptions: [
                        { title: "📅 追剧日历 (按更新时间)", value: "updates" }, // 新增
                        { title: "📜 待看列表 (Watchlist)", value: "watchlist" },
                        { title: "📦 收藏列表 (Collection)", value: "collection" },
                        { title: "🕒 观看历史 (History)", value: "history" },
                        { title: "⭐ 评分记录 (Ratings)", value: "ratings" }
                    ]
                },
                // 内容筛选 (追剧日历强制为剧集)
                {
                    name: "type",
                    title: "内容筛选",
                    type: "enumeration",
                    value: "all",
                    belongTo: { paramName: "section", value: ["watchlist", "collection", "history", "ratings"] },
                    enumOptions: [
                        { title: "全部 (剧集+电影)", value: "all" },
                        { title: "剧集", value: "shows" },
                        { title: "电影", value: "movies" }
                    ]
                },
                // 排序选项 (仅对待看有效)
                {
                    name: "sort",
                    title: "排序 (仅待看)",
                    type: "enumeration",
                    value: "added,desc",
                    belongTo: { paramName: "section", value: ["watchlist"] },
                    enumOptions: [
                        { title: "最新添加", value: "added,desc" },
                        { title: "最早添加", value: "added,asc" },
                        { title: "默认排行", value: "rank,asc" }
                    ]
                },
                { name: "page", title: "页码", type: "page" }
            ]
        }
    ]
};

async function loadTraktProfile(params = {}) {
    const { traktUser, traktClientId, section, type = "all", sort = "added,desc", page = 1 } = params;

    if (!traktUser || !traktClientId) return [{ id: "err", type: "text", title: "请填写用户名和Client ID" }];

    // === A. 追剧日历 (Updates) ===
    // 逻辑：获取 Watched Shows -> 获取 TMDB 详情 -> 按 last_air_date 排序
    if (section === "updates") {
        // 1. 获取所有看过的剧 (Trakt Watched 接口不支持分页，但可以获取最近的)
        // 为了性能，我们获取最近看过的 100 部剧，然后在本地筛选
        // 这不是完美的"全量追剧"，但对于 Widget 来说是最合理的
        // 真正的 Sync 需要 OAuth 和复杂的 Sync 接口
        const url = `https://api.trakt.tv/users/${traktUser}/watched/shows?extended=noseasons&limit=100`;
        
        try {
            const res = await Widget.http.get(url, {
                headers: { "Content-Type": "application/json", "trakt-api-version": "2", "trakt-api-key": traktClientId }
            });
            const data = res.data || [];
            
            if (data.length === 0) return [{ id: "empty", type: "text", title: "没有观看记录" }];

            // 2. 并发请求 TMDB 详情 (获取更新时间)
            // 分页逻辑：在本地 slice
            const pageSize = 15;
            const start = (page - 1) * pageSize;
            const end = start + pageSize;
            
            // 我们需要先获取所有剧的更新时间才能排序，这会消耗大量请求
            // 优化策略：先按 Trakt 的 last_watched 排序（默认就是），取前 50 个
            // 然后获取这 50 个的 last_air_date，重新排序
            
            // 为避免请求爆炸，我们只处理前 50 部剧 (假设你不会同时追 50 部剧)
            const recentShows = data.slice(0, 50);
            
            const enrichedShows = await Promise.all(recentShows.map(async (item) => {
                if (!item.show?.ids?.tmdb) return null;
                const tmdb = await fetchTmdbShowDetails(item.show.ids.tmdb);
                if (!tmdb) return null;
                
                // 只有"连载中"或"刚完结"的才有价值
                // status: "Returning Series", "Ended", "Canceled"
                // 过滤掉很久以前完结的？(可选)
                
                return {
                    trakt: item,
                    tmdb: tmdb,
                    // 排序键：优先下集时间，其次上集时间
                    sortDate: tmdb.next_air_date || tmdb.last_air_date || "1970-01-01"
                };
            }));

            // 3. 本地排序：按更新时间倒序
            const sortedShows = enrichedShows.filter(Boolean).sort((a, b) => {
                return new Date(b.sortDate) - new Date(a.sortDate);
            });

            // 4. 分页返回
            if (start >= sortedShows.length) return [];
            const pageItems = sortedShows.slice(start, end);

            return pageItems.map(item => {
                const d = item.tmdb;
                const year = (d.first_air_date || "").substring(0, 4);
                
                // 构造副标题：显示更新信息
                let updateInfo = "";
                if (d.next_episode_to_air) {
                    updateInfo = `🔜 下集: ${d.next_episode_to_air.air_date} (S${d.next_episode_to_air.season_number}E${d.next_episode_to_air.episode_number})`;
                } else if (d.last_episode_to_air) {
                    updateInfo = `📅 最近: ${d.last_episode_to_air.air_date} (S${d.last_episode_to_air.season_number}E${d.last_episode_to_air.episode_number})`;
                } else {
                    updateInfo = "暂无更新信息";
                }

                // 状态标签
                const statusMap = { "Returning Series": "连载中", "Ended": "已完结", "Canceled": "已取消", "Pilot": "试播" };
                const status = statusMap[d.status] || d.status;

                return {
                    id: String(d.id), tmdbId: d.id, type: "tmdb", mediaType: "tv",
                    title: d.name,
                    // GenreTitle 显示：年份 • 状态
                    genreTitle: `${year} • ${status}`,
                    subTitle: updateInfo, // 核心需求：显示更新时间
                    posterPath: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : "",
                    backdropPath: d.backdrop_path ? `https://image.tmdb.org/t/p/w780${d.backdrop_path}` : "",
                    description: d.overview,
                    rating: d.vote_average?.toFixed(1)
                };
            });

        } catch (e) {
            return [{ id: "err", type: "text", title: "加载失败", subTitle: e.message }];
        }
    }

    // === B. 常规列表 (Watchlist/History...) ===
    // (逻辑与之前相同，支持混合模式)
    let rawItems = [];
    if (type === "all") {
        const [movies, shows] = await Promise.all([
            fetchTraktList(section, "movies", sort, page, traktUser, traktClientId),
            fetchTraktList(section, "shows", sort, page, traktUser, traktClientId)
        ]);
        rawItems = [...movies, ...shows];
        rawItems.sort((a, b) => {
            const timeA = new Date(getItemTime(a, section)).getTime();
            const timeB = new Date(getItemTime(b, section)).getTime();
            return sort.includes("asc") ? timeA - timeB : timeB - timeA;
        });
    } else {
        rawItems = await fetchTraktList(section, type, sort, page, traktUser, traktClientId);
    }

    if (!rawItems || rawItems.length === 0) return page === 1 ? [{ id: "empty", type: "text", title: "列表为空" }] : [];

    const promises = rawItems.map(async (item) => {
        const subject = item.show || item.movie || item;
        const mediaType = item.show ? "tv" : "movie";
        if (!subject?.ids?.tmdb) return null;

        let subInfo = "";
        const timeStr = getItemTime(item, section);
        if (timeStr) {
            const date = timeStr.split('T')[0];
            if (section === "watchlist") subInfo = `添加于 ${date}`;
            else if (section === "history") subInfo = `👁️ 观看于 ${date}`; // 观看历史显示观看时间
            else if (section === "ratings") subInfo = `评分 ${item.rating} (${date})`;
            else subInfo = date;
        } else {
            subInfo = `Trakt: ${subject.year || ""}`;
        }

        if (type === "all") subInfo = `[${mediaType === "tv" ? "剧集" : "电影"}] ${subInfo}`;

        return await fetchTmdbDetail(subject.ids.tmdb, mediaType, subInfo, subject.title);
    });

    return (await Promise.all(promises)).filter(Boolean);
}

// ---------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------

// 专门为“追剧日历”设计的 TMDB 详情获取
async function fetchTmdbShowDetails(id) {
    try {
        const res = await Widget.tmdb.get(`/tv/${id}`, { params: { language: "zh-CN" } });
        return res; // 返回完整对象以便提取 next_episode_to_air
    } catch (e) { return null; }
}

async function fetchTraktList(section, type, sort, page, user, id) {
    let url = "";
    const sortMode = sort.split(",")[0]; 
    const limit = 15; 
    if (section === "watchlist") url = `https://api.trakt.tv/users/${user}/watchlist/${type}/${sortMode}?extended=full&page=${page}&limit=${limit}`;
    else if (section === "collection") url = `https://api.trakt.tv/users/${user}/collection/${type}?extended=full&page=${page}&limit=${limit}`;
    else if (section === "history") url = `https://api.trakt.tv/users/${user}/history/${type}?extended=full&page=${page}&limit=${limit}`;
    else if (section === "ratings") url = `https://api.trakt.tv/users/${user}/ratings/${type}?extended=full&page=${page}&limit=${limit}`;

    try {
        const res = await Widget.http.get(url, {
            headers: { "Content-Type": "application/json", "trakt-api-version": "2", "trakt-api-key": id }
        });
        return Array.isArray(res.data) ? res.data : [];
    } catch (e) { return []; }
}

function getItemTime(item, section) {
    if (section === "watchlist") return item.listed_at;
    if (section === "history") return item.watched_at;
    if (section === "collection") return item.collected_at;
    if (section === "ratings") return item.rated_at;
    return null;
}

const GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录片",
    18: "剧情", 10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐",
    9648: "悬疑", 10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚",
    10752: "战争", 37: "西部", 10759: "动作冒险", 10762: "儿童", 10763: "新闻",
    10764: "真人秀", 10765: "科幻奇幻", 10766: "肥皂剧", 10767: "脱口秀", 10768: "战争政治"
};

function getGenreText(ids) {
    if (!ids || !Array.isArray(ids)) return "";
    return ids.map(id => GENRE_MAP[id]).filter(Boolean).slice(0, 3).join(" / ");
}

async function fetchTmdbDetail(id, type, subInfo, originalTitle) {
    try {
        const d = await Widget.tmdb.get(`/${type}/${id}`, { params: { language: "zh-CN" } });
        const year = (d.first_air_date || d.release_date || "").substring(0, 4);
        const genreText = getGenreText(d.genres ? d.genres.map(g=>g.id) : []);
        
        return {
            id: String(d.id), tmdbId: d.id, type: "tmdb", mediaType: type,
            title: d.name || d.title || originalTitle,
            genreTitle: [year, genreText].filter(Boolean).join(" • "),
            subTitle: subInfo,
            posterPath: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : "",
            backdropPath: d.backdrop_path ? `https://image.tmdb.org/t/p/w780${d.backdrop_path}` : "",
            description: d.overview,
            rating: d.vote_average?.toFixed(1),
            year: year
        };
    } catch (e) { return null; }
                  }
