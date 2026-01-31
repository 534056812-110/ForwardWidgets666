// 核心配置：定义组件信息
WidgetMetadata = {
  id: "douban_pro_standalone_v1",
  title: "豆瓣我看 (Pro独立版)",
  author: "Gemini",
  description: "独立运行的豆瓣增强组件。支持按【剧集更新时间】和【首播年份】重新排序。",
  // 图标建议使用 douban 或 movie
  modules: [
    {
      title: "豆瓣片单 Pro",
      requiresWebView: false,
      functionName: "loadDoubanInterestPro",
      cacheDuration: 3600, // 缓存1小时
      params: [
        {
          name: "user_id",
          title: "豆瓣 ID (必填)",
          type: "input",
          description: "数字ID或个性域名ID",
        },
        {
          name: "status",
          title: "筛选状态",
          type: "enumeration",
          defaultValue: "mark",
          enumOptions: [
            { title: "想看 (Mark)", value: "mark" },
            { title: "在看 (Doing)", value: "doing" },
            { title: "看过 (Done)", value: "done" }
          ],
        },
        {
          name: "sort_mode",
          title: "排序模式",
          type: "enumeration",
          defaultValue: "default",
          enumOptions: [
            { title: "📌 默认 (豆瓣原序)", value: "default" },
            { title: "📅 按最新更新 (追剧)", value: "update" },
            { title: "🆕 按首播/上映时间", value: "release" }
          ]
        },
        {
          name: "page",
          title: "页码",
          type: "page"
        }
      ],
    }
  ],
};

// ==========================================
// 常量定义 (模仿原脚本的 Headers)
// ==========================================
const DOUBAN_HEADERS = {
  "Referer": "https://m.douban.com/movie",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
};

// ==========================================
// 主逻辑函数
// ==========================================
async function loadDoubanInterestPro(params) {
  const { user_id, status = "mark", sort_mode = "default", page = 1 } = params;

  if (!user_id) {
    return [{ title: "请填写豆瓣ID", subTitle: "点击组件配置进行填写", type: "text" }];
  }

  // 1. 请求豆瓣接口 (核心逻辑复刻)
  // 豆瓣分页通常是 count=15 或 20
  const count = 15;
  const start = (page - 1) * count;
  const url = `https://m.douban.com/rexxar/api/v2/user/${user_id}/interests?type=${status}&count=${count}&order_by=time&start=${start}&ck=&for_mobile=1`;

  try {
    const res = await Widget.http.get(url, { headers: DOUBAN_HEADERS });
    const data = JSON.parse(res.body || res.data);

    // 错误处理
    if (data.msg === "user_not_found" || data.code === 1001) {
        return [{ title: "用户不存在", subTitle: "请检查豆瓣ID是否正确", type: "text" }];
    }
    
    const interests = data.interests || [];
    if (interests.length === 0) {
      return [{ title: "列表为空", subTitle: "没有获取到更多数据", type: "text" }];
    }

    // 2. 数据初步格式化
    let items = interests.map(i => {
      const subject = i.subject || {};
      const isMovie = subject.type === "movie";
      // 优先获取高清封面
      const poster = subject.pic?.large || subject.pic?.normal || subject.cover_url || "";
      
      return {
        doubanId: subject.id,
        title: subject.title,
        original_title: subject.original_title,
        year: subject.year,
        pic: poster,
        rating: subject.rating?.value || "0.0",
        type: isMovie ? "movie" : "tv", // 统一类型
        comment: i.comment,
        // 默认排序字段初始化
        sortDate: "1900-01-01" 
      };
    });

    // 3. 如果需要特殊排序，进行数据增强 (查询 TMDB)
    if (sort_mode !== "default") {
      items = await enrichItemsWithTime(items, sort_mode);
      
      // 执行本地排序
      if (sort_mode === "update") {
        // 倒序：最近更新的在上面
        items.sort((a, b) => {
            if (a.sortDate === b.sortDate) return 0;
            return a.sortDate < b.sortDate ? 1 : -1;
        });
      } else if (sort_mode === "release") {
        // 倒序：最近上映的在上面
        items.sort((a, b) => {
            if (a.sortDate === b.sortDate) return 0;
            return a.sortDate < b.sortDate ? 1 : -1;
        });
      }
    }

    // 4. 构建最终卡片
    return items.map(item => buildCard(item, sort_mode));

  } catch (e) {
    console.error(e);
    return [{ title: "请求出错", subTitle: "网络错误或API受限", type: "text" }];
  }
}

