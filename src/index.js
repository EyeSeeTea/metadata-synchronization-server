import express from "express";
import axios from "axios";
import btoa from "btoa";
import { init } from "d2";
import "dotenv/config";

import indexRouter from "./routes/index";
import Scheduler from "./logic/scheduler";
import Instance from "./models/instance";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize router
app.use("/", indexRouter);

app.listen(process.env.PORT);
console.log(`Server started on ${process.env.PORT}`);

const start = async () => {
    const {
        encryptionKey = "",
        baseUrl = "http://play.dhis2.org/demo",
        username = "admin",
        password = "district",
    } = await axios.get("app-config.json");

    // Login to the attached instance with basic auth
    const Authorization = `Basic ${btoa(username + ":" + password)}`;
    const d2 = await init({ baseUrl, headers: { Authorization } });
    axios.defaults.headers.common["Authorization"] = Authorization;

    Instance.setEncryptionKey(encryptionKey);
    Scheduler.initialize(d2);
};

start();

export default app;
