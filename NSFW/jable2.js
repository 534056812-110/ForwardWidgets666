WidgetMetadata = {
  id: "jable_rewrite_pure_v1",
  title: "Jable (重写稳定版)",
  description: "重写核心逻辑，修复搜索和播放，支持榜单。",
  author: "Jable_Dev",
  site: "https://jable.tv",
  version: "2.0.0",
  requiredVersion: "0.0.2",
  detailCacheDuration: 0, // 详情页不缓存，避免链接过期
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
          description: "输入番号或女优名",
        },
        { name: "page", title: "页码", type: "page", value: "1" },
      ],
    },
    {
      title: "热门榜单",
      description: "近期热门影片",
      requiresWebView: false,
      functionName: "getRankList",
      cacheDuration: 3600,
      params: [
        {
          name: "sort_by",
          title: "榜单类型",
          type: "enumeration",
          enumOptions: [
            { title: "本周热门", value: "video_viewed_week" },
            { title: "本月热门", value: "video_viewed_month" },
            { title: "历史最热", value: "video_viewed" },
            { title: "最多收藏", value: "most_favourited" },
          ],
          value: "video_viewed_week"
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

const BASE_URL = "https://jable.tv";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": "https://jable.tv/",
  "Origin": "https://jable.tv"
};

/**
 * 搜索功能
 */
async function searchVideo(params) {
  const keyword = params.keyword;
  if (!keyword) return [];

  // 计算偏移量：API的 from 不是页码，而是从第几个视频开始
  // 假设每页24个 (Jable默认)
  const page = parseInt(params.page) || 1;
  const fromIndex = (page - 1) * 24 + 1;

  // 使用通用列表接口 + 搜索关键词
  const url = `${BASE_URL}/search/${encodeURIComponent(keyword)}/?mode=async&function=get_block&block_id=list_videos_common_videos_list&q=${encodeURIComponent(keyword)}&sort_by=post_date&from=${fromIndex}`;

  return await fetchAndParseList(url);
}

/**
 * 热门榜单
 */
async function getRankList(params) {
  const sort = params.sort_by || "video_viewed_week";
  const page = parseInt(params.page) || 1;
  const fromIndex = (page - 1) * 24 + 1;

  // 使用热门接口
  const url = `${BASE_URL}/hot/?mode=async&function=get_block&block_id=list_videos_common_videos_list&sort_by=${sort}&from=${fromIndex}`;

  return await fetchAndParseList(url);
}

/**
 * 最新更新
 */
async function getNewList(params) {
  const page = parseInt(params.page) || 1;
  const fromIndex = (page - 1) * 24 + 1;

  const url = `${BASE_URL}/new-release/?mode=async&function=get_block&block_id=list_videos_common_videos_list&sort_by=post_date&from=${fromIndex}`;

  return await fetchAndParseList(url);
}

/**
 * 通用：请求列表并解析 HTML
 */
async function fetchAndParseList(url) {
  try {
    const res = await Widget.http.get(url, { headers: HEADERS });
    const html = res.data;
    
    // 如果返回空字符串，说明到底了
    if (!html || html.length < 100) return [];

    const $ = Widget.html.load(html);
    const items = [];

    // 解析 .video-img-box 元素
    $(".video-img-box").each((i, el) => {
      const $el = $(el);
      
      // 提取标题和链接
      const titleLink = $el.find(".title a");
      const title = titleLink.text().trim();
      let href = titleLink.attr("href");
      
      // 提取封面
      const imgTag = $el.find(".img-box img");
      let cover = imgTag.attr("data-src") || imgTag.attr("src");
      
      // 提取时长
      const duration = $el.find(".label").text().trim();

      // 数据清洗
      if (href && !href.startsWith("http")) {
        href = href; // 有时候是相对路径，但Jable通常返回完整路径，这里保留原样
      }

      if (title && href) {
        items.push({
          title: title,
          link: href, // 这是详情页链接，传给 loadDetail
          backdropPath: cover, // 封面
          releaseDate: duration, // 把时长显示在日期位置
          type: "movie", // Forward 类型
          id: href // 唯一标识
        });
      }
    });

    return items;
  } catch (e) {
    console.log("List fetch error: " + e.message);
    return [];
  }
}

/**
 * 详情页 & 播放解析
 * Forward 会调用这个函数来获取 videoUrl
 */
async function loadDetail(link) {
  try {
    // 1. 请求详情页 HTML
    const res = await Widget.http.get(link, { headers: HEADERS });
    const html = res.data;

    // 2. 正则提取 hlsUrl
    // 目标代码片段: var hlsUrl = 'https://...m3u8';
    const hlsMatch = html.match(/var hlsUrl\s*=\s*'(https?:\/\/[^']+)'/);
    
    if (!hlsMatch) {
      throw new Error("未找到视频地址，可能需要登录或资源已失效");
    }

    const m3u8Url = hlsMatch[1];

    // 3. 提取推荐列表 (猜你喜欢)
    // 这里的解析逻辑和上面列表解析类似
    const $ = Widget.html.load(html);
    const relatedItems = [];
    $("#list_videos_common_videos_list .video-img-box").each((i, el) => {
        const $el = $(el);
        const titleLink = $el.find(".title a");
        if(titleLink.length){
            relatedItems.push({
                title: titleLink.text().trim(),
                link: titleLink.attr("href"),
                backdropPath: $el.find("img").attr("data-src") || $el.find("img").attr("src"),
                type: "movie",
                id: titleLink.attr("href")
            });
        }
    });

    // 4. 返回 Forward 标准详情对象
    return {
      id: link,
      title: $(".header-left h4").text().trim() || "Jable Video",
      description: $(".header-left .visible-xs").text().trim(),
      videoUrl: m3u8Url, // 关键：播放地址
      mediaType: "movie",
      playerType: "system", // 使用系统播放器
      // 关键头信息：Jable 必须验证 Referer 才能播放
      customHeaders: {
        "User-Agent": HEADERS["User-Agent"],
        "Referer": link, // 引用页必须是视频详情页地址
        "Origin": BASE_URL
      },
      childItems: relatedItems // 底部推荐视频
    };

  } catch (e) {
    console.log("Detail fetch error: " + e.message);
    // 抛出错误会在界面显示
    throw e;
  }
}
