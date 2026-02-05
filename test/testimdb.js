WidgetMetadata = {
  id: "imdb_test",
  title: "IMDb 榜单集合",
  version: "1.0.1",
  author: "FwDev",
  description: "查看 IMDb/TMDB 的实时热度、流行和高分榜单，支持影剧混合排序。",
  icon: "star.circle.fill", // 随便写的一个图标
  
  // 没有 globalParams 了，用户不需要填任何东西
  globalParams: [],
  
  modules: [
    {
      type: "list", 
      id: "chart_trending",
      title: "🔥 实时热度 (Trending)",
      functionName: "loadCharts",
      params: [
        { name: "mode", value: "trending" },
        { 
          name: "type", 
          title: "类型", 
          type: "enumeration", 
          value: "all", // 默认混合
          enumOptions: [
            { title: "全部 (剧+影)", value: "all" },
            { title: "电影", value: "movie" },
            { title: "剧集", value: "tv" }
          ]
        },
        { 
          name: "time", 
          value: "week", 
          title: "时间范围", 
          type: "enumeration", 
          enumOptions:[
            {title:"本周热榜",value:"week"},
            {title:"今日热榜",value:"day"}
          ] 
        }
      ]
    },
    {
      type: "list",
      id: "chart_popular",
      title: "🍿 流行趋势 (Popular)",
      functionName: "loadCharts",
      params: [
        { name: "mode", value: "popular" },
        { 
          name: "type", 
          title: "类型", 
          type: "enumeration", 
          value: "movie", 
          enumOptions: [
            { title: "全部 (剧+影)", value: "all" },
            { title: "电影", value: "movie" },
            { title: "剧集", value: "tv" }
          ]
        }
      ]
    },
    {
      type: "list",
      id: "chart_top",
      title: "⭐ 高分神作 (Top Rated)",
      functionName: "loadCharts",
      params: [
        { name: "mode", value: "top_rated" },
        { 
          name: "type", 
          title: "类型", 
          type: "enumeration", 
          value: "movie", 
          enumOptions: [
            { title: "全部 (剧+影)", value: "all" },
            { title: "电影", value: "movie" },
            { title: "剧集", value: "tv" }
          ]
        }
      ]
    }
  ]
};

// ================= 核心逻辑 =================

// 内置一个公用的 API Key (这是一个通用的公共 Key，通常用于演示)
const API_KEY = "1074a383822137683935391629f64704";
const BASE_URL = "https://api.themoviedb.org/3";

async function loadCharts(params) {
    const { mode, type, time } = params;
    
    // 基础参数
    const queryParams = {
        api_key: API_KEY,
        language: "zh-CN", // 虽然只要ID，但指定语言能确保排除某些特定区域锁定的内容
        page: 1
    };

    try {
        // === 情况 1: Trending (原生支持 mixed) ===
        if (mode === "trending") {
            // 接口格式: /trending/{media_type}/{time_window}
            const url = `${BASE_URL}/trending/${type}/${time || 'week'}`;
            const res = await Widget.http.get(url, { params: queryParams });
            return parseResults(res.data, type);
        }

        // === 情况 2: Popular / Top Rated (需要手动合并 Mixed) ===
        if (type === "all") {
            // 并发请求 Movie 和 TV
            const p1 = Widget.http.get(`${BASE_URL}/movie/${mode}`, { params: queryParams });
            const p2 = Widget.http.get(`${BASE_URL}/tv/${mode}`, { params: queryParams });
            
            const [resMovie, resTV] = await Promise.all([p1, p2]);
            
            // 格式化数据
            const movies = (resMovie.data?.results || []).map(i => ({...i, media_type: 'movie'}));
            const tvs = (resTV.data?.results || []).map(i => ({...i, media_type: 'tv'}));
            
            // 合并数组
            let combined = [...movies, ...tvs];
            
            // 重新排序
            if (mode === 'top_rated') {
                // 按评分降序
                combined.sort((a, b) => b.vote_average - a.vote_average);
            } else {
                // 按热度降序
                combined.sort((a, b) => b.popularity - a.popularity);
            }
            
            // 取前 20 个返回
            return combined.slice(0, 20).map(item => ({
                id: item.id,
                media_type: item.media_type
            }));
            
        } else {
            // 单一类型 (Movie 或 TV)
            const url = `${BASE_URL}/${type}/${mode}`;
            const res = await Widget.http.get(url, { params: queryParams });
            return parseResults(res.data, type);
        }
        
    } catch (e) {
        console.error(e);
        return []; // 失败返回空列表
    }
}

// 辅助函数：将 TMDB 数据转换为 FW 识别的格式
function parseResults(data, forcedType) {
    if (!data || !data.results) return [];
    
    return data.results.map(item => {
        // 如果接口返回的数据里没有 media_type (比如 popular 接口)，我们需要手动补全
        // 如果 forcedType 是 'all'，则 item.media_type 应该本身就有
        // 如果 forcedType 是 'movie' 或 'tv'，则直接使用 forcedType
        const finalType = (forcedType !== 'all') ? forcedType : (item.media_type || 'movie');
        
        return {
            id: item.id,
            media_type: finalType
        };
    });
}
