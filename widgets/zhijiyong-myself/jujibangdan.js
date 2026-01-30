var WidgetMetadata = {
  id: "trakt_global_pro",
  title: "全球剧集榜单 (Pro)",
  author: "Makkapakka",
  description: "Trakt 数据源。支持无限分页、上映日期显示、混合排序。已修复资源匹配问题。",
  version: "1.0.3",
  requiredVersion: "0.0.1",
  site: "https://trakt.tv",
  
  globalParams: [
    {
      name: "client_id",
      title: "Trakt Client ID",
      type: "input",
      description: "留空使用内置 ID，如有自己的 ID 建议填入。",
      value: "" 
    }
  ],

  modules: [
    {
      title: "影视榜单",
      description: "查看热门电影/剧集",
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
            { title: "🇺🇸 美国 (US)", value: "us" },
            { title: "🇨🇳 中国 (CN)", value: "cn" },
            { title: "🇰🇷 韩国 (KR)", value: "kr" },
            { title: "🇯🇵 日本 (JP)", value: "jp" },
            { title: "🇭🇰 香港 (HK)", value: "hk" },
            { title: "🇬🇧 英国 (GB)", value: "gb" },
            { title: "🇹🇼 台湾 (TW)", value: "tw" }
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
            { title: "♾️ 混合展示 (Mix)", value: "all" }
          ]
        },
        {
          name: "sort",
          title: "排序",
          type: "enumeration",
          defaultValue: "trending",
          enumOptions: [
            { title: "🔥 正在热播 (Trending)", value: "trending" },
            { title: "❤️ 最受欢迎 (Popular)", value: "popular" },
            { title: "👁️ 观看最多 (Played)", value: "played" },
            { title: "🆕 最受期待 (Anticipated)", value: "anticipated" }
          ]
        },
        // ✅ 分页功能
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
// 配置区域
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
  const page = parseInt(params.from) || 1;

  let requests = [];
  
  // 混合模式：并发请求电影和剧集
  if (type === "all" || type === "movies") {
    requests.push(fetchTrakt(clientId, "movies", sort, region, page));
  }
  
  if (type === "all" || type === "shows") {
    requests.push(fetchTrakt(clientId, "shows", sort, region, page));
  }

  try {
    const results = await Promise.all(requests);
    
    // 数据合并策略
    let allItems = [];
    if (type === "all" && results.length === 2) {
      // 电影和剧集穿插排列，避免前20个全是电影
      const [movies, shows] = results;
      const maxLen = Math.max(movies.length, shows.length);
      for (let i = 0; i < maxLen; i++) {
        if (movies[i]) allItems.push(movies[i]);
        if (shows[i]) allItems.push(shows[i]);
      }
    } else {
      allItems = results.flat();
    }

    if (allItems.length === 0) {
      if (page > 1) return [{ title: "没有更多内容了", type: "text" }];
      return [{ title: "列表为空", subTitle: "请检查网络或更换地区", type: "text" }];
    }

    return allItems;

  } catch (e) {
    return [{ title: "加载失败", subTitle: e.message, type: "text" }];
  }
}

// ===========================
// 核心请求函数
// ===========================

async function fetchTrakt(clientId, mediaType, sort, region, page) {
  // 构造 API 地址
  // extended=full 是为了获取年份和发布日期
  let url = `${API_BASE}/${mediaType}/${sort}?limit=${PAGE_SIZE}&page=${page}&extended=full`;
  
  // 只有部分接口支持地区过滤，Trakt 官方规定 trending/popular 支持
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

    // 错误检查
    if (!res || (res.status && res.status >= 400)) {
        console.log("Trakt API Error: " + url);
        return [];
    }

    const data = JSON.parse(res.body || res.data);
    if (!Array.isArray(data)) return [];

    return data.map(item => {
      // 🔄 数据结构适配器
      // 场景 A: 列表返回 { movie: {...}, watchers: 123 }
      // 场景 B: 列表返回 { ...movieObject } (Popular 接口)
      
      let subject = null;
      // 移除末尾的s，转为单数 (movies -> movie)
      const singularType = mediaType.slice(0, -1); 
      
      if (item[singularType]) {
        subject = item[singularType];
      } else if (item.ids) {
        // 如果外层直接有 ids，说明结构是场景 B
        subject = item;
      }

      // 🛡️ 防御性编程：没有 TMDB ID 就跳过，否则点进去会报错
      if (!subject || !subject.ids || !subject.ids.tmdb) return null;

      // === 构造你要求的副标题 ===
      // 格式：[电影] 📅 2023-11-25
      const typeLabel = mediaType === "movies" ? "电影" : "剧集";
      let dateStr = "待定";
      
      if (mediaType === "movies") {
        dateStr = subject.released || subject.year || "";
      } else {
        // 剧集优先显示首播时间
        dateStr = subject.first_aired || subject.year || "";
      }
      // 只取日期部分 YYYY-MM-DD
      if (dateStr.length > 10) dateStr = dateStr.substring(0, 10);
      
      const subTitleText = `[${typeLabel}] 📅 ${dateStr}`;

      return {
        // 🆔 确保 ID 唯一
        id: `trakt_${mediaType}_${subject.ids.tmdb}`,
        
        // 📺 核心：指定类型为 tmdb
        type: "tmdb", 
        // 必须转为数字，否则部分系统匹配不到资源
        tmdbId: parseInt(subject.ids.tmdb), 
        // 告诉 Forward 这是电影还是剧集
        mediaType: mediaType === "movies" ? "movie" : "tv", 
        
        title: subject.title,
        subTitle: subTitleText, // ✅ 你要求的格式
        description: subject.overview || "暂无简介",
        
        // 封面图：留空，让 Forward 通过 tmdbId 自动去匹配高清海报
        posterPath: "" 
      };
    }).filter(item => item !== null); // 过滤无效项
    
  } catch (e) {
    console.log("Parse Error: " + e.message);
    return [];
  }
}
