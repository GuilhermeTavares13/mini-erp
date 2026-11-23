import express from "express";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "inventory-service"
    });
});

app.listen(3001, () => {
    console.log("Inventory Service running on port 3001");
});