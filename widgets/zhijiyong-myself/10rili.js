WidgetMetadata = {
  id: "douban_trakt_native_port",
  title: "豆瓣热榜 x Trakt (移植版)",
  author: "Makkapakka",
  description: "复用可用代码的底层请求逻辑，修复无数据问题。集成 Trakt 播出时间进行本地排序。",
  version: "8.0.0",
  requiredVersion: "0.0.1",
  site: "https://movie.douban.com",

  globalParams: [],

  modules: [
    {
      title: "豆瓣全网热榜",
      requiresWebView: false,
      functionName: "loadDoubanTraktFusion",
      type: "list",
      cacheDuration: 3600,
      params: [
        {
          name: "category",
          title: "榜单分类",
          type: "enumeration",
          defaultValue: "tv_domestic",
          enumOptions: [
            { title: "🇨🇳 热门国产剧", value: "tv_domestic" },
            { title: "🇺🇸 热门欧美剧", value: "tv_american" },
            { title: "🇰🇷 热门韩剧", value: "tv_korean" },
            { title: "🇯🇵 热门日剧", value: "tv_japanese" },
            { title: "🔥 综合热门剧集", value: "tv_hot" },
            { title: "🎤 综合热门综艺", value: "show_hot" },
            { title: "🇨🇳 国内综艺", value: "show_domestic" },
            { title: "🌍 国外综艺", value: "show_foreign" },
            { title: "🎬 热门电影", value: "movie_hot_gaia" }
          ]
        },
        {
          name: "sort",
          title: "排序模式",
          type: "enumeration",
          defaultValue: "update",
          enumOptions: [
            { title: "📅 按更新时间 (Trakt)", value: "update" },
            { title: "🆕 按上映年份 (新片)", value: "release" },
            { title: "🔥 豆瓣原始热度", value: "default" }
          ]
        }
      ]
    }
  ]
};

// ==========================================
// 0. 核心常量
// ==========================================

const TRAKT_CLIENT_ID = "95b59922670c84040db3632c7aac6f33704f6ffe5cbf3113a056e37cb45cb482";
const TRAKT_API_BASE = "https://api.trakt.tv";

// ==========================================
// 1. 主逻辑
// ==========================================

async function loadDoubanTraktFusion(params = {}) {
  const category = params.category || "tv_domestic";
  const sort = params.sort || "update";

  // 1. [豆瓣] 使用你朋友代码的逻辑抓取
  const doubanItems = await fetchDoubanList(category);
  
  if (!doubanItems || doubanItems.length === 0) {
    return [{ title: "列表为空", subTitle: "接口未返回数据，请稍后重试", type: "text" }];
  }

  // 2. [Trakt & TMDB] 获取时间与图片
  // 限制前25个进行详细查询，避免超时
  const itemsToProcess = doubanItems.slice(0, 25);
  
  const enrichedItems = await Promise.all(itemsToProcess.map(async (item) => {
    return await fetchMetadata(item);
  }));

  // 过滤无效项
  let validItems = enrichedItems.filter(Boolean);

  // 3. [本地排序]
  if (sort === "update") {
    validItems.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));
  } else if (sort === "release") {
    validItems.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
  }
  // default: 保持豆瓣原序

  return validItems.map(item => buildCard(item));
}

// ==========================================
// 2. 豆瓣抓取 (照搬代码逻辑)
// ==========================================

