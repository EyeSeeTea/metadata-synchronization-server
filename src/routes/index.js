import express from "express";

const router = express.Router();

router.get("/api", function (req, res) {
    res.json({});
});

router.get("/", function (req, res) {
    res.end("Metadata Synchronization");
});

export default router;
