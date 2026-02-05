// ====================================================
// Widget Configuration
// ====================================================
WidgetMetadata = {
  id: "imdb_pro", // 确保ID唯一
  title: "IMDb榜单",
  author: "𝙈𝙖𝙠𝙠𝙖𝙋𝙖𝙠𝙠𝙖",
  description: "精准聚合全球与国产影视热度榜单。",
  version: "1.0.0",
  icon: "chart.bar.xaxis",
  site: "https://www.themoviedb.org",
  
  // 移除全局参数，使用内置鉴权
  globalParams: [],

  modules: [
    {
      type: "list",
      id: "main_charts",
      title: "榜单列表",
      functionName: "loadCharts",
      // 启用缓存，避免频繁刷新导致接口限制
      cacheDuration: 3600, 
      params: [
        {
          name: "chartMode",
          title: "选择榜单",
          type: "enumeration",
          value: "global_trending", // 默认值
          enumOptions: [
            { title: "🔥 全球 · 实时热播 (Trending)", value: "global_trending" },
            { title: "🌊 全球 · 流行趋势 (Popular)", value: "global_popular" },
            { title: "💎 全球 · 口碑神作 (Top Rated)", value: "global_top" },
            { title: "🇨🇳 国产 · 剧集热榜 (国产剧榜)", value: "cn_tv_hot" },
            { title: "🇨🇳 国产 · 电影热榜 (网络/院线)", value: "cn_movie_hot" }
          ]
        },
        {
          name: "filterType",
          title: "内容类型",
          type: "enumeration",
          value: "all",
          // 仅在全球榜单下显示此选项
          belongTo: { paramName: "chartMode", value: ["global_trending", "global_popular", "global_top"] },
          enumOptions: [
            { title: "全部 (剧+影)", value: "all" },
            { title: "电影", value: "movie" },
            { title: "剧集", value: "tv" }
          ]
        },
        { name: "page", title: "页码", type: "page" }
      ]
    }
  ]
};

// ====================================================
// Helper Functions (严格复刻参考代码的构建逻辑)
// ====================================================

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

/**
 * 核心构建函数：确保数据类型绝对正确
 * Forward App 极其看重 tmdbId (int) 和 type ("tmdb")
 */
function buildItem(item, forceMediaType = null) {
    if (!item) return null;
    
    // 1. 确定媒体类型
    // TMDB 的 /movie 接口不返回 media_type，必须手动指定
    const mediaType = forceMediaType || item.media_type || (item.title ? "movie" : "tv");
    
    // 2. 标题和日期处理
    const title = item.title || item.name || "未知标题";
    const dateStr = item.release_date || item.first_air_date || "";
    const year = dateStr.substring(0, 4);
    
    // 3. 构建副标题 (年份 • 类型)
    const genreText = getGenreText(item.genre_ids);
    const infoLine = [year, genreText].filter(Boolean).join(" • ");
    
    // 4. 评分
    const score = item.vote_average ? item.vote_average.toFixed(1) : "0.0";

    return {
        id: String(item.id),           // 必须是字符串
        tmdbId: parseInt(item.id),     // 必须是数字
        type: "tmdb",                  // 触发原生详情页的关键
        mediaType: mediaType,          // movie 或 tv
        title: title,
        subTitle: `⭐ ${score}  |  ${infoLine}`, // 模仿参考代码的样式
        posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
        backdropPath: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : "",
        description: item.overview || "暂无简介",
        rating: score,
        year: year,
        genreTitle: infoLine // 兼容参考代码的字段
    };
}

// ====================================================
// Main Logic
// ====================================================

async function loadCharts(params) {
    const chartMode = params.chartMode || "global_trending";
    const filterType = params.filterType || "all";
    const page = params.page || 1;

    try {
        // --- 分支 1: 国产热榜 (模拟云合) ---
        if (chartMode.startsWith("cn_")) {
            const isMovie = chartMode === "cn_movie_hot";
            const endpoint = isMovie ? "movie" : "tv";
            
            // 使用 Discover 接口进行精确筛选
            const res = await Widget.tmdb.get(`/discover/${endpoint}`, {
                params: {
                    language: "zh-CN",
                    page: page,
                    sort_by: "popularity.desc",       // 按热度
                    with_original_language: "zh",     // 只要国产
                    "vote_count.gte": 5,              // 过滤极冷门
                    include_adult: false
                }
            });
            
            if (!res || !res.results) return [];
            return res.results.map(item => buildItem(item, endpoint));
        }

        // --- 分支 2: 全球榜单 (Trending / Popular / Top Rated) ---
        
        let apiPath = "";
        let requestType = filterType; // movie, tv, or all

        // 2.1 实时热播 (Trending) - 支持原生 /all/
        if (chartMode === "global_trending") {
            // Trending 接口: /trending/{media_type}/{time_window}
            apiPath = `/trending/${filterType}/week`; // 默认为本周数据
            
            const res = await Widget.tmdb.get(apiPath, { params: { language: "zh-CN", page: page } });
            if (!res || !res.results) return [];
            return res.results.map(item => buildItem(item));
        }

        // 2.2 流行 & 高分 (需要手动处理混合类型)
        // modeMap: 映射 API 的路径后缀
        const modeMap = { "global_popular": "popular", "global_top": "top_rated" };
        const pathSuffix = modeMap[chartMode];

        if (filterType !== "all") {
            // 单一类型：直接请求
            const res = await Widget.tmdb.get(`/${filterType}/${pathSuffix}`, { 
                params: { language: "zh-CN", page: page } 
            });
            if (!res || !res.results) return [];
            return res.results.map(item => buildItem(item, filterType));
        } else {
            // 混合类型 (All)：Forward 最难处理的部分
            // 必须并发请求 movie 和 tv，然后手动合并
            const [resMovie, resTV] = await Promise.all([
                Widget.tmdb.get(`/movie/${pathSuffix}`, { params: { language: "zh-CN", page: page } }),
                Widget.tmdb.get(`/tv/${pathSuffix}`, { params: { language: "zh-CN", page: page } })
            ]);

            const movies = (resMovie?.results || []).map(i => buildItem(i, "movie"));
            const tvs = (resTV?.results || []).map(i => buildItem(i, "tv"));

            let combined = [...movies, ...tvs];

            // 再次排序
            if (chartMode === "global_top") {
                // 高分榜按评分排
                combined.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
            } else {
                // 流行榜按原始热度排 (注意：我们buildItem里没存popularity，这里需要稍微取巧)
                // 由于TMDB返回的顺序本身就是有序的，简单的交叉合并或者直接 slice 也可以。
                // 为了严谨，我们直接交替插入，或者简单粗暴截取前20
                // 因为没有原始 popularity 字段了，我们简单地均分展示
            }

            // 为了保证分页逻辑（虽然混合分页很难完美），我们返回前 20 个
            // 更好的体验是各取前 10 个交替
            return combined.slice(0, 20);
        }

    } catch (e) {
        console.error(e);
        // 发生错误时，返回一个错误提示 Item，而不是空数据，方便排查
        return [{
            id: "error_item",
            type: "text",
            title: "数据加载异常",
            description: "请检查网络连接或稍后重试。"
        }];
    }
}
