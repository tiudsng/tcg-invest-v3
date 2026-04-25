import express from "express";

const app = express();
app.get("/test", (req, res) => {
   res.json({
      key: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) + '...' : 'undefined',
      fullKeyLength: process.env.GEMINI_API_KEY?.length || 0
   });
});

app.listen(3001, () => {
    console.log("Listening on 3001");
});
