const GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录片",
    18: "剧情", 10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐",
    9648: "悬疑", 10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚",
    10752: "战争", 37: "西部", 10759: "动作冒险", 10762: "儿童", 10763: "新闻",
    10764: "真人秀", 10765: "科幻奇幻", 10766: "肥皂剧", 10767: "脱口秀", 10768: "战争政治"
};

WidgetMetadata = {
  id: "imdb_charts_native",
  title: "IMDb 全球热榜",
  version: "1.0.0",
  author: "𝙈𝙖𝙠𝙠𝙖𝙋𝙖𝙠𝙠𝙖",
  description: "获取 IMDb榜单，支持影剧混合、热度、高分排行。",
  icon: "star.circle.fill", // 随便填一个图标
  
  // 移除全局参数，利用内置客户端无需 Key
  globalParams: [],

  modules: [
    {
      type: "list",
      id: "chart_list",
      title: "排行榜",
      functionName: "loadCharts",
      params: [
        { 
          name: "mode", 
          title: "榜单模式", 
          type: "enumeration", 
          value: "trending",
          enumOptions: [
            { title: "🔥 实时热度 (Trending)", value: "trending" },
            { title: "💎 口碑高分 (Top Rated)", value: "top_rated" },
            { title: "🌊 流行趋势 (Popular)", value: "popular" },
            { title: "🇨🇳 国内热度 (模拟)", value: "china_hot" } // 利用筛选功能模拟
          ]
        },
        { 
          name: "mediaType", 
          title: "内容范围", 
          type: "enumeration", 
          value: "all",
          enumOptions: [
            { title: "全部 (剧集+电影)", value: "all" },
            { title: "仅电影", value: "movie" },
            { title: "仅剧集", value: "tv" }
          ]
        },
        { 
          name: "timeWindow", 
          title: "时效 (仅热度榜有效)", 
          type: "enumeration", 
          value: "week",
          belongTo: { paramName: "mode", value: ["trending"] },
          enumOptions: [
            { title: "本周", value: "week" },
            { title: "今日", value: "day" }
          ]
        },
        { name: "page", title: "页码", type: "page" }
      ]
    }
  ]
};

// ==========================================
// 工具函数 (完全复用你给的成功代码)
// ==========================================

function getGenreText(ids) {
    if (!ids || !Array.isArray(ids)) return "";
    return ids.map(id => GENRE_MAP[id]).filter(Boolean).slice(0, 3).join(" / ");
}

function buildItem(data) {
    // 统一处理数据格式
    const isMovie = data.media_type === "movie" || data.title; // 有title通常是电影(tmdb特例除外)，依靠传入的type
    const title = data.title || data.name;
    const date = data.release_date || data.first_air_date || "";
    const year = date.substring(0, 4);
    const genreText = getGenreText(data.genre_ids);
    
    // 评分处理
    const score = data.vote_average ? data.vote_average.toFixed(1) : "0.0";
    
    return {
        id: String(data.id),
        tmdbId: data.id,
        type: "tmdb",
        mediaType: data.media_type || (data.title ? "movie" : "tv"), // 自动回退推断
        title: title,
        // 这里模仿你的 GenreTitle 格式：年份 • 类型
        genreTitle: [year, genreText].filter(Boolean).join(" • "), 
        subTitle: `⭐ ${score} / 热度 ${parseInt(data.popularity)}`,
        posterPath: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : "",
        backdropPath: data.backdrop_path ? `https://image.tmdb.org/t/p/w780${data.backdrop_path}` : "",
        description: data.overview || "暂无简介",
        rating: score,
        year: year
    };
}

// ==========================================
// 核心逻辑
// ==========================================

async function loadCharts(params) {
    const { mode, mediaType, timeWindow } = params;
    const page = params.page || 1;
    
    // 1. 实时热度 (Trending) - 只有这个接口原生支持 /all/
    if (mode === "trending") {
        try {
            const url = `/trending/${mediaType}/${timeWindow || 'week'}`;
            const res = await Widget.tmdb.get(url, { params: { language: "zh-CN", page: page } });
            return (res.results || []).map(item => buildItem(item));
        } catch (e) { return handleError(); }
    }

    // 2. 国内热度 (利用 Discover 模拟云合/热播)
    if (mode === "china_hot") {
        // 如果选了 all，这里默认只展示剧集，因为混合很难筛选准确，或者强制分开写
        const targetType = mediaType === "all" ? "tv" : mediaType; 
        try {
            const res = await Widget.tmdb.get(`/discover/${targetType}`, {
                params: {
                    language: "zh-CN",
                    sort_by: "popularity.desc",
                    page: page,
                    with_original_language: "zh", // 关键：锁定中文原声
                    "vote_count.gte": 5 // 过滤杂鱼
                }
            });
            // 强行注入 media_type，因为 discover 接口不返回这个字段
            return (res.results || []).map(item => buildItem({ ...item, media_type: targetType }));
        } catch(e) { return handleError(); }
    }

    // 3. 流行 (Popular) 和 高分 (Top Rated)
    // 难点：TMDB 没有 /all/popular 接口，必须手动合并
    if (mediaType === "all") {
        return await fetchMixedChart(mode, page);
    } else {
        // 单一类型
        try {
            const url = `/${mediaType}/${mode}`;
            const res = await Widget.tmdb.get(url, { params: { language: "zh-CN", page: page } });
            return (res.results || []).map(item => buildItem({ ...item, media_type: mediaType }));
        } catch (e) { return handleError(); }
    }
}

// 辅助：处理混合榜单 (影+剧)
async function fetchMixedChart(mode, page) {
    try {
        // 并发请求 Movie 和 TV
        const p1 = Widget.tmdb.get(`/movie/${mode}`, { params: { language: "zh-CN", page: page } });
        const p2 = Widget.tmdb.get(`/tv/${mode}`, { params: { language: "zh-CN", page: page } });

        const [resMovie, resTV] = await Promise.all([p1, p2]);
        
        const movies = (resMovie.results || []).map(i => ({...i, media_type: 'movie'}));
        const tvs = (resTV.results || []).map(i => ({...i, media_type: 'tv'}));

        // 合并
        let combined = [...movies, ...tvs];

        // 重新排序
        if (mode === 'top_rated') {
            // 按评分降序
            combined.sort((a, b) => b.vote_average - a.vote_average);
        } else {
            // 按热度降序 (Popular)
            combined.sort((a, b) => b.popularity - a.popularity);
        }

        // 既然是合并，数据量变大了。为了分页逻辑正常，我们还是只取前20个返回
        // (虽然这样会导致第2页的数据和第1页末尾可能有逻辑断层，但这是API限制下的最优解)
        return combined.slice(0, 20).map(item => buildItem(item));

    } catch (e) {
        return handleError();
    }
}

function handleError() {
    return [{ 
        id: "error", 
        type: "text", 
        title: "未能读取数据", 
        description: "可能是网络波动，请下拉刷新重试。" 
    }];
}
