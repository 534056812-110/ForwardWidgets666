WidgetMetadata = {
  id: "gemini.trakt.random.mix.v3",
  title: "Trakt 惊喜推荐 (Max版)",
  author: "Gemini",
  description: "从最近观看的 30 部剧中随机抽取 5 部进行混合推荐，12h 刷新",
  version: "3.0.0",
  requiredVersion: "0.0.1",
  modules: [
    {
      title: "今日惊喜推荐",
      functionName: "loadRandomMix",
      type: "list",
      requiresWebView: false,
      // 缓存 12 小时 (43200秒)
      cacheDuration: 43200, 
      params: [
        {
          name: "apiKey",
          title: "TMDB API Key (必填)",
          type: "input",
          description: "用于获取图片",
        },
        {
          name: "traktUser",
          title: "Trakt 用户名 (必填)",
          type: "input",
          description: "Trakt Slug",
        },
        {
          name: "clientId",
          title: "Trakt Client ID (选填)",
          type: "input",
          description: "建议填入以防限流",
        }
      ]
    }
  ]
};

async function loadRandomMix(params = {}) {
  const apiKey = params.apiKey;
  const username = params.traktUser;
  // 内置一个公共 ID 方便测试，但强烈建议填自己的
  const clientId = params.clientId || "003666572e92c4331002a28114387693994e43f5454659f81640a232f08a5996";

  if (!apiKey || !username) {
    return [{ id: "err", title: "❌ 参数缺失", subTitle: "请填写 Key 和 用户名", type: "text" }];
  }

  // 1. 获取去重后的观看历史池 (Max 100 条记录 -> 提取 unique shows)
  const uniqueShows = await fetchUniqueHistory(username, clientId);

  if (uniqueShows.length === 0) {
    return [{ id: "err_empty", title: "🤔 暂无记录", subTitle: "Trakt 历史为空或账号私密", type: "text" }];
  }

  // 2. 截取最近的 30 部 (如果不足 30 就取全部)
  const candidatePool = uniqueShows.slice(0, 30);
  console.log(`[Mix] Pool size: ${uniqueShows.length}, Candidate size: ${candidatePool.length}`);

  // 3. 随机抽取 5 部 (如果不足 5 部就全选)
  const pickCount = Math.min(candidatePool.length, 5);
  const seeds = getRandomSeeds(candidatePool, pickCount);
  
  // 打印日志方便调试
  const seedTitles = seeds.map(s => s.title).join(", ");
  console.log(`[Mix] Selected Seeds (${pickCount}): ${seedTitles}`);

  // 4. 并发获取这 5 部剧的推荐
  // Promise.all 会等待所有请求完成
  const promiseList = seeds.map(seed => fetchTmdbRecs(seed, apiKey));
  const resultsArray = await Promise.all(promiseList);

  // 5. 混合洗牌算法 (Interleave)
  // 将 5 组推荐结果像洗扑克牌一样交叉合并
  // [A1, B1, C1, D1, E1, A2, B2...]
  const mixedList = [];
  
  // 找出最长的一组推荐结果
  let maxRecsLen = 0;
  for (const list of resultsArray) {
      if (list.length > maxRecsLen) maxRecsLen = list.length;
  }

  // 交叉循环
  for (let i = 0; i < maxRecsLen; i++) {
      for (const list of resultsArray) {
          if (i < list.length) {
              // 再次去重 (防止不同种子推荐了同一部剧)
              const item = list[i];
              // 简单的去重检查：检查当前 mixedList 里是否已经有了这个 ID
              const exists = mixedList.some(exist => exist.tmdbId === item.tmdbId);
              if (!exists) {
                  mixedList.push(item);
              }
          }
      }
  }

  // 限制最终展示数量 (例如 20 个)
  const finalItems = mixedList.slice(0, 20);

  if (finalItems.length === 0) {
    return [{ id: "err_tmdb", title: "无推荐结果", subTitle: "TMDB 暂无相关推荐数据", type: "text" }];
  }

  return finalItems;
}

// ==========================================
// 辅助逻辑
// ==========================================

// 1. 获取并去重的核心函数
async function fetchUniqueHistory(username, clientId) {
  // 这里的 limit=100 是指获取 100 条观看记录 (Episode Plays)
  // 这是为了更有可能凑齐 30 部不同的剧
  const url = `https://api.trakt.tv/users/${username}/history/shows?limit=100`;
  
  try {
    const res = await Widget.http.get(url, {
      headers: {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": clientId
      }
    });
    
    const data = res.data || res;
    if (!Array.isArray(data)) return [];

    // 使用 Map 进行去重 (Key: tmdb_id)
    const uniqueMap = new Map();
    
    for (const item of data) {
        const show = item.show;
        // 必须有 TMDB ID 才有意义
        if (show && show.ids && show.ids.tmdb) {
            if (!uniqueMap.has(show.ids.tmdb)) {
                uniqueMap.set(show.ids.tmdb, {
                    tmdbId: show.ids.tmdb,
                    title: show.title
                });
            }
        }
    }
    
    // Map 转 Array
    return Array.from(uniqueMap.values());

  } catch (e) {
    console.error("Trakt History Error:", e);
    return [];
  }
}

// 2. 随机抽取算法
function getRandomSeeds(array, count) {
  // 创建副本以免修改原数组
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// 3. TMDB 推荐获取
async function fetchTmdbRecs(seedItem, apiKey) {
  // 使用 recommendations 接口
  const url = `https://api.themoviedb.org/3/tv/${seedItem.tmdbId}/recommendations?api_key=${apiKey}&language=zh-CN&page=1`;
  
  try {
    const res = await Widget.http.get(url);
    const data = res.data || res;
    
    if (!data.results) return [];

    // 每部种子剧只取前 5 个高分推荐，保证质量
    return data.results.slice(0, 5).map(item => ({
      id: String(item.id),
      tmdbId: parseInt(item.id),
      type: "tmdb",
      mediaType: "tv",
      
      title: item.name || item.title,
      
      posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
      backdropPath: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : "",
      
      rating: item.vote_average ? item.vote_average.toFixed(1) : "0.0",
      year: (item.first_air_date || "").substring(0, 4),
      
      // 显示推荐来源
      description: `源于: 《${seedItem.title}》`,
      subTitle: item.overview || ""
    }));
  } catch (e) {
    return [];
  }
}
