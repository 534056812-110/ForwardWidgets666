WidgetMetadata = {
    id: "trakt_personal_full_v5",
    title: "Trakt 个人中心 (全功能)",
    author: "MakkaPakka",
    description: "支持【未来时间轴】、【更新倒序】、【观看倒序】三种追剧模式。",
    version: "5.0.0",
    requiredVersion: "0.0.1",
    site: "https://trakt.tv",

    globalParams: [
        { name: "traktUser", title: "Trakt 用户名 (必填)", type: "input", value: "" },
        { name: "traktClientId", title: "Trakt Client ID (必填)", type: "input", value: "" }
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
                    value: "updates",
                    enumOptions: [
                        { title: "📅 追剧日历", value: "updates" },
                        { title: "📜 待看列表", value: "watchlist" },
                        { title: "📦 收藏列表", value: "collection" },
                        { title: "🕒 观看历史", value: "history" }
                    ]
                },
                {
                    name: "type",
                    title: "内容筛选",
                    type: "enumeration",
                    value: "all",
                    belongTo: { paramName: "section", value: ["watchlist", "collection", "history"] },
                    enumOptions: [ { title: "全部", value: "all" }, { title: "剧集", value: "shows" }, { title: "电影", value: "movies" } ]
                },
                // 追剧日历专用排序 (3个选项)
                {
                    name: "updateSort",
                    title: "追剧模式",
                    type: "enumeration",
                    value: "future_first",
                    belongTo: { paramName: "section", value: ["updates"] },
                    enumOptions: [
                        { title: "🔜 从今天往后", value: "future_first" },
                        { title: "🔄 按更新倒序", value: "air_date_desc" },
                        { title: "👁️ 按观看倒序", value: "watched_at" } // 补回来的
                    ]
                },
                { name: "page", title: "页码", type: "page" }
            ]
        }
    ]
};

async function loadTraktProfile(params = {}) {
    const { traktUser, traktClientId, section, updateSort = "future_first", type = "all", page = 1 } = params;

    if (!traktUser || !traktClientId) return [{ id: "err", type: "text", title: "请填写用户名和Client ID" }];

    // === A. 追剧日历 (Updates) ===
    if (section === "updates") {
        return await loadUpdatesLogic(traktUser, traktClientId, updateSort, page);
    }

    // === B. 常规列表 ===
    let rawItems = [];
    const sortType = "added,desc";
    if (type === "all") {
        const [movies, shows] = await Promise.all([
            fetchTraktList(section, "movies", sortType, page, traktUser, traktClientId),
            fetchTraktList(section, "shows", sortType, page, traktUser, traktClientId)
        ]);
        rawItems = [...movies, ...shows];
    } else {
        rawItems = await fetchTraktList(section, type, sortType, page, traktUser, traktClientId);
    }
    rawItems.sort((a, b) => new Date(getItemTime(b, section)) - new Date(getItemTime(a, section)));
    
    if (!rawItems || rawItems.length === 0) return page === 1 ? [{ id: "empty", type: "text", title: "列表为空" }] : [];

    const promises = rawItems.map(async (item) => {
        const subject = item.show || item.movie || item;
        if (!subject?.ids?.tmdb) return null;
        let subInfo = "";
        const timeStr = getItemTime(item, section);
        if (timeStr) subInfo = timeStr.split('T')[0];
        if (type === "all") subInfo = `[${item.show ? "剧" : "影"}] ${subInfo}`;
        return await fetchTmdbDetail(subject.ids.tmdb, item.show ? "tv" : "movie", subInfo, subject.title);
    });
    return (await Promise.all(promises)).filter(Boolean);
}

