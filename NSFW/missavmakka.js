WidgetMetadata = {
  id: "missav_universal_v1",
  title: "MissAV (通用规范版)",
  description: "基于通用正则提取，修复播放失败问题，支持热门与搜索。",
  author: "MissAV_Dev",
  site: "https://missav.com",
  version: "1.0.0",
  requiredVersion: "0.0.2",
  detailCacheDuration: 0, // 详情页坚决不缓存，链接有时效性
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
          ],
          value: "weekly-hot"
        },
        { name: "page", title: "页码", type: "page", value: "1" },
      ],
    },
    {
      title: "最新更新",
      description: "最新发布的影片",
      requiresWebView: false,
      functionName: "getNewList",
      cacheDuration: 300,
      params: [
        { name: "page", title: "页码", type: "page", value: "1" },
      ],
    }
  ],
};

// =================== 核心逻辑区 ===================

const BASE_URL = "https://missav.com";
// MissAV 对 UA 和 Referer 极其敏感
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": "https://missav.com/",
  "Origin": "https://missav.com",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
};

/**
 * 搜索功能
 * URL: https://missav.com/cn/search/KEYWORD?page=N
 */
async function searchVideo(params) {
  const keyword = params.keyword;
  if (!keyword) return [];
  const page = params.page || 1;
  
  // 必须加上 /cn/ 确保中文界面（虽然MissAV自动适应，但加上保险）
  const url = `${BASE_URL}/cn/search/${encodeURIComponent(keyword)}?page=${page}`;
  return await fetchAndParseList(url);
}

/**
 * 热门榜单
 * URL: https://missav.com/cn/today-hot?page=N
 */
async function getRankList(params) {
  const sort = params.sort_by || "weekly-hot";
  const page = params.page || 1;
  
  const url = `${BASE_URL}/cn/${sort}?page=${page}`;
  return await fetchAndParseList(url);
}

/**
 * 最新更新
 * URL: https://missav.com/cn/new?page=N
 */
async function getNewList(params) {
  const page = params.page || 1;
  const url = `${BASE_URL}/cn/new?page=${page}`;
  return await fetchAndParseList(url);
}

/**
 * 通用列表解析 (针对 Tailwind CSS 结构)
 */
async function fetchAndParseList(url) {
  try {
    const res = await Widget.http.get(url, { headers: HEADERS });
    if (!res.data) return [];

    const $ = Widget.html.load(res.data);
    const items = [];

    // MissAV 的列表项通常在 .grid .group 中
    // 这里的选择器为了兼容性，选得比较宽泛
    $("div.group").each((i, el) => {
      const $el = $(el);
      
      // 提取链接和标题
      // 链接通常在第一个 a 标签
      const linkTag = $el.find("a").first();
      const href = linkTag.attr("href");
      const title = linkTag.attr("alt") || $el.find("img").attr("alt") || linkTag.text().trim();
      
      // 提取封面
      const imgTag = $el.find("img");
      // MissAV 经常使用 data-src 进行懒加载
      const cover = imgTag.attr("data-src") || imgTag.attr("src");
      
      // 提取时长 (通常在右下角的绝对定位标签里)
      const duration = $el.find(".absolute.bottom-1.right-1").text().trim();

      if (href && title) {
        items.push({
          id: href,
          type: "movie", // 列表必须用 movie
          title: title,
          link: href, // 这是完整的 URL
          backdropPath: cover,
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
 * 核心：正则暴力提取 .m3u8
 */
async function loadDetail(link) {
  try {
    const res = await Widget.http.get(link, { headers: HEADERS });
    const html = res.data;
    
    // 1. 暴力正则扫描 .m3u8 链接
    // MissAV 的 m3u8 通常也是 https://surrit.com/UUID/playlist.m3u8 这种格式
    // 或者在 source: '...' 中
    let m3u8Url = "";
    
    // 匹配 pattern: https://...playlist.m3u8...
    // 排除掉转义符，抓取最纯净的链接
    const globalRegex = /(https?:\/\/[a-zA-Z0-9\-\.]+\/[a-zA-Z0-9\-\.\/_]+\.m3u8[a-zA-Z0-9\-\.\/_?=&]*)/;
    const match = html.match(globalRegex);
    
    if (match && match[1]) {
      m3u8Url = match[1];
    }
    
    // 如果正则没找到（极少见），尝试根据 UUID 拼接 (作为保底)
    if (!m3u8Url) {
        // MissAV URL: https://missav.com/cn/sw-963
        // UUID: sw-963
        const uuidMatch = link.match(/\/([a-zA-Z0-9-]+)$/);
        if (uuidMatch) {
            // 这是盲猜的 CDN，可能失效，所以仅作 fallback
            // m3u8Url = `https://surrit.com/${uuidMatch[1]}/playlist.m3u8`;
        }
    }

    if (!m3u8Url) {
      throw new Error("未找到视频资源 (可能需要登录或属于付费内容)");
    }

    // 2. 提取相关推荐
    const $ = Widget.html.load(html);
    const relatedItems = [];
    $("div.group").each((i, el) => {
        // 简单复用列表解析逻辑，只取前8个避免加载太慢
        if (i > 8) return;
        const $el = $(el);
        const linkTag = $el.find("a").first();
        const href = linkTag.attr("href");
        const title = $el.find("img").attr("alt");
        
        if(href && title) {
            relatedItems.push({
                id: href,
                type: "movie",
                title: title,
                link: href,
                backdropPath: $el.find("img").attr("data-src") || $el.find("img").attr("src"),
            });
        }
    });
    
    const pageTitle = $("h1.text-base").text().trim() || "MissAV Video";
    // 尝试提取番号 (标题的第一个词通常是番号)
    const videoCode = pageTitle.split(" ")[0];

    // 3. 返回符合规范的 Detail 对象
    return {
      id: link,
      type: "detail", // 必须是 detail
      
      title: pageTitle,
      description: `番号: ${videoCode}`,
      
      videoUrl: m3u8Url,
      
      mediaType: "movie",
      playerType: "system",
      
      // 核心：Header注入
      customHeaders: {
        "User-Agent": HEADERS["User-Agent"],
        "Referer": link, // 必须是当前详情页地址
        "Origin": BASE_URL
      },
      
      childItems: relatedItems
    };

  } catch (e) {
    console.log("Detail Error: " + e.message);
    return {
       id: link,
       type: "detail",
       title: "解析失败",
       description: e.message,
       videoUrl: "", 
       childItems: []
    };
  }
}