// ==========================================
// 数据增强：去 TMDB 查具体时间
// ==========================================
async function enrichItemsWithTime(items, sortMode) {
  // 使用 Promise.all 并发请求，速度更快
  const tasks = items.map(async (item) => {
    try {
      // A. 搜索对应条目 (使用中文搜索)
      const searchRes = await Widget.tmdb.search(item.title, item.type, { language: "zh-CN" });
      const results = searchRes.results || [];
      
      let match = null;
      if (results.length > 0) {
        // 简单的年份校对，防止搜错
        const targetYear = parseInt(item.year);
        match = results.find(r => {
          const rDate = r.first_air_date || r.release_date || "0000";
          const rYear = parseInt(rDate.substring(0, 4));
          return Math.abs(rYear - targetYear) <= 2; // 允许2年误差
        });
        if (!match) match = results[0]; // 没匹配到年份就取第一个
      }

      if (match) {
        item.tmdbId = match.id; // 存入 TMDB ID

        if (item.type === "tv") {
            // 如果是剧集，需要查详情获取“下一集”或“最后一集”
            const detail = await Widget.tmdb.get(`/tv/${match.id}`, { params: { language: "zh-CN" } });
            
            if (sortMode === "update") {
                // 优先找下一集，没有则找上一集
                const ep = detail.next_episode_to_air || detail.last_episode_to_air;
                if (ep) {
                   item.sortDate = ep.air_date;
                   const isNext = !!detail.next_episode_to_air;
                   item.displayTime = `${isNext ? '🔜' : '🔥'} ${formatDate(ep.air_date)} S${ep.season_number}E${ep.episode_number}`;
                } else {
                   item.sortDate = detail.first_air_date || "1900-01-01";
                   item.displayTime = `${formatDate(item.sortDate)} 首播`;
                }
            } else {
                // 按首播时间
                item.sortDate = detail.first_air_date || "1900-01-01";
                item.displayTime = `📅 ${item.sortDate}`;
            }
        } else {
            // 电影
            item.sortDate = match.release_date || "1900-01-01";
            item.displayTime = `🎬 ${item.sortDate} 上映`;
        }
      }
    } catch (e) {
      // 单个失败不影响整体
      console.log(`Search failed for ${item.title}`);
    }
    return item;
  });

  return await Promise.all(tasks);
}

// ==========================================
// 工具与 UI
// ==========================================

function buildCard(item, sortMode) {
  let subTitle = "";
  let genreTitle = "";

  if (sortMode !== "default" && item.displayTime) {
      // 如果有增强的时间数据
      subTitle = item.displayTime;
      genreTitle = item.year + "";
  } else {
      // 默认显示逻辑
      subTitle = item.rating > 0 ? `评分: ${item.rating}` : (item.original_title || "暂无评分");
      if (item.comment) subTitle = `💬 ${item.comment}`; // 有短评显示短评
      genreTitle = item.year + "";
  }

  return {
    id: `db_pro_${item.doubanId}`,
    // 赋予 TMDB ID，点击后可联动其他资源
    tmdbId: item.tmdbId || null,
    type: "tmdb",
    mediaType: item.type,
    
    title: item.title,
    subTitle: subTitle,
    genreTitle: genreTitle,
    
    posterPath: item.pic,
    description: item.original_title || "",
    // 如果没找到 TMDB ID，点击跳转网页
    url: `https://m.douban.com/${item.type}/${item.doubanId}/` 
  };
}

function formatDate(str) {
    if (!str) return "";
    return str.substring(5); // 2024-05-20 -> 05-20
}
