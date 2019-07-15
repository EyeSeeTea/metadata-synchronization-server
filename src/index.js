import express from "express";
import "dotenv/config";

import indexRouter from "./routes/index";
import Scheduler from "./logic/scheduler";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize router
app.use("/", indexRouter);

app.listen(process.env.PORT);
console.log(`Server started on ${process.env.PORT}`);

Scheduler.initialize(process.env.DHIS2_BASE_URL, {
    username: process.env.DHIS2_USERNAME,
    password: process.env.DHIS2_PASSWORD,
});

export default app;
