WidgetMetadata = {
  id: "missav_pro_fix",
  title: "MissAV (Pro)",
  description: "融合版：封面图拼接+正则解析，修复列表报错。",
  author: "MissAV_Dev",
  site: "https://missav.com",
  version: "5.0.0",
  requiredVersion: "0.0.2",
  detailCacheDuration: 0, 
  modules: [
    {
      title: "搜索",
      description: "搜索影片",
      requiresWebView: false,
      functionName: "searchVideo",
      cacheDuration: 300,
      params: [
        {
          name: "keyword",
          title: "关键词",
          type: "input",
          description: "番号或关键词",
        },
        { name: "page", title: "页码", type: "page", value: "1" },
      ],
    },
    {
      title: "热门榜单",
      description: "浏览热门影片",
      requiresWebView: false,
      functionName: "getRankList",
      cacheDuration: 3600,
      params: [
        {
          name: "sort_by",
          title: "榜单类型",
          type: "enumeration",
          enumOptions: [
            { title: "今日热门", value: "today-hot" },
            { title: "本周热门", value: "weekly-hot" },
            { title: "本月热门", value: "monthly-hot" },
            { title: "最新发布", value: "new" },
            { title: "无码流出", value: "uncensored-leak" }
          ],
          value: "weekly-hot"
        },
        { name: "page", title: "页码", type: "page", value: "1" },
      ],
    }
  ],
};

// =================== 核心逻辑区 ===================

const BASE_URL = "https://missav.com";
// 使用你提供的模块中的 Safari UA，通过率更高
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  "Referer": "https://missav.com/",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
};

/**
 * 搜索功能
 */
async function searchVideo(params) {
  const keyword = params.keyword;
  if (!keyword) return [];
  const page = params.page || 1;
  
  // 加上 /cn/ 强制中文
  const url = `${BASE_URL}/cn/search/${encodeURIComponent(keyword)}?page=${page}`;
  return await fetchAndParseList(url);
}

/**
 * 热门榜单
 */
async function getRankList(params) {
  const sort = params.sort_by || "weekly-hot";
  const page = params.page || 1;
  
  const url = `${BASE_URL}/cn/${sort}?page=${page}`;
  return await fetchAndParseList(url);
}

/**
 * 辅助：提取视频ID
 * 比如从 https://missav.com/cn/sw-963 提取 sw-963
 */
function extractVideoId(url) {
    if (!url) return "";
    const parts = url.split("/");
    return parts[parts.length - 1].split("?")[0]; // 去掉末尾可能存在的参数
}

/**
 * 通用列表解析 (融合了 uploaded 模块的逻辑)
 */
async function fetchAndParseList(url) {
  try {
    const res = await Widget.http.get(url, { headers: HEADERS });
    if (!res.data) return [];

    const $ = Widget.html.load(res.data);
    const items = [];

    // 更加宽松的选择器，只要是包含链接的 div 块都遍历
    // MissAV 的每个视频卡片通常都在一个 grid 的 div 里
    $("div.group").each((i, el) => {
      const $el = $(el);
      
      // 1. 提取链接
      const linkTag = $el.find("a").first();
      const href = linkTag.attr("href");
      
      if (href) {
        // 2. 提取标题
        // 优先从 alt 拿，其次从 text 拿
        const title = $el.find("img").attr("alt") || linkTag.text().trim();
        
        // 3. 提取视频 ID
        const videoId = extractVideoId(href);
        
        // 4. 构造封面图 (核心修复)
        // 直接使用 CDN 拼接，不再依赖网页解析，解决 lazyload 问题
        // cover-t.jpg 是小图，cover-m.jpg 是中图
        const cover = `https://fourhoi.com/${videoId}/cover-m.jpg`; 
        
        // 5. 提取时长
        const duration = $el.find("span.text-xs").last().text().trim() || $el.find(".duration").text().trim();

        items.push({
          id: href,
          type: "movie", 
          title: title,
          link: href, 
          backdropPath: cover, // 使用拼接的高清图
          releaseDate: duration, 
        });
      }
    });

    return items;
  } catch (e) {
    console.error("List Error:", e);
    return [];
  }
}

/**
 * 详情页解析
 */
async function loadDetail(link) {
  try {
    const res = await Widget.http.get(link, { headers: HEADERS });
    const html = res.data;
    
    // 1. 提取 m3u8 链接 (保留我的强力正则，比普通模块更稳)
    let m3u8Url = "";
    // 匹配 playlist.m3u8 及其前面的完整 URL
    const globalRegex = /(https?:\/\/[a-zA-Z0-9\-\.]+\/[a-zA-Z0-9\-\.\/_]+\.m3u8[a-zA-Z0-9\-\.\/_?=&]*)/;
    const match = html.match(globalRegex);
    
    if (match && match[1]) {
      m3u8Url = match[1];
    }

    if (!m3u8Url) {
      throw new Error("需要登录或资源不可用");
    }

    // 2. 提取推荐 (Child Items)
    const $ = Widget.html.load(html);
    const relatedItems = [];
    $("div.group").each((i, el) => {
        if (i > 8) return; 
        const $el = $(el);
        const linkTag = $el.find("a").first();
        const href = linkTag.attr("href");
        if(href) {
             const vId = extractVideoId(href);
             relatedItems.push({
                id: href,
                type: "movie",
                title: $el.find("img").attr("alt") || "推荐视频",
                link: href,
                backdropPath: `https://fourhoi.com/${vId}/cover-t.jpg`
            });
        }
    });
    
    const pageTitle = $("h1").text().trim() || "MissAV Video";
    const videoCode = extractVideoId(link).toUpperCase();

    // 3. 返回符合规范的 Detail 对象
    return {
      id: link,
      type: "detail", 
      
      title: pageTitle,
      description: `番号: ${videoCode}`,
      
      videoUrl: m3u8Url,
      
      mediaType: "movie",
      playerType: "system",
      
      // 关键：Header 必须带 Referer
      customHeaders: {
        "User-Agent": HEADERS["User-Agent"],
        "Referer": link,
        "Origin": BASE_URL
      },
      
      childItems: relatedItems
    };

  } catch (e) {
    // 报错时返回部分信息，防止白屏
    const vId = extractVideoId(link);
    return {
       id: link,
       type: "detail",
       title: "解析失败",
       description: e.message,
       backdropPath: `https://fourhoi.com/${vId}/cover-m.jpg`,
       videoUrl: "", 
       childItems: []
    };
  }
}
