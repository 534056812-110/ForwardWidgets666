WidgetMetadata = {
  id: "gemini.platform.originals.v2.1",
  title: "流媒体·独家原创 (修复版)",
  author: "Gemini & Makkapakka",
  description: "v2.1: 修正国产平台ID(腾讯/B站/爱奇艺等)；免填API Key；支持电影/综艺/动漫分类及追更排序。",
  version: "2.1.0",
  requiredVersion: "0.0.1",
  modules: [
    {
      title: "独家原创 & 追更日历",
      functionName: "loadPlatformOriginals",
      type: "list",
      requiresWebView: false,
      params: [
        // 1. 平台选择 (已修正为可用ID)
        {
          name: "network",
          title: "出品平台",
          type: "enumeration",
          value: "213", // Netflix
          enumOptions: [
            // --- 国际巨头 ---
            { title: "Netflix (网飞)", value: "213" },
            { title: "HBO (Max)", value: "49" },
            { title: "Apple TV+", value: "2552" },
            { title: "Disney+", value: "2739" },
            { title: "Amazon Prime", value: "1024" },
            { title: "Hulu", value: "453" },
            { title: "Peacock", value: "3353" },
            { title: "Paramount+", value: "4330" },
            // --- 国内巨头 (ID已修正) ---
            { title: "腾讯视频", value: "2007" },
            { title: "爱奇艺", value: "1330" },
            { title: "Bilibili (B站)", value: "1605" },
            { title: "优酷视频", value: "1419" },
            { title: "芒果TV", value: "1631" },
            { title: "TVING (韩)", value: "4096" }
          ],
        },
        // 2. 内容类型
        {
          name: "contentType",
          title: "内容类型",
          type: "enumeration",
          value: "tv",
          enumOptions: [
            { title: "📺 剧集 (默认)", value: "tv" },
            { title: "🎬 电影", value: "movie" },
            { title: "🌸 动漫/动画", value: "anime" },
            { title: "🎤 综艺/真人秀", value: "variety" }
          ]
        },
        // 3. 排序与功能
        {
          name: "sortBy",
          title: "排序与功能",
          type: "enumeration",
          value: "popularity.desc",
          enumOptions: [
            { title: "🔥 综合热度", value: "popularity.desc" },
            { title: "⭐ 最高评分", value: "vote_average.desc" },
            { title: "🆕 最新首播", value: "first_air_date.desc" },
            { title: "📅 按更新时间 (追更模式)", value: "next_episode" },
            { title: "📆 今日播出 (每日榜单)", value: "daily_airing" }
          ],
        },
        // 4. 页码
        {
          name: "page",
          title: "页码",
          type: "page"
        }
      ],
    },
  ],
};

