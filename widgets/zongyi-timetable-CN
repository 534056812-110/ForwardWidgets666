WidgetMetadata = {
  id: "china.variety.show.time",
  title: "中国综艺时刻表",
  author: "𝙈𝙖𝙠𝙠𝙖𝙋𝙖𝙠𝙠𝙖",
  description: "汇聚全网热门中国综艺，智能筛选今日更新内容，不错过每一期快乐",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  modules: [
    {
      title: "综艺更新",
      functionName: "loadVarietySchedule",
      type: "list",
      requiresWebView: false,
      params: [
        {
          name: "apiKey",
          title: "TMDB API Key (必填)",
          type: "input",
          description: "用于匹配高清封面和 Emby ID",
        },
        {
          name: "day",
          title: "查看时间",
          type: "enumeration",
          value: "today",
          enumOptions: [
            { title: "今日更新", value: "today" },
            { title: "全网热播 (Top 30)", value: "hot" }
          ]
        },
        {
          name: "platform",
          title: "平台筛选",
          type: "enumeration",
          value: "all",
          enumOptions: [
            { title: "全部平台", value: "all" },
            { title: "芒果TV (Mango)", value: "imgo" },
            { title: "腾讯视频 (Tencent)", value: "qq" },
            { title: "爱奇艺 (iQIYI)", value: "qiyi" },
            { title: "优酷 (Youku)", value: "youku" }
          ]
        }
      ]
    }
  ]
};

async function loadVarietySchedule(params = {}) {
  const apiKey = params.apiKey;
  if (!apiKey) {
    return [{ id: "err", title: "❌ 请填写 API Key", type: "text" }];
  }

  const mode = params.day || "today";
  const targetPlatform = params.platform || "all";

  // 1. 获取全网热门综艺
  const hotShows = await fetchHotVarieties();
  
  if (hotShows.length === 0) {
    return [{ id: "empty", title: "数据获取失败", type: "text" }];
  }

  // 2. 筛选逻辑
  let filteredShows = hotShows;

  // 2.1 平台筛选
  if (targetPlatform !== "all") {
      filteredShows = filteredShows.filter(show => {
          // 检查 playlinks 是否包含目标平台 key
          return show.playlinks && show.playlinks[targetPlatform];
      });
  }

  // 2.2 日期筛选 (今日更新)
  if (mode === "today") {
      const weekDay = getWeekDay(); // 获取今天是 "周五"
      
      filteredShows = filteredShows.filter(show => {
          // A. 优先从 upinfo (更新信息) 中匹配
          // 例如 "每周五20点更新"
          if (show.upinfo && show.upinfo.includes(weekDay)) {
              return true;
          }
          // B. 其次看是否是每日更新 (新闻类/日更类)
          if (show.upinfo && (show.upinfo.includes("日更") || show.upinfo.includes("每天"))) {
              return true;
          }
          // C. 宽松匹配: 如果 upinfo 包含今天的日期 (例如 "更新至2024-05-24")
          const todayDate = getTodayDateStr(); // "2024-05-24"
          // 去掉年份 "05-24"
          const shortDate = todayDate.substring(5); 
          // 去掉横杠 "0524"
          const compactDate = shortDate.replace("-", ""); 
          
          if (show.upinfo && (show.upinfo.includes(todayDate) || show.upinfo.includes(shortDate) || show.upinfo.includes(compactDate))) {
              return true;
          }
          
          return false;
      });
  }

  if (filteredShows.length === 0) {
      return [{ 
          id: "no_update", 
          title: "💤 今日该平台无热综更新", 
          subTitle: "尝试切换到'全网热播'查看更多", 
          type: "text" 
      }];
  }

  // 3. TMDB 匹配 (前 15 个)
  console.log(`[Variety] Matched ${filteredShows.length} shows. Searching TMDB...`);
  
  const searchPromises = filteredShows.slice(0, 15).map(show => {
      // 传递原始信息用于兜底
      return searchTmdb(show.title, apiKey, show.upinfo, show.poster);
  });

  const finalItems = await Promise.all(searchPromises);
  return finalItems.filter(r => r !== null);
}

// ==========================================
// 数据源：360 综艺榜
// ==========================================
async function fetchHotVarieties() {
    // cat=3 代表综艺
    const url = "https://api.web.360kan.com/v1/rank?cat=3";
    try {
        const res = await Widget.http.get(url);
        const data = (typeof res === 'string') ? JSON.parse(res) : (res.data || res);
        return data.data || [];
    } catch (e) {
        return [];
    }
}

// ==========================================
// TMDB 匹配
// ==========================================
async function searchTmdb(queryTitle, apiKey, upinfo, originalPoster) {
    // 清洗标题：去掉 "第x季"、"2024" 等干扰
    const cleanTitle = queryTitle.replace(/第.季/g, "").replace(/\d{4}/g, "").split(" ")[0];
    
    const url = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(cleanTitle)}&language=zh-CN`;

    try {
        const res = await Widget.http.get(url);
        const data = res.data || res;

        // 构造基础对象
        let item = {
            id: `variety_${Math.random().toString(36).substr(2, 9)}`, // 临时ID
            type: "tmdb",
            mediaType: "tv",
            title: queryTitle, // 使用原始全名 (含季数)
            subTitle: upinfo || "正在热播",
            posterPath: originalPoster, // 默认用国内源的图
            backdropPath: "",
            rating: "0.0",
            tmdbId: 0
        };

        if (data.results && data.results.length > 0) {
            const match = data.results[0];
            item.id = String(match.id);
            item.tmdbId = parseInt(match.id);
            // 如果 TMDB 有图，优先用 TMDB (更高清)
            if (match.poster_path) item.posterPath = `https://image.tmdb.org/t/p/w500${match.poster_path}`;
            if (match.backdrop_path) item.backdropPath = `https://image.tmdb.org/t/p/w780${match.backdrop_path}`;
            if (match.vote_average) item.rating = match.vote_average.toFixed(1);
            
            // 在 description 中显示来源
            item.description = `更新: ${upinfo || "未知"} | Emby可搜`;
        } else {
            // TMDB 没搜到，但也显示出来，只是不能跳转 Emby
            // 修改 type 防止点击报错
            item.type = "text"; 
            item.description = `更新: ${upinfo} (TMDB未收录)`;
        }
        
        return item;

    } catch (e) { return null; }
}

// ==========================================
// 时间工具
// ==========================================
function getWeekDay() {
    const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return days[new Date().getDay()];
}

function getTodayDateStr() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}
