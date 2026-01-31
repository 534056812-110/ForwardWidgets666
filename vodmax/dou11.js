/**
 * 动态 UI 示例模块
 * 参考“热门精选.js”实现的横竖版副标题切换逻辑
 */
WidgetMetadata = {
  id: "dynamic_ui_demo",
  title: "动态副标题示例",
  author: "Gemini",
  version: "1.0.0",
  
  modules: [
    {
      title: "今日推荐 (横版)",
      functionName: "loadHomeData",
      type: "video" // 默认 UI
    },
    {
      title: "热播榜单 (竖版)",
      functionName: "loadRankingData",
      type: "video"
    }
  ]
};

/**
 * 首页数据 - 对应横版 UI
 */
async function loadHomeData(params) {
  const data = await fetchMockData();
  // 强制指定为横版比例，并按“年份 · 类型”处理副标题
  return parseItems(data, 1.77);
}

/**
 * 榜单数据 - 对应竖版 UI
 */
async function loadRankingData(params) {
  const data = await fetchMockData();
  // 强制指定为竖版比例，并按“完整日期”处理副标题
  return parseItems(data, 0.75);
}

/**
 * 核心解析函数 (参考你的逻辑)
 * @param {Array} items 原始数据
 * @param {Number} ratio 目标比例
 */
function parseItems(items, ratio) {
  return items.map(item => {
    const dateObj = new Date(item.pubDate);
    const year = dateObj.getFullYear();
    const fullDate = item.pubDate; // 2026-01-21
    const genre = item.category || "影视";

    // 关键逻辑：根据 ratio 判断副标题格式
    let subTitle = "";
    if (ratio > 1) { 
      // 横版：2026 · 科幻
      subTitle = `${year} · ${genre}`;
    } else {
      // 竖版：2026-01-21
      subTitle = fullDate;
    }

    return {
      id: item.id.toString(),
      title: item.title,
      description: subTitle, // 这里的 description 对应 UI 上的副标题
      coverUrl: item.img,
      coverRatio: ratio,     // 设置比例
      type: "link",
      link: item.url
    };
  });
}

/**
 * 模拟数据请求
 */
async function fetchMockData() {
  return [
    {
      id: 101,
      title: "流浪地球 3",
      pubDate: "2026-01-21",
      category: "科幻",
      img: "https://p.pstatp.com/origin/1376d0001088661642236", // 示例图
      url: "https://example.com/m/1"
    },
    {
      id: 102,
      title: "异形：罗慕路斯",
      pubDate: "2024-08-16",
      category: "惊悚",
      img: "https://p.pstatp.com/origin/137a60000bd962f3ec051",
      url: "https://example.com/m/2"
    }
  ];
}