// 核心：追剧日历逻辑
async function loadUpdatesLogic(user, id, sort, page) {
    const url = `https://api.trakt.tv/users/${user}/watched/shows?extended=noseasons&limit=100`;
    try {
        const res = await Widget.http.get(url, {
            headers: { "Content-Type": "application/json", "trakt-api-version": "2", "trakt-api-key": id }
        });
        const data = res.data || [];
        if (data.length === 0) return [{ id: "empty", type: "text", title: "无观看记录" }];

        const enrichedShows = await Promise.all(data.slice(0, 60).map(async (item) => {
            if (!item.show?.ids?.tmdb) return null;
            const tmdb = await fetchTmdbShowDetails(item.show.ids.tmdb);
            if (!tmdb) return null;
            
            const nextAir = tmdb.next_episode_to_air?.air_date;
            const lastAir = tmdb.last_episode_to_air?.air_date;
            const sortDate = nextAir || lastAir || "1970-01-01";
            const today = new Date().toISOString().split('T')[0];
            const isFuture = sortDate >= today;

            return {
                trakt: item, tmdb: tmdb,
                sortDate: sortDate,
                isFuture: isFuture,
                watchedDate: item.last_watched_at // 用于 watched_at 排序
            };
        }));

        const valid = enrichedShows.filter(Boolean);
        
        // --- 排序逻辑 ---
        if (sort === "future_first") {
            const futureShows = valid.filter(s => s.isFuture && s.tmdb.next_episode_to_air);
            const pastShows = valid.filter(s => !s.isFuture || !s.tmdb.next_episode_to_air);
            futureShows.sort((a, b) => new Date(a.sortDate) - new Date(b.sortDate)); // 正序
            pastShows.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));   // 倒序
            valid.length = 0; 
            valid.push(...futureShows, ...pastShows);
        } else if (sort === "air_date_desc") {
            // 更新时间倒序
            valid.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));
        } else {
            // 观看时间倒序 (默认 & 补回)
            valid.sort((a, b) => new Date(b.watchedDate) - new Date(a.watchedDate));
        }

        const start = (page - 1) * 15;
        return valid.slice(start, start + 15).map(item => {
            const d = item.tmdb;
            let dateLabel = "暂无排期", epInfo = "已完结";
            
            if (d.next_episode_to_air) {
                dateLabel = `🔜 ${d.next_episode_to_air.air_date}`; 
                epInfo = `S${d.next_episode_to_air.season_number}E${d.next_episode_to_air.episode_number}`;
            } else if (d.last_episode_to_air) {
                dateLabel = `📅 ${d.last_episode_to_air.air_date}`;
                epInfo = `S${d.last_episode_to_air.season_number}E${d.last_episode_to_air.episode_number}`;
            }
            
            // 如果是按观看时间排序，可以在副标题提示观看时间
            if (sort === "watched_at") {
                dateLabel = `👁️ ${item.watchedDate.split('T')[0]}`;
            }
            
            return {
                id: String(d.id), tmdbId: d.id, type: "tmdb", mediaType: "tv",
                title: d.name, genreTitle: dateLabel, subTitle: epInfo,
                posterPath: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : "",
                description: `上次观看: ${item.watchedDate.split("T")[0]}\n${d.overview}`
            };
        });
    } catch (e) { return []; }
}

async function fetchTraktList(section, type, sort, page, user, id) {
    const limit = 20; 
    const url = `https://api.trakt.tv/users/${user}/${section}/${type}?extended=full&page=${page}&limit=${limit}`;
    try {
        const res = await Widget.http.get(url, {
            headers: { "Content-Type": "application/json", "trakt-api-version": "2", "trakt-api-key": id }
        });
        return Array.isArray(res.data) ? res.data : [];
    } catch (e) { return []; }
}

async function fetchTmdbDetail(id, type, subInfo, originalTitle) {
    try {
        const d = await Widget.tmdb.get(`/${type}/${id}`, { params: { language: "zh-CN" } });
        const year = (d.first_air_date || d.release_date || "").substring(0, 4);
        return {
            id: String(d.id), tmdbId: d.id, type: "tmdb", mediaType: type,
            title: d.name || d.title || originalTitle,
            genreTitle: year, subTitle: subInfo, description: d.overview,
            posterPath: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : ""
        };
    } catch (e) { return null; }
}

async function fetchTmdbShowDetails(id) {
    try { return await Widget.tmdb.get(`/tv/${id}`, { params: { language: "zh-CN" } }); } catch (e) { return null; }
}

function getItemTime(item, section) {
    if (section === "watchlist") return item.listed_at;
    if (section === "history") return item.watched_at;
    if (section === "collection") return item.collected_at;
    return item.created_at || "1970-01-01";
}
