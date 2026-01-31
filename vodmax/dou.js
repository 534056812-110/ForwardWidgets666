/**
 * TMDB 演示插件
 * 功能：展示热门电影/电视剧，并支持搜索
 */
WidgetMetadata = {
  id: "tmdb_trending_demo",
  title: "TMDB 热门影视",
  description: "基于 TMDB API 的 Forward 插件开发示例",
  author: "Gemini",
  version: "1.0.0",
  requiredVersion: "0.0.1", //

  modules: [
    {
      title: "发现影视",
      functionName: "loadTrending",
      type: "video", //
      params: [
        {
          name: "media_type",
          title: "类型",
          type: "enumeration", //
          value: "movie",
          enumOptions: [
            { title: "电影", value: "movie" },
            { title: "电视剧", value: "tv" }
          ]
        },
        {
          name: "page",
          title: "页码",
          type: "page", //
          startPage: 1
        }
      ]
    }
  ],
  
  // 全局搜索配置
  search: {
    title: "搜索 TMDB",
    functionName: "loadSearch",
    params: [
      { name: "keyword", title: "关键词", type: "input" }
    ]
  }
};

// --- 处理函数 ---

/**
 * 加载热门列表
 */
async function loadTrending(params = {}) {
  try {
    const { media_type = "movie", page = 1 } = params;
    
    // 使用内置 TMDB API 客户端
    const response = await Widget.tmdb.get(`trending/${media_type}/week`, {
      params: { 
        language: "zh-CN",
        page: page 
      }
    });

    return parseTMDBResults(response.results, media_type); //
  } catch (error) {
    console.error("加载热门失败:", error); //
    return [];
  }
}

/**
 * 加载搜索结果
 */
async function loadSearch(params = {}) {
  const { keyword } = params;
  if (!keyword) return [];

  try {
    const response = await Widget.tmdb.get("search/multi", {
      params: {
        query: keyword,
        language: "zh-CN"
      }
    });
    return parseTMDBResults(response.results);
  } catch (error) {
    console.error("搜索失败:", error);
    return [];
  }
}

// --- 工具函数 ---

/**
 * 将 TMDB 返回格式转换为 VideoItem
 */
function parseTMDBResults(results, defaultType) {
  if (!results) return [];

  return results.map(item => {
    const type = item.media_type || defaultType;
    return {
      id: `${type}.${item.id}`, // 符合 TMDB 类型的 ID 格式
      type: "tmdb",            // 自动触发内核元数据抓取
      title: item.title || item.name,
      description: item.overview,
      posterPath: item.poster_path, //
      backdropPath: item.backdrop_path,
      releaseDate: item.release_date || item.first_air_date,
      rating: item.vote_average,
      mediaType: type === "movie" ? "movie" : "tv"
    };
  });
}
