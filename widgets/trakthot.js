WidgetMetadata = {
  id: "gemini.trakt.trending.debug",
  title: "Trakt 热榜 (网络增强版)",
  author: "Gemini",
  description: "支持备用通道，修复网络错误提示",
  version: "1.1.0",
  requiredVersion: "0.0.1",
  modules: [
    {
      title: "Trakt 热榜",
      functionName: "loadTraktTrending",
      type: "list",
      requiresWebView: false,
      params: [
        {
          name: "apiKey",
          title: "TMDB API Key (必填)",
          type: "input",
          description: "必须填写",
        },
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
            { title: "剧集", value: "shows" },
            { title: "电影", value: "movies" }
          ]
        }
      ]
    }
  ]
};

async function loadTraktTrending(params = {}) {
  const apiKey = params.apiKey;
  const listType = params.listType || "trending";
  const mediaType = params.mediaType || "shows";
  // 使用最新的官方 Demo ID，成功率更高
  const clientId = "003666572e92c4331002a28114387693994e43f5454659f81640a232f08a5996";

  if (!apiKey) {
    return [{
      id: "err_no_key",
      title: "❌ 请填写 API Key",
      subTitle: "在组件设置中填写",
      type: "text"
    }];
  }

  // 1. 尝试直连 Trakt
  let traktData = await fetchTraktData(mediaType, listType, clientId);

  // 2. 如果 Trakt 失败 (空数组)，尝试 TMDB 模拟数据兜底
  // (既然 Trakt 连不上，为了不留白，我们用 TMDB 的 Trending 接口模拟)
  if (!traktData || traktData.length === 0) {
      console.log("Trakt 连接失败，切换至 TMDB 模拟模式...");
      return await fetchTmdbTrendingFallback(mediaType, apiKey);
  }

  // 3. 正常处理 Trakt 数据
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
  return results.filter(r => r !== null);
}

// ==========================================
// 辅助函数
// ==========================================

async function fetchTraktData(mediaType, listType, clientId) {
    const url = `https://api.trakt.tv/${mediaType}/${listType}?limit=15`;
    try {
        const res = await Widget.http.get(url, {
            headers: {
                "Content-Type": "application/json",
                "trakt-api-version": "2",
                "trakt-api-key": clientId
            }
        });
        
        let data = res.data || res;
        // 强制转 JSON
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch(e) { return []; }
        }
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.error("Trakt Net Error:", e);
        return [];
    }
}

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
            subTitle: data.overview || "",
            posterPath: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : "",
            backdropPath: data.backdrop_path ? `https://image.tmdb.org/t/p/w780${data.backdrop_path}` : "",
            rating: data.vote_average ? data.vote_average.toFixed(1) : "0.0",
            year: (data.first_air_date || data.release_date || "").substring(0, 4),
            description: stats // Trakt 数据
        };
    } catch (e) { return null; }
}

// 兜底方案：如果 Trakt 挂了，用 TMDB Trending 代替
async function fetchTmdbTrendingFallback(traktType, apiKey) {
    const tmdbType = traktType === "shows" ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/trending/${tmdbType}/week?api_key=${apiKey}&language=zh-CN`;
    
    try {
        const res = await Widget.http.get(url);
        const data = res.data || res;
        
        return (data.results || []).slice(0, 15).map((item, index) => ({
            id: String(item.id),
            tmdbId: parseInt(item.id),
            type: "tmdb",
            mediaType: tmdbType,
            title: item.name || item.title,
            subTitle: item.overview,
            posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
            backdropPath: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : "",
            rating: item.vote_average ? item.vote_average.toFixed(1) : "0.0",
            year: (item.first_air_date || item.release_date || "").substring(0, 4),
            description: `No. ${index + 1} (TMDB数据)` // 提示来源
        }));
    } catch(e) {
        return [{ id: "err_all", title: "❌ 网络错误", subTitle: "Trakt 和 TMDB 均无法访问", type: "text" }];
    }
}
