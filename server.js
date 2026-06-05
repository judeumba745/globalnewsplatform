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
const NEWS_FILE = "./news.json";

let likes = {};
let comments = {};

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

function loadNewsHistory() {
  if (fs.existsSync(NEWS_FILE)) {
    news = JSON.parse(fs.readFileSync(NEWS_FILE));
  }
}

function saveNewsHistory() {
  fs.writeFileSync(NEWS_FILE, JSON.stringify(news, null, 2));
}

loadNewsHistory();

// =======================
// RSS SOURCES
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
// VIDEO EXTRACT
// =======================
function extractVideo(html) {
  if (!html) return null;

  let match = html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;

  match = html.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;

  match = html.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;

  match = html.match(/dailymotion\.com\/embed\/video\/([a-zA-Z0-9]+)/);
  if (match) return `https://www.dailymotion.com/embed/video/${match[1]}`;

  return null;
}

// =======================
// LOAD NEWS
// =======================
async function loadNews() {
  let allNews = [];

  for (let url of sources) {
    try {
      const feed = await parser.parseURL(url);

      for (let item of feed.items.slice(0, 10)) {
        let mediaUrl = item.enclosure?.url || "";
        let mediaType = item.enclosure?.type || "";

        let videoUrl = extractVideo(item.content || item.description);
        if (videoUrl) {
          mediaUrl = videoUrl;
          mediaType = "video/mp4";
        }

        let isVideo =
          mediaType.includes("video") ||
          mediaUrl.includes("youtube") ||
          mediaUrl.includes("dailymotion");

        let content = item.content || item.contentSnippet || item.description || "";

        if (!likes[item.link]) likes[item.link] = 0;
        if (!comments[item.link]) comments[item.link] = [];

        const alreadyExists = news.find(n => n.id === item.link);

        if (alreadyExists) continue;

        allNews.push({
          id: item.link,
          title: item.title,
          content,
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
      console.log("Erreur RSS:", url);
    }
  }

 news = [...news, ...allNews];

const now = Date.now();

news = news.filter(article => {
  const age = now - new Date(article.date).getTime();
  return age < 30 * 24 * 60 * 60 * 1000;
});

news.sort((a, b) => new Date(b.date) - new Date(a.date));

saveNewsHistory();

  console.log("News chargées:", news.length);
}

loadNews();
setInterval(loadNews, 10 * 60 * 1000);

// =======================
// ROUTES
// =======================
app.get("/", (req, res) => {
  res.render("index", { news });
});

app.post("/like", (req, res) => {
  const id = req.body.id;
  likes[id] = (likes[id] || 0) + 1;
  saveData();
  res.json({ likes: likes[id] });
});

app.post("/comment", (req, res) => {
  const { id, text } = req.body;
  if (!comments[id]) comments[id] = [];
  comments[id].push({ text, date: new Date() });
  saveData();
  res.json({ ok: true });
});

app.get("/reactions/:id", (req, res) => {
  const id = req.params.id;
  res.json({
    likes: likes[id] || 0,
    comments: comments[id] || []
  });
});

app.listen(3000, "0.0.0.0", () => {
  console.log("🚀 Server running");
});
