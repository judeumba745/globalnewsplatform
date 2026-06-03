const express = require("express");
const cors = require("cors");
const Parser = require("rss-parser");
const fs = require("fs");

const app = express();
const parser = new Parser();

app.use(cors());
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static("public"));

let news = [];
let likes = {};
let comments = {};

let language = "fr";
let lastloadedNews = [];

const DATA_FILE = "./data.json";

// =======================
// SAVE / LOAD
// =======================
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ likes, comments }, null, 2));
}

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(DATA_FILE));
    likes = data.likes || {};
    comments = data.comments || {};
  }
}

loadData();

// =======================
// 🌍 TRANSLATION
// =======================
async function translate(text, targetLang) {
  if (!text) return "";

  if (targetLang === "fr") return text;

  try {
    const res = await fetch("https://libretranslate.com/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "auto",
        target: targetLang,
        format: "text"
      })
    });

    const data = await res.json();
    return data.translatedText || text;
  } catch (err) {
    return text;
  }
}

// =======================
// SOURCES RSS
// =======================
const sources = [
  "https://www.france24.com/fr/rss",
  "https://www.rfi.fr/fr/rss",
  "https://feeds.bbci.co.uk/news/rss.xml",
  "https://feeds.bbci.co.uk/sport/rss.xml",
  "https://www.skysports.com/rss/12040",
  "https://www.espn.com/espn/rss/news",
  "https://feeds.bbci.co.uk/sport/football/rss.xml",
  "https://feeds.bbci.co.uk/sport/basketball/rss.xml",
  "https://feeds.bbci.co.uk/sport/boxing/rss.xml",
  "https://www.billboard.com/feed/",
  "https://www.theverge.com/rss/index.xml",
  "https://www.jeuneafrique.com/feed/"
];

// =======================
// LOAD NEWS
// =======================
async function loadNews() {
  let allNews = [];

  for (let url of sources) {
    try {
      const feed = await parser.parseURL(url);

      for (let item of feed.items.slice(0, 15)) {

        let media = item['media:content'] || [item.enclosure] || [];
        let mediaUrl = media[0]?.url || item.enclosure?.url || "";
        let mediaType = media[0]?.type || item.enclosure?.type || "";

        let isVideo =
          mediaType.includes('video') ||
          mediaUrl.includes('.mp4') ||
          mediaUrl.includes('youtube') ||
          mediaUrl.includes('dailymotion');

        let content = item.content || item.contentSnippet || item.description || "";

        // 👍 init reactions
        if (!likes[item.link]) likes[item.link] = 0;
        if (!comments[item.link]) comments[item.link] = [];

        // 🌍 TRANSLATION (TITLE + CONTENT ONLY)
        let titleFinal = item.title;
        let contentFinal = content;

        if (language !== "fr") {
          titleFinal = await translate(item.title, language);
          contentFinal = await translate(content, language);
        }

        allNews.push({
          id: item.link,
          title: titleFinal,
          content: contentFinal,
          mediaUrl,
          mediaType: isVideo ? "video" : "image",
          link: item.link,
          source: feed.title,
          date: item.pubDate,
          likes: likes[item.link],
          comments: comments[item.link].length
        });
      }
    } catch (err) {
      console.log("Erreur source :", url);
    }
  }

  news = allNews;
}

// =======================
// AUTO REFRESH
// =======================
loadNews();
setInterval(loadNews, 10 * 60 * 1000);

// =======================
// ROUTES
// =======================
app.get("/", (req, res) => {
  res.render("index", { news });
});

app.post("/set-language", (req, res) => {
  language = req.body.lang || "fr";
  loadNews();
  res.json({ success: true });
});

// 👍 LIKE
app.post("/like", (req, res) => {
  const id = req.body.id;

  if (!likes[id]) likes[id] = 0;
  likes[id]++;

  saveData();

  res.json({ success: true, likes: likes[id] });
});

// 💬 COMMENT
app.post("/comment", (req, res) => {
  const { id, text } = req.body;

  if (!comments[id]) comments[id] = [];

  comments[id].push({ text, date: new Date() });

  saveData();

  res.json({ success: true, count: comments[id].length });
});

app.get("/reactions/:id", (req, res) => {
  const id = req.params.id;

  res.json({
    likes: likes[id] || 0,
    comments: comments[id] || []
  });
});

app.get("/comments/:id", (req, res) => {
  const id = req.params.id;
  res.json(comments[id] || []);
});

// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 News Platform running");
});