async function loadPlatformOriginals(params) {
  // 不再需要 apiKey 参数
  const networkId = params.network || "213";
  const contentType = params.contentType || "tv";
  const sortBy = params.sortBy || "popularity.desc";
  const page = params.page || 1;

  // === 1. 构建参数 ===
  let endpoint = "/discover/tv";
  
  // 基础查询参数
  let queryParams = {
      with_networks: networkId,
      language: "zh-CN",
      include_null_first_air_dates: false,
      page: page
  };

  // 根据 contentType 调整策略
  if (contentType === "movie") {
    endpoint = "/discover/movie";
    // 电影排序映射
    if (sortBy === "first_air_date.desc") queryParams.sort_by = "release_date.desc";
    else if (sortBy === "next_episode" || sortBy === "daily_airing") queryParams.sort_by = "popularity.desc"; // 电影无追更，回退
    else queryParams.sort_by = sortBy;
    
  } else {
    // TV 类 (剧集, 动漫, 综艺)
    
    // 自动附加 Genre ID
    if (contentType === "anime") {
        queryParams.with_genres = "16"; // 动画
    } else if (contentType === "variety") {
        queryParams.with_genres = "10764|10767"; // 真人秀 OR 脱口秀
    }

    // 处理排序模式
    if (sortBy === "daily_airing") {
        // 📆 每日更新：锁定 Air Date 为今天
        const today = new Date();
        const dateStr = today.toISOString().split("T")[0]; 
        queryParams["air_date.gte"] = dateStr;
        queryParams["air_date.lte"] = dateStr;
        queryParams.sort_by = "popularity.desc";
    } else if (sortBy === "next_episode") {
        // 📅 追更模式：先取热度高的，再本地排时间
        queryParams.sort_by = "popularity.desc";
        // 稍微过滤掉太旧的完结剧，状态：0=Unknown, 1=Returning, 2=Ended, 3=Canceled...
        // 这里不过滤太死，防止漏掉
    } else {
        // 普通排序
        if (sortBy.includes("vote_average")) queryParams["vote_count.gte"] = 100;
        queryParams.sort_by = sortBy;
    }
  }

  try {
    // ✅ 使用内置 Widget.tmdb.get，免 Key
    const res = await Widget.tmdb.get(endpoint, { params: queryParams });
    const data = res || {};
    let items = data.results || [];

    if (items.length === 0) {
      return page === 1 ? [{ title: "该分类下暂无数据", subTitle: "尝试切换类型或平台", type: "text" }] : [];
    }

    // === 2. 高级数据处理 (追更 & 格式化) ===
    
    // 只有 TV 且需要追更/每日信息时，才查详情
    const needDetails = (contentType !== "movie" && (sortBy === "next_episode" || sortBy === "daily_airing"));
    // 限制数量防止请求过多
    const processCount = needDetails ? 12 : 20;

    const enrichedItems = await Promise.all(items.slice(0, processCount).map(async (item) => {
        let nextEp = null;
        let lastEp = null;
        
        if (needDetails) {
             try {
                 // ✅ 查详情也用内置方法
                 const details = await Widget.tmdb.get(`/tv/${item.id}`, { params: { language: "zh-CN" } });
                 if (details) {
                     nextEp = details.next_episode_to_air;
                     lastEp = details.last_episode_to_air;
                 }
             } catch(e) {}
        }

        // 计算排序用的时间
        let sortDate = "1900-01-01";
        if (nextEp) sortDate = nextEp.air_date;
        else if (lastEp && sortBy === "daily_airing") sortDate = lastEp.air_date;
        else sortDate = item.first_air_date || item.release_date || "2099-01-01";

        return {
            ...item,
            _nextEp: nextEp,
            _lastEp: lastEp,
            _sortDate: sortDate
        };
    }));

    // === 3. 本地排序 (针对 Next Episode) ===
    let finalItems = enrichedItems;
    
    if (sortBy === "next_episode" && contentType !== "movie") {
        // 逻辑：有 Next Ep 的排前面 (按时间近到远)
        finalItems.sort((a, b) => {
            const dateA = new Date(a._sortDate).getTime();
            const dateB = new Date(b._sortDate).getTime();
            
            if (a._nextEp && b._nextEp) return dateA - dateB;
            if (a._nextEp && !b._nextEp) return -1;
            if (!a._nextEp && b._nextEp) return 1;
            return 0; 
        });
    }

    // === 4. 生成卡片 ===
    return finalItems.map(item => buildCard(item, contentType, sortBy));

  } catch (e) {
    return [{ title: "请求失败", subTitle: e.message, type: "text" }];
  }
}

function buildCard(item, contentType, sortBy) {
    const isMovie = contentType === "movie";
    const typeLabel = isMovie ? "影" : (contentType === "anime" ? "漫" : (contentType === "variety" ? "综" : "剧"));
    
    // 图片
    let imagePath = "";
    if (item.backdrop_path) imagePath = `https://image.tmdb.org/t/p/w780${item.backdrop_path}`;
    else if (item.poster_path) imagePath = `https://image.tmdb.org/t/p/w500${item.poster_path}`;

    // 格式化日期
    const formatDate = (str) => {
        if (!str) return "";
        const date = new Date(str);
        if (isNaN(date.getTime())) return str;
        return `${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
    };

    let subTitle = "";
    let genreTitle = "";

    if (!isMovie && (sortBy === "next_episode" || sortBy === "daily_airing")) {
        // 追更模式显示集数
        if (item._nextEp) {
            subTitle = `🔜 ${formatDate(item._nextEp.air_date)} 更新 S${item._nextEp.season_number}E${item._nextEp.episode_number}`;
            genreTitle = formatDate(item._nextEp.air_date);
        } else if (item._lastEp) {
             const prefix = sortBy === "daily_airing" ? "🔥" : "📅";
             subTitle = `${prefix} ${formatDate(item._lastEp.air_date)} 更新 S${item._lastEp.season_number}E${item._lastEp.episode_number}`;
             genreTitle = formatDate(item._lastEp.air_date);
        } else {
             subTitle = `[${typeLabel}] ${item.first_air_date || "未知"}`;
             genreTitle = (item.first_air_date || "").substring(0,4);
        }
    } else {
        // 默认模式
        const year = (item.release_date || item.first_air_date || "").substring(0, 4);
        const rating = item.vote_average ? `⭐${item.vote_average.toFixed(1)}` : "0.0";
        
        if (isMovie) {
            subTitle = `🎬 ${year} • ${rating}`;
        } else {
            subTitle = `[${typeLabel}] ${year} • ${rating}`;
        }
        genreTitle = year;
    }

    return {
        id: String(item.id),
        tmdbId: parseInt(item.id),
        type: "tmdb",
        mediaType: isMovie ? "movie" : "tv",
        title: item.name || item.title || item.original_name,
        subTitle: subTitle,
        genreTitle: genreTitle,
        description: item.overview || "暂无简介",
        posterPath: imagePath
    };
}
