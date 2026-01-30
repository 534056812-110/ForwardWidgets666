var WidgetMetadata = {
  id: "trakt_global_rankings_v2",
  title: "全球剧集榜单 (Trakt修复版)",
  author: "Makkapakka",
  description: "基于 Trakt 大数据。支持分页翻页，显示更新日期，修复数据解析错误。",
  version: "1.0.2",
  requiredVersion: "0.0.1",
  site: "https://trakt.tv",
  
  globalParams: [
    {
      name: "client_id",
      title: "Trakt Client ID",
      type: "input",
      description: "留空使用内置 Key。",
      value: "" 
    }
  ],

  modules: [
    {
      title: "影视榜单",
      description: "查看各国热门影视",
      requiresWebView: false,
      functionName: "loadRankings",
      type: "list",
      cacheDuration: 3600, 
      params: [
        {
          name: "region",
          title: "地区",
          type: "enumeration",
          defaultValue: "global",
          enumOptions: [
            { title: "🌍 全球热门", value: "global" },
            { title: "🇺🇸 美剧/大片", value: "us" },
            { title: "🇨🇳 国产剧", value: "cn" },
            { title: "🇰🇷 韩剧/韩影", value: "kr" },
            { title: "🇯🇵 日剧/日漫", value: "jp" },
            { title: "🇭🇰 港台剧", value: "hk" },
            { title: "🇬🇧 英剧", value: "gb" },
            { title: "🇪🇸 西班牙剧", value: "es" }
          ]
        },
        {
          name: "type",
          title: "类型",
          type: "enumeration",
          defaultValue: "shows",
          enumOptions: [
            { title: "📺 剧集 (Shows)", value: "shows" },
            { title: "🎬 电影 (Movies)", value: "movies" },
            { title: "♾️ 混合展示", value: "all" }
          ]
        },
        {
          name: "sort",
          title: "排序方式",
          type: "enumeration",
          defaultValue: "trending",
          enumOptions: [
            { title: "🔥 正在热播 (Trending)", value: "trending" },
            { title: "❤️ 最受欢迎 (Popular)", value: "popular" },
            { title: "👁️ 观看最多 (Played)", value: "played" },
            { title: "🆕 近期关注 (Anticipated)", value: "anticipated" }
          ]
        },
        // ✅ 新增：分页参数
        {
          name: "from",
          title: "页码",
          type: "page",
          value: "1"
        }
      ]
    }
  ]
};

// ===========================
// 常量与配置
// ===========================

const DEFAULT_CLIENT_ID = "95b59922670c84040db3632c7aac6f33704f6ffe5cbf3113a056e37cb45cb482";
const API_BASE = "https://api.trakt.tv";
const PAGE_SIZE = 20;

// ===========================
// 主逻辑
// ===========================

async function loadRankings(params) {
  const clientId = params.client_id || DEFAULT_CLIENT_ID;
  const region = params.region || "global";
  const type = params.type || "shows";
  const sort = params.sort || "trending";
  // 获取页码，默认为 1
  const page = parseInt(params.from) || 1;

  let requests = [];
  
  // 混合模式：同时请求电影和剧集
  if (type === "all" || type === "movies") {
    requests.push(fetchTrakt(clientId, "movies", sort, region, page));
  }
  
  if (type === "all" || type === "shows") {
    requests.push(fetchTrakt(clientId, "shows", sort, region, page));
  }

  try {
    const results = await Promise.all(requests);
    let allItems = results.flat();

    // 如果是混合模式，简单的交替排序（一个电影，一个剧集...）
    if (type === "all" && results.length === 2) {
      allItems = [];
      const movies = results[0];
      const shows = results[1];
      const maxLen = Math.max(movies.length, shows.length);
      for (let i = 0; i < maxLen; i++) {
        if (movies[i]) allItems.push(movies[i]);
        if (shows[i]) allItems.push(shows[i]);
      }
    }

    if (allItems.length === 0) {
      if (page > 1) return [{ title: "没有更多内容了", type: "text" }];
      return [{ title: "未获取到数据", subTitle: "请尝试切换地区或检查网络", type: "text" }];
    }

    return allItems;

  } catch (e) {
    return [{ title: "请求错误", subTitle: e.message, type: "text" }];
  }
}

// ===========================
// 网络请求与数据处理
// ===========================

async function fetchTrakt(clientId, mediaType, sort, region, page) {
  // 构造 URL: https://api.trakt.tv/shows/trending?limit=20&page=1
  let url = `${API_BASE}/${mediaType}/${sort}?limit=${PAGE_SIZE}&page=${page}&extended=full`;
  
  // 地区筛选 (Trakt 只有部分接口支持 countries 参数，popular/trending 是支持的)
  if (region && region !== "global") {
    url += `&countries=${region}`;
  }

  try {
    const res = await Widget.http.get(url, {
      headers: {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": clientId
      }
    });

    const data = JSON.parse(res.body || res.data);
    if (!Array.isArray(data)) return [];

    return data.map(item => {
      // ⚠️ 核心修复：不同接口返回结构不一致
      // 1. Trending/Played/Anticipated: 返回 { watchers: 100, movie: {...} }
      // 2. Popular: 直接返回 { title: "...", ids: {...} }
      
      let subject = null;
      let typeLabel = mediaType === "movies" ? "电影" : "剧集";
      
      if (item[mediaType.slice(0, -1)]) { 
        // 对应 item.movie 或 item.show (Trending等接口)
        subject = item[mediaType.slice(0, -1)];
      } else if (item.title && item.ids) {
        // 对应 Popular 接口 (直接返回对象)
        subject = item;
      }

      if (!subject || !subject.ids || !subject.ids.tmdb) return null;

      // === 构造副标题 ===
      // 需求：显示类型和日期
      let dateStr = "";
      if (mediaType === "movies") {
        dateStr = subject.released || "待定";
      } else {
        // 剧集显示首播年份或最后更新时间
        dateStr = (subject.first_aired || subject.year || "").substring(0, 10);
      }

      const subTitle = `[${typeLabel}] 📅 ${dateStr}`;

      return {
        // 确保 ID 唯一，防止混合列表 ID 冲突
        id: `trakt_${mediaType}_${subject.ids.tmdb}`,
        
        // 使用 Forward 的 TMDB 引擎来自动加载精美海报
        type: "tmdb", 
        tmdbId: subject.ids.tmdb,
        mediaType: mediaType === "movies" ? "movie" : "tv", 
        
        title: subject.title,
        subTitle: subTitle, // ✅ 这里就是你要求的副标题
        description: subject.overview || "暂无简介"
      };
    }).filter(Boolean); // 过滤掉无效条目
    
  } catch (e) {
    console.log(e);
    return [];
  }
}
