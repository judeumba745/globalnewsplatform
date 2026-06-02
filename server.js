const express = require("express");
const cors = require("cors");
const Parser = require("rss-parser");
const fetch = require("node-fetch");

const app = express();
const parser = new Parser();

app.use(cors());
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static("public"));

// 🧠 DATA
let news = [];
let likes = {};
let comments = {};

// 🌍 SOURCES
const sources = [
  "https://www.france24.com/fr/rss",
  "https://www.rfi.fr/fr/rss"
];

// 🌍 TRADUCTION API
async function translate(text, target = "fr") {
  try {
    const res = await fetch("https://libretranslate.de/translate", {
      method: "POST",
      body: JSON.stringify({
        q: text,
        source: "auto",
        target,
        format: "text"
      }),
      headers: { "Content-Type": "application/json" }
    });

    const data = await res.json();
    return data.translatedText || text;
  } catch (err) {
    return text;
  }
}

// 📰 LOAD NEWS + TRADUCTION
async function loadNews() {
  let allNews = [];

  for (let url of sources) {
    try {
      const feed = await parser.parseURL(url);

      feed.items.forEach(item => {
        allNews.push({
          id: item.link,
          title: item.title,
          content: item.contentSnippet,
          link: item.link,
          source: feed.title,
          date: item.pubDate
        });
      });

    } catch (err) {
      console.log("Erreur source :", url);
    }
  }

  // 🌍 TRADUCTION DES NEWS
  news = await Promise.all(
    allNews.map(async (n) => {
      return {
        ...n,
        title: await translate(n.title, "fr"),
        content: await translate(n.content, "fr")
      };
    })
  );

  console.log("News mises à jour :", news.length);
}

// 🔥 TRENDING SYSTEM
function getTrendingNews() {
  return news
    .map(n => ({
      ...n,
      likesCount: likes[n.id] || 0
    }))
    .sort((a, b) => b.likesCount - a.likesCount);
}

// 🚀 INIT
loadNews();
setInterval(loadNews, 5 * 60 * 1000);

// 🏠 HOME PAGE
app.get("/", (req, res) => {
  const trending = getTrendingNews();
  res.render("index", { news: trending, likes, comments });
});

// 🔥 TRENDING PAGE
app.get("/trending", (req, res) => {
  const trending = getTrendingNews();
  res.render("index", { news: trending, likes, comments });
});

// 📡 API NEWS
app.get("/api/news", (req, res) => {
  res.json(news);
});

// 👍 LIKE
app.post("/like", (req, res) => {
  const id = req.body.id;

  if (!likes[id]) likes[id] = 0;

  likes[id]++;

  res.json({ success: true, likes: likes[id] });
});

// 💬 COMMENTAIRES
app.post("/comment", (req, res) => {
  const { id, text } = req.body;

  if (!comments[id]) {
    comments[id] = [];
  }

  comments[id].push({
    text,
    date: new Date()
  });

  res.json({ success: true });
});

// 🚀 SERVER START
app.listen(3000, () => {
  console.log("🚀 News Platform running on http://localhost:3000");
});