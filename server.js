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

const sources = [
  // Monde
  "https://www.france24.com/fr/rss",
  "https://www.rfi.fr/fr/rss",
  "https://feeds.bbci.co.uk/news/rss.xml",

  // Sport
  "https://feeds.bbci.co.uk/sport/rss.xml",
  "https://www.skysports.com/rss/12040",
  "https://www.espn.com/espn/rss/news",

  // Football
  "https://feeds.bbci.co.uk/sport/football/rss.xml",

  // Basket
  "https://feeds.bbci.co.uk/sport/basketball/rss.xml",

  // Boxe
  "https://feeds.bbci.co.uk/sport/boxing/rss.xml",

  // Musique
  "https://www.billboard.com/feed/",

  // Tech
  "https://www.theverge.com/rss/index.xml",

  // Afrique
  "https://www.jeuneafrique.com/feed/"
];

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

        if (!likes[item.link]) likes[item.link] = 0;
        if (!comments[item.link]) comments[item.link] = [];

        allNews.push({
          id: item.link,
          title: item.title,
          content,
          mediaUrl,
          mediaType: isVideo ? 'video' : 'image',
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

loadNews();
setInterval(loadNews, 10 * 60 * 1000);

app.get("/", (req, res) => {
  res.render("index", { news });
});

// 👍 LIKE
app.post("/like", (req, res) => {
  const id = req.body.id;

  if (!likes[id]) likes[id] = 0;
  likes[id]++;

  saveData();

  res.json({ success: true, likes: likes[id] });
});

// 💬 COMMENTAIRE
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

// 🔥 AJOUT IMPORTANT : récupérer tous les commentaires
app.get("/comments/:id", (req, res) => {
  const id = req.params.id;
  res.json(comments[id] || []);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 News Platform running");
});