async function fetchDoubanList(key) {
  // 严格使用你提供的 Headers
  const url = `https://m.douban.com/rexxar/api/v2/subject_collection/${key}/items?start=0&count=40`;
  
  try {
    const response = await Widget.http.get(url, {
      headers: {
        Referer: `https://m.douban.com/movie`,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    // ⚠️ 关键修改：直接使用 response.data，不再强行 JSON.parse
    // 很多时候 Forward 已经自动 Parse 好了，再 Parse 就会报错
    const data = response.data;
    
    if (data && data.subject_collection_items) {
      return data.subject_collection_items.map(i => ({
        title: i.title,
        year: i.year,
        type: (key.includes("movie") || i.type === "movie") ? "movie" : "tv"
      }));
    }
    return [];
  } catch (e) {
    console.log("Douban Fetch Error: " + e);
    return [];
  }
}

// ==========================================
// 3. 元数据获取 (Trakt + TMDB)
// ==========================================

async function fetchMetadata(doubanItem) {
  const { title, year, type } = doubanItem;
  
  try {
    // A. TMDB 搜 ID
    const searchRes = await Widget.tmdb.search(title, type, { language: "zh-CN" });
    const results = searchRes.results || [];
    if (results.length === 0) return null;

    const targetYear = parseInt(year);
    let bestMatch = results.find(r => {
      const rYear = parseInt((r.first_air_date || r.release_date || "0").substring(0, 4));
      return Math.abs(rYear - targetYear) <= 1;
    });
    if (!bestMatch) bestMatch = results[0];

    const tmdbId = bestMatch.id;
    
    // B. Trakt 查时间
    let sortDate = "1900-01-01";
    let releaseDate = "1900-01-01";
    let nextEpInfo = null;
    let lastEpInfo = null;
    let status = "";

    if (type === "tv") {
      // 1. 查 Summary (状态)
      try {
        const sRes = await Widget.http.get(`${TRAKT_API_BASE}/shows/tmdb:${tmdbId}?extended=full`, {
            headers: { "Content-Type": "application/json", "trakt-api-version": "2", "trakt-api-key": TRAKT_CLIENT_ID }
        });
        const summary = sRes.data || JSON.parse(sRes.body || "{}");
        releaseDate = summary.first_aired || bestMatch.first_air_date || "1900-01-01";
        status = summary.status;
      } catch(e) {}

      // 2. 查 Next/Last Episode
      if (status === "returning series" || status === "in production") {
        try {
          const nextRes = await Widget.http.get(`${TRAKT_API_BASE}/shows/tmdb:${tmdbId}/next_episode?extended=full`, {
              headers: { "Content-Type": "application/json", "trakt-api-version": "2", "trakt-api-key": TRAKT_CLIENT_ID }
          });
          if (nextRes.status !== 204) nextEpInfo = nextRes.data || JSON.parse(nextRes.body || "{}");
        } catch(e) {}
      }

      if (!nextEpInfo) {
        try {
          const lastRes = await Widget.http.get(`${TRAKT_API_BASE}/shows/tmdb:${tmdbId}/last_episode?extended=full`, {
              headers: { "Content-Type": "application/json", "trakt-api-version": "2", "trakt-api-key": TRAKT_CLIENT_ID }
          });
          if (lastRes.status !== 204) lastEpInfo = lastRes.data || JSON.parse(lastRes.body || "{}");
        } catch(e) {}
      }

      // 决定排序时间
      if (nextEpInfo) sortDate = nextEpInfo.first_aired;
      else if (lastEpInfo) sortDate = lastEpInfo.first_aired;
      else sortDate = releaseDate;

    } else {
      // 电影
      sortDate = bestMatch.release_date || "1900-01-01";
      releaseDate = sortDate;
    }

    return {
      tmdb: bestMatch,
      mediaType: type,
      sortDate: sortDate,
      releaseDate: releaseDate,
      nextEp: nextEpInfo,
      lastEp: lastEpInfo,
      status: status
    };

  } catch (e) {
    return null;
  }
}

// ==========================================
// 4. 卡片 UI
// ==========================================

function buildCard(item) {
  const d = item.tmdb;
  const typeLabel = item.mediaType === "tv" ? "剧" : "影";
  
  // 图片
  let imagePath = "";
  if (d.backdrop_path) imagePath = `https://image.tmdb.org/t/p/w780${d.backdrop_path}`;
  else if (d.poster_path) imagePath = `https://image.tmdb.org/t/p/w500${d.poster_path}`;

  // 日期格式化
  const formatDate = (str) => {
      if (!str || str.startsWith("1900")) return "";
      const date = new Date(str);
      if (isNaN(date.getTime())) return "";
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${m}-${day}`;
  };

  let subTitle = "";
  let genreTitle = ""; 

  if (item.mediaType === "tv") {
      if (item.nextEp) {
          const date = formatDate(item.nextEp.first_aired);
          subTitle = `🔜 ${date} 更新 S${item.nextEp.season}E${item.nextEp.number}`;
          genreTitle = date;
      } else if (item.lastEp) {
          const date = formatDate(item.lastEp.first_aired);
          if (item.status === "ended") {
              const year = (item.releaseDate || "").substring(0, 4);
              subTitle = `[${typeLabel}] 已完结 (${year})`;
              genreTitle = "End";
          } else {
              subTitle = `📅 ${date} 更新 S${item.lastEp.season}E${item.lastEp.number}`;
              genreTitle = date;
          }
      } else {
          const year = (item.releaseDate || "").substring(0, 4);
          subTitle = `[${typeLabel}] ${year}`;
          genreTitle = year;
      }
  } else {
      const date = formatDate(item.releaseDate);
      subTitle = `🎬 ${date} 上映`;
      genreTitle = (item.releaseDate || "").substring(0, 4);
  }
  
  return {
      id: `douban_${d.id}`,
      tmdbId: d.id, 
      type: "tmdb",
      mediaType: item.mediaType,
      title: d.name || d.title,
      subTitle: subTitle,
      genreTitle: genreTitle,
      description: d.overview,
      posterPath: imagePath
  };
}
