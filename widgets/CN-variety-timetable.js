WidgetMetadata = {
  id: "cn.variety.time.table",
  title: "国产综艺时刻表",
  author: "𝙈𝙖𝙠𝙠𝙖𝙋𝙖𝙠𝙠𝙖",
  description: "展示今日更新的国产综艺/真人秀",
  version: "2.0.0",
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
          description: "必须填写",
        },
        {
          name: "mode",
          title: "查看时间",
          type: "enumeration",
          value: "today",
          enumOptions: [
            { title: "今日更新 (Today)", value: "today" },
            { title: "明日预告 (Tomorrow)", value: "tomorrow" },
            { title: "本周热播 (Week)", value: "week" } // 展示本周内更新的所有综艺
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

  const mode = params.mode || "today";
  
  // 1. 计算日期
  const dates = getDateRange(mode);
  console.log(`[Variety] Dates: ${dates.start} ~ ${dates.end}`);

  // 2. 构建 TMDB 查询 URL
  // with_origin_country=CN: 锁定国产
  // with_genres=10764|10767: 10764(真人秀), 10767(脱口秀) - 涵盖绝大多数综艺
  // sort_by=popularity.desc: 按热度排序，把大热综排前面
  // air_date.gte/lte: 锁定播出日期
  
  const url = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&language=zh-CN&sort_by=popularity.desc&include_null_first_air_dates=false&page=1&timezone=Asia/Shanghai&with_origin_country=CN&with_genres=10764|10767&air_date.gte=${dates.start}&air_date.lte=${dates.end}`;

  try {
    const res = await Widget.http.get(url);
    const data = res.data || res;

    if (!data.results || data.results.length === 0) {
      return [{ 
          id: "empty", 
          title: "💤 今日无综艺更新", 
          subTitle: "TMDB 显示今日暂无国产综艺排期", 
          type: "text" 
      }];
    }

    // 3. 格式化输出
    // 为了显示具体是哪一期，我们需要再去查一下详情 (可选，为了速度也可以不查)
    // 这里为了体验，我们尽量展示 "第几期"
    
    // 并发查询最新一集的详情 (仅对前5个热门的查，防止太慢)
    const detailedItems = await Promise.all(data.results.map(async (show, index) => {
        let episodeInfo = "";
        
        // 只对前 5 个热门综艺查具体集数信息
        if (index < 5) {
            episodeInfo = await getEpisodeInfo(show.id, apiKey, dates.start);
        }

        return {
            id: String(show.id),
            tmdbId: parseInt(show.id),
            type: "tmdb",
            mediaType: "tv",
            
            title: show.name,
            subTitle: episodeInfo || (show.overview ? show.overview : "正在热播"),
            
            posterPath: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : "",
            backdropPath: show.backdrop_path ? `https://image.tmdb.org/t/p/w780${show.backdrop_path}` : "",
            
            rating: show.vote_average ? show.vote_average.toFixed(1) : "0.0",
            year: (show.first_air_date || "").substring(0, 4),
            description: `更新日期: ${dates.start === dates.end ? "今日" : "本周"}`
        };
    }));

    return detailedItems;

  } catch (e) {
    return [{ id: "err_net", title: "网络错误", subTitle: e.message, type: "text" }];
  }
}

// ==========================================
// 辅助：获取集数详情
// ==========================================
async function getEpisodeInfo(showId, apiKey, targetDate) {
    const url = `https://api.themoviedb.org/3/tv/${showId}?api_key=${apiKey}&language=zh-CN`;
    try {
        const res = await Widget.http.get(url);
        const data = res.data || res;
        
        // 检查上一集 (刚刚播出的)
        if (data.last_episode_to_air) {
            const ep = data.last_episode_to_air;
            // 如果播出日期匹配 (或者接近，比如时区差异)
            if (ep.air_date === targetDate) {
                return `🆕 第${ep.season_number}季 第${ep.episode_number}期: ${ep.name}`;
            }
        }
        // 检查下一集 (即将播出的)
        if (data.next_episode_to_air) {
            const ep = data.next_episode_to_air;
            if (ep.air_date === targetDate) {
                return `🔜 第${ep.season_number}季 第${ep.episode_number}期: ${ep.name}`;
            }
        }
        return "";
    } catch(e) { return ""; }
}

// ==========================================
// 日期工具
// ==========================================
function getDateRange(mode) {
    const today = new Date();
    const toStr = (d) => d.toISOString().split('T')[0];

    if (mode === "today") {
        return { start: toStr(today), end: toStr(today) };
    }
    if (mode === "tomorrow") {
        const tmr = new Date(today);
        tmr.setDate(today.getDate() + 1);
        return { start: toStr(tmr), end: toStr(tmr) };
    }
    if (mode === "week") {
        // 本周: 从今天开始往后7天
        const end = new Date(today);
        end.setDate(today.getDate() + 6);
        return { start: toStr(today), end: toStr(end) };
    }
    return { start: toStr(today), end: toStr(today) };
}
